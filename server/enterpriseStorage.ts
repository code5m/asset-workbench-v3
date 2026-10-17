import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { APP_ROOT } from './config.ts';

export type EnterpriseMode = 'read-only' | 'managed';
export interface EnterpriseRegistryEntry {
  workspaceId: string;
  projectRoot: string;
  label: string;
  registeredAt: string;
  sourcePolicy: EnterpriseMode;
  managedAt?: string;
}
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const ROOT_DATA = '.asset-workbench-data';
const registryPath = () => path.join(APP_ROOT, ROOT_DATA, 'enterprise-workspaces', 'attached.json');

export function canonicalEnterpriseRoot(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('必须选择现有企业业务目录');
  const canonical = fs.realpathSync(path.resolve(input));
  const appRoot = fs.realpathSync(APP_ROOT);
  if (!fs.statSync(canonical).isDirectory() || canonical === appRoot
    || canonical.startsWith(appRoot + path.sep)) {
    throw new Error('企业工作区必须在中央 Framework 目录之外');
  }
  return canonical;
}
export function enterpriseWorkspaceId(root: string): string {
  return 'enterprise-' + hash(root).slice(0, 24);
}
export function centralEnterpriseStore(root: string): string {
  return path.join(APP_ROOT, ROOT_DATA, 'enterprise-workspaces', hash(root).slice(0, 32));
}
export function readEnterpriseRegistry(): EnterpriseRegistryEntry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath(), 'utf8')) as EnterpriseRegistryEntry[];
    if (!Array.isArray(raw)) throw new Error('Enterprise registry is not an array');
    return raw.filter(entry => entry && typeof entry.projectRoot === 'string'
      && entry.workspaceId === enterpriseWorkspaceId(entry.projectRoot)
      && (entry.sourcePolicy === 'read-only' || entry.sourcePolicy === 'managed'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error; // corrupt registry is NOT an empty one
  }
}
export function writeEnterpriseRegistry(entries: EnterpriseRegistryEntry[]): void {
  const file = registryPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp-' + randomUUID();
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export function enterpriseEntryForRoot(input: string): EnterpriseRegistryEntry | undefined {
  const root = canonicalEnterpriseRoot(input);
  return readEnterpriseRegistry().find(entry => entry.projectRoot === root);
}
/** Validate every pre-existing segment before reading or writing managed assets.
 * This prevents a symlink inside the private root from redirecting V3 into a Git repository. */
export function assertSafeEnterpriseManagedPath(rootInput: string, relative: string): string {
  const root = canonicalEnterpriseRoot(rootInput);
  if (!relative || path.isAbsolute(relative) || relative.includes('\\0')
    || relative.includes('\\\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid managed storage relative path');
  }
  const parts = [ROOT_DATA, ...relative.split('/')];
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    // lstat with throwIfNoEntry distinguishes a missing path from a dangling
    // symlink. existsSync follows links and would silently treat the latter
    // as absent, bypassing our no-symlink managed-storage boundary.
    const stats = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stats) {
      if (stats.isSymbolicLink()) throw new Error('Managed path symlink is forbidden: ' + part);
      if (index !== parts.length - 1 && !stats.isDirectory()) {
        throw new Error('Managed path ancestor is not a directory: ' + part);
      }
    }
  }
  return current;
}
/** A Git exclude does not protect ALREADY TRACKED files. Refuse to manage
 * business paths that the root repository already tracks. */
