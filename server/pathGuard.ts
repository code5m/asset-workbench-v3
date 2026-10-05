import fs from 'node:fs';
import path from 'node:path';

/**
 * Path safety boundary.
 *
 * Every filesystem read goes through resolveWithinRoot(), and reads are further
 * verified with assertWithinRoot() which resolves symlinks so a symlink inside
 * the project root cannot be used to escape to /etc, /home, etc.
 */

export class PathEscapeError extends Error {
  attempted: string;
  constructor(attempted: string) {
    super(`path escapes project root: ${attempted}`);
    this.name = 'PathEscapeError';
    this.attempted = attempted;
  }
}

/** Normalize a relative path: forward slashes, no leading slash, no `..` escapes. */
export function normalizeRelative(input: string): string {
  const cleaned = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith('..')) {
    throw new PathEscapeError(input);
  }
  return normalized === '.' ? '' : normalized;
}

/** Resolve a relative path against the root and prove it stays inside the root. */
export function resolveWithinRoot(root: string, relativePath: string): string {
  const rel = normalizeRelative(relativePath);
  const target = rel === '' ? path.resolve(root) : path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    throw new PathEscapeError(relativePath);
  }
  return target;
}

/** Verify the final (symlink-resolved) absolute path still lives under root. */
export function assertWithinRoot(root: string, absolutePath: string): void {
  const rootResolved = safeRealpath(path.resolve(root));
  const target = safeRealpath(path.resolve(absolutePath));
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    throw new PathEscapeError(absolutePath);
  }
}

function safeRealpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}


/**
 * Verify a write target without requiring the final file/directory to exist.
 * The nearest existing ancestor is realpath-resolved so a managed-path symlink
 * cannot redirect a write outside the project root.
 */
export function assertWriteTargetWithinRoot(root: string, absolutePath: string): void {
  const rootResolved = safeRealpath(path.resolve(root));
  const targetResolved = path.resolve(absolutePath);
  if (targetResolved !== path.resolve(root) && !targetResolved.startsWith(path.resolve(root) + path.sep)) {
    throw new PathEscapeError(absolutePath);
  }

  let probe = targetResolved;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const realAncestor = safeRealpath(probe);
  if (realAncestor !== rootResolved && !realAncestor.startsWith(rootResolved + path.sep)) {
    throw new PathEscapeError(absolutePath);
  }
}
