import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { APP_ROOT } from './config.ts';

/**
 * Multi-repository enterprise workspace. All Git operations are read-only;
 * metadata is stored OUTSIDE the business checkout and no remote is fetched.
 * A snapshot pins exact locally available Git objects, never a moving branch.
 */
const IGNORED = new Set([
  '.git', '.asset-workbench-data', 'node_modules', 'target', 'dist', 'build',
  '.gradle', '.idea', '.next', '.cache', '.venv', 'venv', '__pycache__', 'coverage',
]);
const MAX_REPOSITORIES = 500;
const MAX_DEPTH = 5;
const MAX_DIFF_PATHS = 300;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

export type RevisionSelection = 'head' | 'origin-tracking';
export interface EnterpriseRepo {
  path: string;
  remote?: string;
  branch: string | null;
  headCommit: string;
  originMainCommit?: string;
  originMasterCommit?: string;
  dirty: boolean;
  modifiedCount: number;
  untrackedCount: number;
}
export interface EnterpriseDiscovery {
  root: string;
  scannedAt: string;
  repositories: EnterpriseRepo[];
  warnings: string[];
  limits: { maxDepth: number; maxRepositories: number };
}
export interface PinnedRepository {
  path: string;
  remote?: string;
  sourceRef: string;
  commit: string;
  tree: string;
  branch: string | null;
  dirtyAtFreeze: boolean;
}
export interface EnterpriseSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  workspaceFingerprint: string;
  source: RevisionSelection;
  createdAt: string;
  repositories: PinnedRepository[];
  digest: string;
  warnings: string[];
}
export interface VersionComparisonRow {
  path: string;
  status: 'added' | 'removed' | 'unchanged' | 'changed';
  from?: string;
  to?: string;
  changedFiles?: string[];
  diffComplete: boolean;
  note?: string;
}
export interface EnterpriseComparison {
  before: string;
  after: string;
  changedRepositories: number;
  rows: VersionComparisonRow[];
}

