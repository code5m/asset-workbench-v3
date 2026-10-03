import { normalizeRelative, resolveWithinRoot, PathEscapeError } from './pathGuard.ts';

/**
 * Write policy for Managed Knowledge Assets.
 *
 * The workbench may only create knowledge assets under an explicit managed area.
 * It must never be able to overwrite application source code, config, Git data,
 * or escape the workspace root. Everything flows through assertManagedWritable().
 */

/** Top-level directories the workbench is allowed to write knowledge assets into. */
export const MANAGED_ROOTS = ['04-conversations', '02-design', '03-docs', '05-derived'] as const;

/** Files that must never be written through the managed-asset API. */
const FORBIDDEN_EXACT = new Set([
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'README.md',
  'AGENTS.md',
]);

export class WritePolicyError extends Error {
  attempted: string;
  constructor(attempted: string, reason: string) {
    super(`write denied (${reason}): ${attempted}`);
    this.name = 'WritePolicyError';
    this.attempted = attempted;
  }
}

/** True when `rel` resolves to an allowed managed knowledge area (no escape, no forbidden file). */
export function isManagedWritableRelative(rel: string): boolean {
  let norm: string;
  try {
    norm = normalizeRelative(rel);
  } catch {
    return false;
  }
  if (norm === '') return false;
  const top = norm.split('/')[0];
  if (!MANAGED_ROOTS.includes(top as (typeof MANAGED_ROOTS)[number])) return false;
  if (FORBIDDEN_EXACT.has(norm)) return false;
  return true;
}

/**
 * Validate a relative target path and return its absolute, root-confined path.
 *
 * Throws PathEscapeError on `..` / absolute escape, WritePolicyError when the
 * target is outside the managed area or is a protected file.
 */
export function assertManagedWritable(root: string, rel: string): string {
  let norm: string;
  try {
    norm = normalizeRelative(rel);
  } catch {
    throw new WritePolicyError(rel, 'path escapes workspace root (.. or absolute)');
  }
  if (norm === '') throw new WritePolicyError(rel, 'empty path');
  const top = norm.split('/')[0];
  if (!MANAGED_ROOTS.includes(top as (typeof MANAGED_ROOTS)[number])) {
    throw new WritePolicyError(
      rel,
      `top-level directory '${top}' is not a managed knowledge area (allowed: ${MANAGED_ROOTS.join(', ')})`,
    );
  }
  if (FORBIDDEN_EXACT.has(norm)) {
    throw new WritePolicyError(rel, 'protected file');
  }
  // resolveWithinRoot re-validates symlink-free containment under the root.
  return resolveWithinRoot(root, norm);
}
