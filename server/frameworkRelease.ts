import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { APP_ROOT, loadConfig } from './config.ts';

export type ReleaseFile = { path: string; sha256: string; size: number };
export interface FrameworkRelease {
  schemaVersion: 1;
  releaseId: string;
  framework: { version: string; revision: string };
  createdAt: string;
  totalBytes: number;
  files: ReleaseFile[];
}
export const RELEASE_HOME = path.join(APP_ROOT, '.asset-workbench-data', 'framework-releases');
const pointer = path.join(RELEASE_HOME, 'current.json');
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
function filesUnder(root: string, prefix = ''): ReleaseFile[] {
  const list: ReleaseFile[] = [];
  for (const item of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix.replaceAll(path.sep, '/'), item.name);
    const absolute = path.join(root, relative);
    if (item.isSymbolicLink()) throw new Error('Framework release may not contain symlinks: ' + relative);
    if (item.isDirectory()) list.push(...filesUnder(root, relative));
    else if (item.isFile() && relative !== 'release.json') {
      const data = fs.readFileSync(absolute);
      list.push({ path: relative, sha256: sha(data), size: data.byteLength });
    } else if (!item.isFile()) throw new Error('Unsupported release entry');
  }
  return list.sort((a, b) => a.path.localeCompare(b.path));
}
function validateId(id: string): void {
  if (!/^rel-[a-f0-9]{24}$/.test(id)) throw new Error('Invalid releaseId');
}
function atomicJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.tmp-' + randomUUID();
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
export function releasePath(id: string): string {
  validateId(id);
  return path.join(RELEASE_HOME, id);
}
export function verifyFrameworkRelease(id: string): FrameworkRelease {
  const dir = releasePath(id);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8')) as FrameworkRelease;
  if (manifest.schemaVersion !== 1 || manifest.releaseId !== id) throw new Error('Framework release manifest identity mismatch');
  const actual = filesUnder(dir);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('Framework release checksum mismatch');
  const payload = JSON.stringify({ framework: manifest.framework, files: actual });
  if (id !== 'rel-' + sha(payload).slice(0, 24)) throw new Error('Framework release digest mismatch');
  if (!fs.existsSync(path.join(dir, 'ui', 'index.html')) || !fs.existsSync(path.join(dir, 'server.mjs'))) {
    throw new Error('Incomplete Framework release');
  }
  return manifest;
}
export function currentFrameworkRelease(): FrameworkRelease | null {
  try {
    const { releaseId } = JSON.parse(fs.readFileSync(pointer, 'utf8')) as { releaseId: string };
    return verifyFrameworkRelease(releaseId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function buildUi(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, ['run', 'build'], {
      cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, CI: '1' },
    });
    let output = '';
    const append = (chunk: Buffer) => { output = (output + chunk.toString('utf8')).slice(-6000); };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timeout = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.once('error', (err) => { clearTimeout(timeout); reject(err); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error('Framework build failed (' + code + '): ' + output));
    });
  });
}
let publication: Promise<FrameworkRelease> | null = null;
export function publishFrameworkRelease(): Promise<FrameworkRelease> {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) return Promise.reject(new Error('Only central Framework can publish releases'));
  if (!publication) publication = publishInner().finally(() => { publication = null; });
  return publication;
}
async function publishInner(): Promise<FrameworkRelease> {
  fs.mkdirSync(RELEASE_HOME, { recursive: true, mode: 0o700 });
  const stage = fs.mkdtempSync(path.join(RELEASE_HOME, '.stage-'));
  try {
    await buildUi();
    fs.cpSync(path.join(APP_ROOT, 'dist'), path.join(stage, 'ui'), { recursive: true, errorOnExist: true });
    await build({
      entryPoints: [path.join(APP_ROOT, 'server', 'standaloneRuntime.ts')],
      outfile: path.join(stage, 'server.mjs'),
      bundle: true, platform: 'node', format: 'esm', target: 'node22',
      logLevel: 'warning', sourcemap: false, packages: 'bundle',
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    });
    const cfg = loadConfig();
    const framework = { version: cfg.frameworkVersion, revision: cfg.frameworkRevision };
    const files = filesUnder(stage);
    const releaseId = 'rel-' + sha(JSON.stringify({ framework, files })).slice(0, 24);
    const release: FrameworkRelease = {
      schemaVersion: 1, releaseId, framework, createdAt: new Date().toISOString(),
      totalBytes: files.reduce((sum, file) => sum + file.size, 0), files,
    };
    atomicJson(path.join(stage, 'release.json'), release);
    const target = releasePath(releaseId);
    if (fs.existsSync(target)) {
      verifyFrameworkRelease(releaseId);
      fs.rmSync(stage, { recursive: true, force: true });
    } else fs.renameSync(stage, target);
    atomicJson(pointer, { releaseId, publishedAt: new Date().toISOString() });
    return verifyFrameworkRelease(releaseId);
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}