const verifiedGitRootIndex = new Map<string, string>();
function assertUntrackedManagedData(root: string): void {
  const gitDot = path.join(root, '.git');
  if (!fs.existsSync(gitDot)) return;
  // Use the local index stamp to avoid repeatedly spawning Git for every
  // snapshot, Mirror and Raw operation; repeat check when the index changes.
  let stamp: string | null = null;
  if (fs.lstatSync(gitDot).isDirectory() && !fs.lstatSync(gitDot).isSymbolicLink()) {
    try {
      const info = fs.statSync(path.join(gitDot, 'index'));
      stamp = [info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs].join(':');
      if (verifiedGitRootIndex.get(root) === stamp) return;
    } catch { /* repository may be unborn or use an external index */ }
  }
  let top = '';
  let tracked = '';
  try {
    top = fs.realpathSync(execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore','pipe','ignore'] }).trim());
    tracked = execFileSync('git', ['-C', root, 'ls-files', '--cached', '--', ROOT_DATA],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore','pipe','ignore'] }).trim();
  } catch {
    throw new Error('Unable to verify the root Git tracking boundary; managed mode is blocked');
  }
  if (top !== root) throw new Error('Root Git toplevel changed; managed mode is blocked');
  if (tracked) {
    verifiedGitRootIndex.delete(root);
    throw new Error('Git already tracks .asset-workbench-data; refusing to overwrite tracked business files');
  }
  if (stamp) verifiedGitRootIndex.set(root, stamp);
}
function checkManagedDirectory(root: string): string {
  assertUntrackedManagedData(root);
  const data = path.join(root, ROOT_DATA);
  const dataKind = fs.lstatSync(data, { throwIfNoEntry: false });
  if (dataKind && (!dataKind.isDirectory() || dataKind.isSymbolicLink())) {
    throw new Error('企业根目录已有非普通目录或符号链接 .asset-workbench-data，拒绝受管模式');
  }
  const target = path.join(data, 'enterprise');
  const targetKind = fs.lstatSync(target, { throwIfNoEntry: false });
  if (targetKind && (!targetKind.isDirectory() || targetKind.isSymbolicLink())) {
    throw new Error('企业工作台存储目录不是普通目录，拒绝写入');
  }
  return target;
}
const PROTECTED_STORES = ['raw', 'mirrors', 'snapshots', 'imports', 'derived',
  'semantic', 'evolution', 'experiments', 'refactors'];
function ensureManagedAnalysisChildrenSafe(root: string, directory: string): void {
  for (const sub of PROTECTED_STORES) {
    const child = path.join(directory, sub);
    const kind = fs.lstatSync(child, { throwIfNoEntry: false });
    if (!kind) continue;
    if (kind.isSymbolicLink() || !kind.isDirectory()) {
      throw new Error('企业分析受管路径不是独立普通目录: ' + sub);
    }
    // Raw two-char sharding and local bare Git mirrors are particularly
    // sensitive: a symlink here would write into the company's checkout.
    if (sub === 'raw' || sub === 'mirrors') {
      for (const name of fs.readdirSync(child)) {
        const segment = fs.lstatSync(path.join(child, name));
        if (segment.isSymbolicLink()) throw new Error('禁止企业镜像或 Raw 存储符号链接: ' + sub + '/' + name);
      }
    }
  }
}
export function enterpriseStorageFor(input: string): string {
  const root = canonicalEnterpriseRoot(input);
  const entry = enterpriseEntryForRoot(root);
  if (entry?.sourcePolicy === 'managed') {
    const dir = checkManagedDirectory(root);
    ensureManagedAnalysisChildrenSafe(root, dir);
    return dir;
  }
  return centralEnterpriseStore(root);
}
function scanRegularFiles(dir: string): Array<{ relative: string; bytes: number; digest: string }> {
  const kind = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!kind) return [];
  if (!kind.isDirectory() || kind.isSymbolicLink()) {
    throw new Error('Migration source/destination must be a real directory, not a symlink');
  }
  const result: Array<{ relative: string; bytes: number; digest: string }> = [];
  const walk = (abs: string, rel: string) => {
    for (const item of fs.readdirSync(abs, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new Error('Migration refuses symlink in source data: ' + item.name);
      const child = path.join(abs, item.name), r = rel ? rel + '/' + item.name : item.name;
      if (item.isDirectory()) walk(child, r);
      else if (item.isFile()) {
        const stats = fs.statSync(child);
        if (stats.size > 1024 * 1024 * 1024) throw new Error('Migration file too large: ' + r);
        result.push({ relative: r, bytes: stats.size, digest: hash(fs.readFileSync(child)) });
        if (result.length > 250_000) throw new Error('Migration exceeded file limit');
      } else throw new Error('Migration refuses special file: ' + r);
    }
  };
  walk(dir, '');
  return result.sort((a,b) => a.relative.localeCompare(b.relative));
}
export interface ManagedMigrationReport {
  mode: 'managed'; files: number; bytes: number; digest: string;
  sourcePreserved: true; destination: string; gitExclude: 'added' | 'present' | 'not-a-root-repo' | 'blocked';
  warnings: string[];
}
function appendLocalGitExclude(root: string): ManagedMigrationReport['gitExclude'] {
  if (!fs.existsSync(path.join(root, '.git')) || !fs.lstatSync(path.join(root, '.git')).isDirectory()) {
    return 'not-a-root-repo';
  }
  try {
    const top = fs.realpathSync(execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', timeout: 3000, stdio: ['ignore','pipe','ignore'] }).trim());
    if (top !== root) return 'not-a-root-repo';
    const file = path.join(root, '.git', 'info', 'exclude');
    const gitData = fs.realpathSync(path.join(root, '.git'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const resolvedParent = fs.realpathSync(path.dirname(file));
    if (!resolvedParent.startsWith(gitData + path.sep)) return 'blocked';
    if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) return 'blocked';
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (old.split(/\r?\n/).some(line => line.trim() === '/.asset-workbench-data/')) return 'present';
    fs.appendFileSync(file, (old && !old.endsWith('\n') ? '\n' : '')
      + '# Asset Workbench V3 project-local assets (local exclude only)\n/.asset-workbench-data/\n');
    return 'added';
  } catch { return 'blocked'; }
}
/**
 * A one-way, copy-and-verify migration. Legacy central data NEVER gets deleted.
 * Any target conflict stops activation rather than combining unrelated assets.
 */

export interface ManagedStorageAudit {
  mode: EnterpriseMode; sourcePreserved: boolean; expectedFiles: number;
  verifiedFiles: number; mismatches: string[];
  newManagedFiles: number; rollbackSafe: boolean;
}
export function auditManagedEnterpriseStorage(input: string): ManagedStorageAudit {
  const root = canonicalEnterpriseRoot(input);
  const entry = enterpriseEntryForRoot(root);
  if (!entry) throw new Error('Unknown enterprise workspace');
  const central = centralEnterpriseStore(root), target = checkManagedDirectory(root);
  const originals = scanRegularFiles(central);
  const copies = scanRegularFiles(target).filter(x => x.relative !== 'managed-migration.json');
  const inTarget = new Map(copies.map(item => [item.relative, item.digest]));
  const missing = originals.filter(file => inTarget.get(file.relative) !== file.digest)
    .map(item => item.relative);
  const originalSet = new Set(originals.map(x => x.relative));
  const extra = copies.filter(file => !originalSet.has(file.relative));
  // Detect new provider sessions / knowledge created after opting in.
  const data = path.join(root, ROOT_DATA);
  const sessionDir = path.join(data, 'capture', 'sessions');
  const hasEnterpriseSessions = fs.existsSync(sessionDir)
    && fs.readdirSync(sessionDir).some(x => x.startsWith('enterprise_capture_'));
  const notes = path.join(data, 'knowledge', 'notes');
  const hasNewNotes = fs.existsSync(notes) && fs.readdirSync(notes).some(x => /^knowledge_/.test(x));
  return {
    mode: entry.sourcePolicy,
    sourcePreserved: originals.every(file => {
      const absolute = path.join(central, ...file.relative.split('/'));
      return fs.existsSync(absolute) && hash(fs.readFileSync(absolute)) === file.digest;
    }),
    expectedFiles: originals.length, verifiedFiles: originals.length - missing.length,
    mismatches: missing,
    newManagedFiles: extra.length + Number(hasEnterpriseSessions) + Number(hasNewNotes),
    rollbackSafe: missing.length === 0 && extra.length === 0 && !hasEnterpriseSessions && !hasNewNotes,
  };
}
/** Revert only the storage routing; never delete any company or saved asset bytes. */
export function rollbackManagedEnterpriseStorage(input: string, confirmation: string) {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('中央 Framework Only');
  if (confirmation !== 'ROLLBACK_MANAGED_ROUTING') throw new Error('请确认回滚企业受管存储路由');
  const root = canonicalEnterpriseRoot(input);
  const audit = auditManagedEnterpriseStorage(root);
  if (!audit.rollbackSafe || !audit.sourcePreserved) {
    throw new Error('工作区受管期产生了新资产或备份不一致。为防止会话丢失，拒绝自动回滚；保留全部数据等待核对。');
  }
  const item = enterpriseEntryForRoot(root);
  if (!item || item.sourcePolicy !== 'managed') throw new Error('Workspace is not managed');
  writeEnterpriseRegistry(readEnterpriseRegistry().map(entry => entry.workspaceId === item.workspaceId
    ? { ...entry, sourcePolicy: 'read-only' as const, managedAt: undefined } : entry));
  return { mode: 'read-only' as const, dataPreserved: true as const,
    detail: '仅切回中央受管路径，根目录的复制资产仍保留，不删除、不覆盖。' };
}
export function enableManagedEnterpriseStorage(input: string): ManagedMigrationReport {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('业务 Instance 不能开启其他工作区的受管模式');
  const root = canonicalEnterpriseRoot(input);
  const entry = enterpriseEntryForRoot(root);
  if (!entry) throw new Error('请先只读接入企业工作区，再开启受管存储');
  const destination = checkManagedDirectory(root);
  const source = centralEnterpriseStore(root);
  const files = scanRegularFiles(source);
  const total = files.reduce((sum, item) => sum + item.bytes, 0);
  if (total > 8 * 1024 * 1024 * 1024) throw new Error('历史资产总量超过单次迁移上限');
  const digest = hash(JSON.stringify(files));
  const oldData = path.dirname(destination);
  let migrationAlreadyDone = false;
  if (fs.existsSync(destination)) {
    // Never adopt a foreign pre-existing destination merely because its
    // contents happen to be compatible (or because the central source is empty).
    const receiptPath = path.join(destination, 'managed-migration.json');
    if (!fs.existsSync(receiptPath) || fs.lstatSync(receiptPath).isSymbolicLink()
      || !fs.lstatSync(receiptPath).isFile()) {
      throw new Error('现有企业受管目录没有可信迁移回执；拒绝接管或覆盖已有数据');
    }
    let receipt: {
      schemaVersion?: number; projectRoot?: string; workspaceId?: string;
      source?: string; digest?: string; sourcePreserved?: boolean;
      files?: Array<{ relative: string; bytes: number; digest: string }>;
    };
    try { receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as typeof receipt; }
    catch { throw new Error('受管迁移回执损坏；保持原有数据不变'); }
    if (receipt.schemaVersion !== 1 || receipt.projectRoot !== root
      || receipt.workspaceId !== entry.workspaceId || receipt.source !== source
      || receipt.sourcePreserved !== true || receipt.digest !== digest
      || !Array.isArray(receipt.files)
      || hash(JSON.stringify(receipt.files)) !== digest) {
      throw new Error('受管目录迁移回执与项目身份或旧资产校验不一致；拒绝接管');
    }
    const existingFiles = scanRegularFiles(destination)
      .filter(item => item.relative !== 'managed-migration.json');
    const byFile = new Map(existingFiles.map(x => [x.relative, x.digest]));
    if (files.some(item => byFile.get(item.relative) !== item.digest)) {
      throw new Error('受管目录与旧资产存在冲突；旧数据保留，需人工核对后迁移');
    }
    migrationAlreadyDone = true;
  } else {
    fs.mkdirSync(oldData, { recursive: true, mode: 0o700 });
    const stage = path.join(oldData, '.enterprise-stage-' + randomUUID());
    fs.mkdirSync(stage, { recursive: false, mode: 0o700 });
    try {
      for (const file of files) {
        const target = path.join(stage, ...file.relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        fs.copyFileSync(path.join(source, ...file.relative.split('/')), target, fs.constants.COPYFILE_EXCL);
        if (hash(fs.readFileSync(target)) !== file.digest) throw new Error('Legacy migration checksum mismatch: ' + file.relative);
        fs.chmodSync(target, 0o600);
      }
      fs.renameSync(stage, destination);
    } finally { if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true }); }
  }
  const manifestFile = path.join(destination, 'managed-migration.json');
  if (!migrationAlreadyDone || !fs.existsSync(manifestFile)) {
    fs.writeFileSync(manifestFile, JSON.stringify({
      schemaVersion: 1, projectRoot: root, workspaceId: entry.workspaceId,
      source: source, digest, files, migratedAt: new Date().toISOString(),
      sourcePreserved: true,
    }, null, 2) + '\n', { mode: 0o600 });
  }
  const actual = scanRegularFiles(destination).filter(item => item.relative !== 'managed-migration.json');
  const byFile = new Map(actual.map(f => [f.relative, f.digest]));
  if (files.some(f => byFile.get(f.relative) !== f.digest)) {
    throw new Error('Managed migration verify failed; source remains untouched');
  }
  const updated = readEnterpriseRegistry().map(row => row.workspaceId === entry.workspaceId
    ? { ...row, sourcePolicy: 'managed' as const, managedAt: row.managedAt ?? new Date().toISOString() } : row);
  writeEnterpriseRegistry(updated);
  const gitExclude = appendLocalGitExclude(root);
  return { mode: 'managed', files: files.length, bytes: total, digest, sourcePreserved: true,
    destination, gitExclude, warnings: gitExclude === 'blocked' ? ['无法安全更新本地 Git exclude；请手动确认本地 Git 忽略规则'] : [] };
}
