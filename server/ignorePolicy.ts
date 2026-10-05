/**
 * Central, explicit ignore policy.
 *
 * The point is not to hide user files, but to skip generated/scaffold
 * directories that are extremely expensive to scan and almost never carry
 * first-class project assets. All ignore decisions live here so no component
 * re-implements its own rule.
 */

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'target',
  '.cache',
  '.asset-workbench-data',
  '.idea',
  '.vscode',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'out',
  '.turbo',
  '.output',
  '.parcel-cache',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.nox',
  '.gradle',
  '.settings',
]);

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', 'ehthumbs.db']);

const IGNORED_FILE_EXT = new Set(['.tmp', '.swp', '.swo']);

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

export function isIgnoredFile(name: string): boolean {
  if (IGNORED_FILES.has(name)) return true;
  // Managed-asset relation sidecars: visual clutter only, never shown in the tree.
  if (name === 'metadata.json' || name.endsWith('.metadata.json')) return true;
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return IGNORED_FILE_EXT.has(name.slice(dot).toLowerCase());
}

/** Decide whether to skip one directory entry during scan / watch descent. */
export function shouldIgnoreEntry(parentRel: string, name: string, isDir: boolean): boolean {
  return isDir ? isIgnoredDir(name) : isIgnoredFile(name);
}

/** True when any path segment is an ignored directory (used by the watcher). */
export function isIgnoredPath(absolutePath: string): boolean {
  const parts = absolutePath.split(/[\\/]/);
  return parts.some((p) => isIgnoredDir(p));
}
