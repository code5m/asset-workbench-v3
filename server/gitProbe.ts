import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RepositoryRevision } from '../src/domain/asset';

/**
 * Read-only Git repository probe.
 *
 * Only identity/version-evidence commands are allowed. This module must never
 * run git checkout / pull / merge / commit / push / reset / clean / stash. The
 * workbench treats the user's checkout as read-only.
 */

function git(dir: string, args: string[]): string | null {
  try {
    const out = execFileSync('git', ['-C', dir, ...args], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.toString('utf8').trim();
  } catch {
    return null;
  }
}

export function probeRepository(dir: string, rel: string): RepositoryRevision | null {
  const head = git(dir, ['rev-parse', 'HEAD']);
  if (head == null || head === '') return null;

  const remote = git(dir, ['config', '--get', 'remote.origin.url']) || undefined;
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']) || undefined;
  const status = git(dir, ['status', '--porcelain']);

  let modifiedCount = 0;
  let untrackedCount = 0;
  if (status) {
    for (const line of status.split('\n')) {
      if (!line) continue;
      if (line.startsWith('??')) untrackedCount += 1;
      else modifiedCount += 1;
    }
  }
  const dirty = modifiedCount + untrackedCount > 0;

  const originMasterCommit = git(dir, ['rev-parse', 'origin/master']) || undefined;
  const originMainCommit = git(dir, ['rev-parse', 'origin/main']) || undefined;

  return {
    repositoryId: rel || path.basename(dir),
    path: rel,
    branch: branch || undefined,
    remote,
    headCommit: head,
    dirty,
    modifiedCount,
    untrackedCount,
    originMasterCommit,
    originMainCommit,
  };
}
