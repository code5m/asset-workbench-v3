import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { currentFrameworkRelease, verifyFrameworkRelease, publishFrameworkRelease } from './frameworkRelease.ts';
import { spawn } from 'node:child_process';
import { APP_ROOT, loadConfig } from './config.ts';
import { frameworkIdentity, readInstanceManifest, verifyInstance } from '../packages/creator-core/src/index.ts';

/** Independently running Instance: a loopback process pinned to one project and sharing the Framework source. */
export interface InstanceRuntimeView {
  projectRoot: string; instanceId: string; frameworkVersion: string; frameworkRevision: string;
  status: 'running' | 'stopped'; url: string | null; port: number | null; pid: number | null;
  releaseId?: string | null;
  previousReleaseId?: string | null;
}
interface RuntimeRecord { projectRoot: string; instanceId: string; pid: number; port: number; releaseId?: string; token?: string; }
const registryDir = () => path.join(APP_ROOT, '.asset-workbench-data', 'instance-runtimes');
type ReleaseSelection = { active: string; previous: string | null };
function selectionFile(root: string): string {
  return filename(root).replace(/\\.json$/, '.release.json');
}
function readSelection(root: string): ReleaseSelection | null {
  try {
    const entry = JSON.parse(fs.readFileSync(selectionFile(root), 'utf8')) as ReleaseSelection;
    if (!entry.active || typeof entry.active !== 'string' || (entry.previous && typeof entry.previous !== 'string')) return null;
    return entry;
  } catch { return null; }
}
function saveSelection(root: string, selection: ReleaseSelection): void {
  fs.mkdirSync(registryDir(), { recursive: true, mode: 0o700 });
  const file = selectionFile(root), temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(selection), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function centralOnly(): void {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('An Instance cannot manage other Instance processes');
}
function resolveRoot(input: string): string {
  if (!input?.trim()) throw new Error('projectRoot is required');
  const root = fs.realpathSync(path.resolve(input)), app = fs.realpathSync(APP_ROOT);
  if (!fs.statSync(root).isDirectory() || root === app || root.startsWith(app + path.sep)) {
    throw new Error('Instance must target an external business project');
  }
  return root;
}
function filename(root: string): string {
  return path.join(registryDir(), createHash('sha256').update(root).digest('hex') + '.json');
}
function readRecord(root: string): RuntimeRecord | null {
  try {
    const v = JSON.parse(fs.readFileSync(filename(root), 'utf8')) as RuntimeRecord;
    return v.projectRoot === root && Number.isInteger(v.pid) && v.pid > 0
      && Number.isInteger(v.port) && v.port > 0 && v.port <= 65535 ? v : null;
  } catch { return null; }
}
function writeRecord(v: RuntimeRecord): void {
  fs.mkdirSync(registryDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename(v.projectRoot) + '.tmp', JSON.stringify(v), { mode: 0o600 });
  fs.renameSync(filename(v.projectRoot) + '.tmp', filename(v.projectRoot));
}
function forget(root: string): void { try { fs.unlinkSync(filename(root)); } catch { /* no entry */ } }
function inspect(root: string) {
  const manifest = readInstanceManifest(root);
  if (!manifest || path.resolve(manifest.projectRoot) !== root) throw new Error('Valid Instance Manifest required');
  const cfg = loadConfig();
  const check = verifyInstance(root, frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision));
  if (!check.ok) throw new Error('Instance verification failed; inspect Manifest first');
  return { manifest, check };
}
function alive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch { return false; } }
async function responds(v: RuntimeRecord): Promise<boolean> {
  if (!alive(v.pid) || !v.releaseId || !v.token) return false;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 1000);
  try {
    const res = await fetch(`http://127.0.0.1:${v.port}/_runtime/health`, {
      headers: { 'x-awb-runtime-token': v.token }, signal: controller.signal,
    });
    if (!res.ok) return false;
    const cfg = await res.json() as { projectRoot?: string; instanceId?: string; releaseId?: string; pid?: number };
    return cfg.projectRoot === v.projectRoot && cfg.instanceId === v.instanceId
      && cfg.releaseId === v.releaseId && cfg.pid === v.pid;
  } catch { return false; } finally { clearTimeout(timer); }
}
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address(), port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}
export async function instanceRuntimeStatus(project: string): Promise<InstanceRuntimeView> {
  centralOnly();
  const root = resolveRoot(project), { manifest } = inspect(root), record = readRecord(root);
  const selection = readSelection(root);
  const running = !!record && record.instanceId === manifest.instanceId && await responds(record);
  if (!running && record && !alive(record.pid)) forget(root);
  return {
    projectRoot: root, instanceId: manifest.instanceId,
    frameworkVersion: manifest.framework.version, frameworkRevision: manifest.framework.revision,
    status: running ? 'running' : 'stopped', url: running ? `http://127.0.0.1:${record!.port}/` : null,
    port: running ? record!.port : null, pid: running ? record!.pid : null,
    releaseId: running ? record!.releaseId : selection?.active ?? null,
    previousReleaseId: selection?.previous ?? null,
  };
}
export async function startInstanceRuntime(project: string): Promise<InstanceRuntimeView> {
  centralOnly();
  const root = resolveRoot(project), { manifest, check } = inspect(root);
  const current = await instanceRuntimeStatus(root);
  if (current.status === 'running') return current;
  const stale = readRecord(root);
  if (stale && alive(stale.pid)) throw new Error('Previous process still exists but cannot verify identity; stop it manually');
  const selection = readSelection(root);
  const release = selection ? verifyFrameworkRelease(selection.active) : currentFrameworkRelease();
  if (!release) throw new Error('No published Framework release; publish the first release from central UI');
  // Manifest identity tracks creator metadata compatibility separately from published app runtime identity.
  // Release compatibility is checked by the release's own immutable checksum before process launch.
  const verified = verifyFrameworkRelease(release.releaseId);
  const releaseDir = path.join(APP_ROOT, '.asset-workbench-data', 'framework-releases', verified.releaseId);
  const token = randomBytes(32).toString('hex');
  const port = await freePort();
  const startupLog = path.join(registryDir(), 'startup-' + createHash('sha256').update(root).digest('hex').slice(0, 16) + '.log');
  fs.mkdirSync(registryDir(), { recursive: true, mode: 0o700 });
  const logFd = fs.openSync(startupLog, 'w', 0o600);
  const child = spawn(process.execPath, [path.join(releaseDir, 'server.mjs')], {
    cwd: APP_ROOT, detached: true, stdio: ['ignore', logFd, logFd], windowsHide: true,
    env: { ...process.env, AWB_INSTANCE_PROJECT_ROOT: root,
      AWB_RELEASE_ID: verified.releaseId, AWB_RELEASE_UI_DIR: path.join(releaseDir, 'ui'),
      AWB_RUNTIME_PORT: String(port), AWB_RUNTIME_TOKEN: token },
  });
  fs.closeSync(logFd);
  if (!child.pid) throw new Error('Failed to spawn Instance process');
  child.unref();
  const record: RuntimeRecord = { projectRoot: root, instanceId: manifest.instanceId, pid: child.pid, port, releaseId: verified.releaseId, token };
  writeRecord(record);
  if (!selection) saveSelection(root, { active: verified.releaseId, previous: null });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await responds(record)) return instanceRuntimeStatus(root);
    if (!alive(record.pid)) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (alive(record.pid)) process.kill(record.pid, 'SIGTERM');
  forget(root);
  const details = fs.existsSync(startupLog) ? fs.readFileSync(startupLog, 'utf8').slice(-1200) : '';
  throw new Error('Instance did not become ready: ' + details);
}
export async function stopInstanceRuntime(project: string): Promise<InstanceRuntimeView> {
  centralOnly();
  const root = resolveRoot(project), current = await instanceRuntimeStatus(root), record = readRecord(root);
  if (current.status === 'running' && record) process.kill(record.pid, 'SIGTERM');
  else if (record && alive(record.pid)) throw new Error('Saved PID belongs to an unverified process; refused to kill');
  forget(root);
  return { ...current, status: 'stopped', url: null, port: null, pid: null };
}
export async function adoptInstanceRelease(project: string, releaseId: string): Promise<InstanceRuntimeView> {
  centralOnly();
  const root = resolveRoot(project);
  inspect(root);
  verifyFrameworkRelease(releaseId);
  const previous = readSelection(root);
  if (previous?.active === releaseId) return instanceRuntimeStatus(root);
  const wasRunning = (await instanceRuntimeStatus(root)).status === 'running';
  if (wasRunning) await stopInstanceRuntime(root);
  const next = { active: releaseId, previous: previous?.active ?? currentFrameworkRelease()?.releaseId ?? null };
  saveSelection(root, next);
  if (!wasRunning) return instanceRuntimeStatus(root);
  try { return await startInstanceRuntime(root); }
  catch (error) {
    if (previous) saveSelection(root, previous);
    else { try { fs.unlinkSync(selectionFile(root)); } catch { /* absent */ } }
    try { await startInstanceRuntime(root); }
    catch (restoreError) { throw new Error('New release failed and old release restart also failed: ' + String(restoreError)); }
    throw new Error('New release failed; previous running release restored: ' + String(error));
  }
}
export async function rollbackInstanceRelease(project: string): Promise<InstanceRuntimeView> {
  centralOnly();
  const root = resolveRoot(project);
  const previous = readSelection(root)?.previous;
  if (!previous) throw new Error('No previous published runtime release to roll back to');
  return adoptInstanceRelease(root, previous);
}
export async function listInstanceRuntimes(): Promise<InstanceRuntimeView[]> {
  centralOnly();
  if (!fs.existsSync(registryDir())) return [];
  const roots = new Set<string>();
  for (const file of fs.readdirSync(registryDir()).filter((name) => name.endsWith('.json'))) {
    try { roots.add((JSON.parse(fs.readFileSync(path.join(registryDir(), file), 'utf8')) as RuntimeRecord).projectRoot); }
    catch { /* invalid entry */ }
  }
  const result: InstanceRuntimeView[] = [];
  for (const root of roots) { try { result.push(await instanceRuntimeStatus(root)); } catch { /* moved project */ } }
  return result;
}
