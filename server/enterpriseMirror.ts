import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';

export interface MirrorResult {
  repository: string; snapshotCommit: string; status: 'verified' | 'blocked';
  mirrorPath?: string; reason?: string; bytes?: number;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * A bare Git mirror is an implementation detail of V3, not a trusted user
 * checkout. A symlink, hard link, Git object alternate or planted Git hook
 * inside it may write to/read from a separate company Git repository.
 * Fail closed before allowing any Git operation in that mirror.
 */
function assertIsolatedManagedMirror(directory: string): void {
  const top = fs.lstatSync(directory);
  if (!top.isDirectory() || top.isSymbolicLink()) throw new Error('Managed Git mirror is not a private ordinary directory');
  const pending: Array<{ file: string; relative: string }> = [{ file: directory, relative: '' }];
  let inspected = 0;
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current.file, { withFileTypes: true })) {
      const filename = path.join(current.file, entry.name);
      const relative = current.relative ? current.relative + '/' + entry.name : entry.name;
      const stat = fs.lstatSync(filename);
      if (++inspected > 150_000) throw new Error('Managed Git mirror exceeded safety inspection limit');
      if (stat.isSymbolicLink()) throw new Error('Managed Git mirror contains unsafe symlink: ' + relative);
      if (stat.isDirectory()) { pending.push({ file: filename, relative }); continue; }
      if (!stat.isFile() || stat.nlink !== 1)
        throw new Error('Managed Git mirror contains linked or special file: ' + relative);
      if (relative === 'objects/info/alternates')
        throw new Error('Managed Git mirror relies on an external object store: ' + relative);
      // No hooks are necessary for an archive Mirror. Even a legitimate hook
      // must not execute while V3 is updating its own Git object database.
      if (relative.startsWith('hooks/') && !relative.endsWith('.sample'))
        throw new Error('Managed Git mirror contains executable hook configuration: ' + relative);
    }
  }
}

function git(dir: string, args: string[], timeout = 120_000): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', dir, ...args], {
    encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
  }).trim();
}
/** Refresh exclusively from an authorized local checkout. Never contact its origin remote. */
export function mirrorEnterpriseSnapshot(rootInput: string, snapshotId: string, maxRepositories = 500): MirrorResult[] {
  const root = fs.realpathSync(rootInput);
  const snapshot = listEnterpriseSnapshots(root).find(s => s.snapshotId === snapshotId);
  if (!snapshot) throw new Error('Snapshot does not exist');
  const home = path.join(enterpriseStoreFor(root), 'mirrors');
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const results: MirrorResult[] = [];
  for (const repo of snapshot.repositories.slice(0, Math.max(1, Math.min(maxRepositories, 500)))) {
    const source = fs.realpathSync(path.join(root, repo.path));
    if (source !== root && !source.startsWith(root + path.sep)) throw new Error('Source repository escaped workspace');
    const id = hash(repo.path || '.').slice(0, 32);
    const destination = path.join(home, id + '.git');
    try {
      if (!fs.existsSync(destination)) {
        const temp = path.join(home, '.stage-' + randomUUID());
        try {
          // No hard links, no network, no mutations in original checkout.
          execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'clone', '--mirror', '--no-hardlinks', '--local', source, temp], {
            encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
          });
          assertIsolatedManagedMirror(temp);
          fs.renameSync(temp, destination);
        } finally { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true }); }
      } else {
        assertIsolatedManagedMirror(destination);
        // Fetch only from the authorized local checkout; never from remote.origin.url.
        git(destination, ['fetch', '--no-tags', '--force', source,
          '+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*']);
      }
      assertIsolatedManagedMirror(destination);
      // Pinned commit can be reachable without a branch in a local checkout.
      // Reject rather than claiming that a missing object was archived.
      const commit = git(destination, ['rev-parse', '--verify', repo.commit + '^{commit}']);
      const tree = git(destination, ['rev-parse', '--verify', repo.commit + '^{tree}']);
      if (commit !== repo.commit || tree !== repo.tree) throw new Error('Pinned commit or tree absent in mirror');
      // Prevent future accidental network fetch: a mirror is always sourced from this local checkout.
      git(destination, ['remote', 'set-url', 'origin', source]);
      results.push({repository:repo.path,snapshotCommit:repo.commit,status:'verified',mirrorPath:destination});
    } catch(error) {
      results.push({repository:repo.path,snapshotCommit:repo.commit,status:'blocked',
        reason:error instanceof Error ? error.message.slice(0,300) : String(error)});
    }
  }
  return results;
}