function canonicalRoot(root: string): string {
  const resolved = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('Workspace root must be a directory');
  if (resolved === fs.realpathSync(APP_ROOT)) throw new Error('Central Framework is not a business workspace');
  return resolved;
}
function dataHome(root: string): string {
  return path.join(APP_ROOT, '.asset-workbench-data', 'enterprise-workspaces', sha(root).slice(0, 32));
}
export function enterpriseStoreFor(root: string): string {
  return dataHome(canonicalRoot(root));
}
function runGit(dir: string, args: string[], maxBuffer = 1024 * 1024): string | null {
  try {
    const data = execFileSync('git', ['-C', dir, ...args], {
      timeout: 5000, maxBuffer, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
    });
    return data.toString('utf8').trim();
  } catch {
    return null;
  }
}
function safeRemote(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      return url.origin + url.pathname; // never persist credentials, query or fragment
    }
  } catch { return undefined; }
  // SSH and local remote URLs are not authentication tokens.
  return value.replace(/:\/\/[^@/\s]+@/, '://[redacted]@');
}
function inspectGit(dir: string, rel: string): EnterpriseRepo | null {
  const top = runGit(dir, ['rev-parse', '--show-toplevel']);
  if (!top || fs.realpathSync(path.resolve(top)) !== dir) return null;
  const head = runGit(dir, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head || !/^[a-f0-9]{40,64}$/.test(head)) return null;
  const porcelain = runGit(dir, ['status', '--porcelain', '--untracked-files=normal'], 4 * 1024 * 1024);
  const lines = porcelain?.split('\n').filter(Boolean) ?? [];
  return {
    path: rel,
    remote: safeRemote(runGit(dir, ['config', '--get', 'remote.origin.url'])),
    branch: runGit(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    headCommit: head,
    originMainCommit: runGit(dir, ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}']) ?? undefined,
    originMasterCommit: runGit(dir, ['rev-parse', '--verify', 'refs/remotes/origin/master^{commit}']) ?? undefined,
    dirty: lines.length > 0,
    modifiedCount: lines.filter((line) => !line.startsWith('??')).length,
    untrackedCount: lines.filter((line) => line.startsWith('??')).length,
  };
}

/** Locate repositories without following symlinks or recursively scanning code files. */
export function discoverEnterpriseWorkspace(inputRoot: string): EnterpriseDiscovery {
  const root = canonicalRoot(inputRoot);
  const repositories: EnterpriseRepo[] = [];
  const warnings: string[] = [];
  const walk = (directory: string, relative: string, depth: number) => {
    if (repositories.length >= MAX_REPOSITORIES) {
      if (!warnings.includes('已达到 500 个仓库的扫描上限。')) warnings.push('已达到 500 个仓库的扫描上限。');
      return;
    }
    // .git can be a worktree/submodule file or a normal directory.
    if (fs.existsSync(path.join(directory, '.git'))) {
      const repo = inspectGit(directory, relative);
      if (repo) { repositories.push(repo); return; }
      warnings.push('发现无法读取的 Git 仓库：' + (relative || '.'));
      return;
    }
    if (depth >= MAX_DEPTH) {
      warnings.push('达到目录扫描深度上限：' + (relative || '.'));
      return;
    }
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch { warnings.push('无法访问目录：' + (relative || '.')); return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || IGNORED.has(entry.name)) continue;
      const child = path.join(directory, entry.name);
      walk(child, relative ? relative + '/' + entry.name : entry.name, depth + 1);
      if (repositories.length >= MAX_REPOSITORIES) break;
    }
  };
  walk(root, '', 0);
  if (!repositories.length) warnings.push('没有发现带有有效 HEAD 的 Git 仓库；请确认目录和访问权限。');
  return { root, scannedAt: new Date().toISOString(), repositories, warnings,
    limits: { maxDepth: MAX_DEPTH, maxRepositories: MAX_REPOSITORIES } };
}
function snapshotDigest(data: Pick<EnterpriseSnapshot, 'workspaceFingerprint' | 'source' | 'repositories'>): string {
  // Volatile observations (dirty files, branch labels, refreshed remote metadata)
  // cannot change an immutable version pinned by the same exact Git commits.
  return sha(JSON.stringify({ workspaceFingerprint: data.workspaceFingerprint,
    source: data.source, repositories: data.repositories.map((r) => ({
      path: r.path, sourceRef: r.sourceRef, commit: r.commit, tree: r.tree,
    })) }));
}
function snapshotFile(root: string, id: string): string {
  if (!/^ws-[a-f0-9]{24}$/.test(id)) throw new Error('Invalid workspace snapshot ID');
  return path.join(dataHome(root), 'snapshots', id + '.json');
}
function readSnapshot(root: string, id: string): EnterpriseSnapshot {
  const file = snapshotFile(root, id);
  const item = JSON.parse(fs.readFileSync(file, 'utf8')) as EnterpriseSnapshot;
  if (item.schemaVersion !== 1 || item.snapshotId !== id
    || item.workspaceFingerprint !== sha(root)
    || item.digest !== snapshotDigest(item)
    || id !== 'ws-' + item.digest.slice(0, 24)) {
    throw new Error('Enterprise workspace snapshot manifest integrity check failed');
  }
  return item;
}
export function listEnterpriseSnapshots(inputRoot: string): EnterpriseSnapshot[] {
  const root = canonicalRoot(inputRoot), folder = path.join(dataHome(root), 'snapshots');
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter((file) => /^ws-[a-f0-9]{24}\.json$/.test(file))
    .map((file) => readSnapshot(root, file.slice(0, -5)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}
function resolveRepo(root: string, rel: string): string {
  if (typeof rel !== 'string' || rel.startsWith('/') || rel.split('/').some((part) => part === '..' || part === '.')
    || rel.includes('\\') || rel.includes('\0')) throw new Error('Unsafe repository path');
  const directory = path.resolve(root, rel);
  const actual = fs.realpathSync(directory);
  if (actual !== root && !actual.startsWith(root + path.sep)) throw new Error('Repository escaped workspace root');
  return actual;
}
export function freezeEnterpriseWorkspace(inputRoot: string, source: RevisionSelection = 'head'): EnterpriseSnapshot {
  if (source !== 'head' && source !== 'origin-tracking') throw new Error('Invalid revision source');
  const discovery = discoverEnterpriseWorkspace(inputRoot);
  if (!discovery.repositories.length) throw new Error('No repositories to freeze');
  const repos: PinnedRepository[] = discovery.repositories.map((repo) => {
    const ref = source === 'head' ? 'HEAD'
      : repo.originMainCommit ? 'refs/remotes/origin/main'
        : repo.originMasterCommit ? 'refs/remotes/origin/master' : '';
    if (!ref) throw new Error('仓库缺少 origin/main 或 origin/master 跟踪引用：' + repo.path);
    const directory = resolveRepo(discovery.root, repo.path);
    const commit = runGit(directory, ['rev-parse', '--verify', ref + '^{commit}']);
    const tree = commit && runGit(directory, ['rev-parse', '--verify', commit + '^{tree}']);
    if (!commit || !tree || !/^[a-f0-9]{40,64}$/.test(commit) || !/^[a-f0-9]{40,64}$/.test(tree)) {
      throw new Error('无法冻结仓库的 Git 对象：' + repo.path);
    }
    return { path: repo.path, remote: repo.remote, sourceRef: ref, commit, tree,
      branch: repo.branch, dirtyAtFreeze: repo.dirty };
  });
  const base = { workspaceFingerprint: sha(discovery.root), source, repositories: repos };
  const digest = snapshotDigest(base), snapshotId = 'ws-' + digest.slice(0, 24);
  const file = snapshotFile(discovery.root, snapshotId);
  if (fs.existsSync(file)) return readSnapshot(discovery.root, snapshotId); // idempotent, never overwrite
  const warnings = [...discovery.warnings];
  if (repos.some((r) => r.dirtyAtFreeze)) warnings.push('有仓库存在未提交修改；快照只包含 Git 提交，不包含工作区脏文件。');
  if (source === 'origin-tracking') warnings.push('使用本地 origin 跟踪引用；没有联网 fetch，不能据此推断远端已经更新。');
  const result: EnterpriseSnapshot = { schemaVersion: 1, snapshotId, ...base,
    createdAt: new Date().toISOString(), digest, warnings };
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.tmp-' + randomUUID();
  fs.writeFileSync(temp, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  try {
    // link is atomic, refuses replacement by concurrent or later writes.
    fs.linkSync(temp, file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  } finally { fs.unlinkSync(temp); }
  return readSnapshot(discovery.root, snapshotId);
}
export function verifyEnterpriseSnapshot(inputRoot: string, id: string): {
  snapshotId: string; ok: boolean; checked: number; missing: string[];
} {
  const root = canonicalRoot(inputRoot), snap = readSnapshot(root, id), missing: string[] = [];
  for (const repo of snap.repositories) {
    try {
      const directory = resolveRepo(root, repo.path);
      const actual = runGit(directory, ['rev-parse', '--verify', repo.commit + '^{tree}']);
      if (actual !== repo.tree) missing.push(repo.path + ': object mismatch or unavailable');
    } catch { missing.push(repo.path + ': checkout missing or moved'); }
  }
  return { snapshotId: id, ok: missing.length === 0, checked: snap.repositories.length, missing };
}
export function compareEnterpriseSnapshots(inputRoot: string, beforeId: string, afterId: string): EnterpriseComparison {
  const root = canonicalRoot(inputRoot), before = readSnapshot(root, beforeId), after = readSnapshot(root, afterId);
  const previous = new Map(before.repositories.map((r) => [r.path, r]));
  const next = new Map(after.repositories.map((r) => [r.path, r]));
  const rows: VersionComparisonRow[] = [];
  for (const pathName of new Set([...previous.keys(), ...next.keys()])) {
    const a = previous.get(pathName), b = next.get(pathName);
    if (!a) { rows.push({ path: pathName, status: 'added', to: b!.commit, diffComplete: false }); continue; }
    if (!b) { rows.push({ path: pathName, status: 'removed', from: a.commit, diffComplete: false }); continue; }
    if (a.commit === b.commit) { rows.push({ path: pathName, status: 'unchanged', from: a.commit, to: b.commit, diffComplete: true, changedFiles: [] }); continue; }
    let names: string[] | undefined;
    try {
      const directory = resolveRepo(root, pathName);
      const output = execFileSync('git', ['-C', directory, '-c', 'core.quotePath=false', 'diff',
        '--name-only', '-z', a.commit, b.commit, '--'], { timeout: 15000,
        maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } });
      names = output.toString('utf8').split('\0').filter(Boolean);
    } catch { /* old commit could have been GC-ed; never report a fabricated diff */ }
    rows.push({ path: pathName, status: 'changed', from: a.commit, to: b.commit,
      changedFiles: names?.slice(0, MAX_DIFF_PATHS), diffComplete: names !== undefined && names.length <= MAX_DIFF_PATHS,
      note: !names ? 'Git 差异对象不可用，需要受管镜像或恢复历史后重试。'
        : names.length > MAX_DIFF_PATHS ? '文件差异超过显示上限，仅展示前 300 项。' : undefined });
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return { before: beforeId, after: afterId,
    changedRepositories: rows.filter((r) => r.status !== 'unchanged').length, rows };
}
