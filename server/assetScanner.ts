import fs from 'node:fs';
import path from 'node:path';
import { classify, detectCodeLanguage, resolveManagedType } from './assetClassifier.ts';
import { shouldIgnoreEntry } from './ignorePolicy.ts';
import { probeRepository } from './gitProbe.ts';
import { resolveWithinRoot, assertWithinRoot } from './pathGuard.ts';
import type { AssetNode, RepositoryRevision } from '../src/domain/asset';

export interface DirectoryScanResult {
  parent: AssetNode;
  children: AssetNode[];
  repositories: RepositoryRevision[];
  fileCount: number;
  directoryCount: number;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function statSafe(p: string): fs.Stats | null {
  try { return fs.statSync(p); } catch { return null; }
}

function shallowNode(projectRoot: string, rel: string, name: string, isDir: boolean, st: fs.Stats | null): AssetNode {
  const node: AssetNode = {
    id: rel,
    name,
    relativePath: rel,
    kind: isDir ? 'directory' : 'file',
    assetType: classify(rel, isDir),
    managedType: resolveManagedType(projectRoot, rel),
    size: isDir ? 0 : (st?.size ?? 0),
    modifiedAt: iso(st?.mtimeMs ?? Date.now()),
    extension: isDir ? '' : extOf(name),
    sourceKind: 'discovered',
    exists: true,
  };
  if (!isDir) node.codeLanguage = detectCodeLanguage(rel);
  return node;
}

/**
 * Read exactly one filesystem level.
 *
 * Important performance invariant: a parent directory is read once. We do not
 * readdir every child directory just to precompute grandchildren counts. Those
 * counts are populated when that child is explicitly opened.
 */
export function scanDirectory(root: string, parentRel = ''): DirectoryScanResult {
  const abs = resolveWithinRoot(root, parentRel);
  assertWithinRoot(root, abs);
  const parentStat = statSafe(abs);
  if (!parentStat?.isDirectory()) throw new Error(`directory not found: ${parentRel || '/'}`);

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { entries = []; }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const visible = entries.filter((entry) => {
    if (entry.name === '.git' || entry.isSymbolicLink()) return false;
    return !shouldIgnoreEntry(parentRel, entry.name, entry.isDirectory());
  });

  const parentFileCount = visible.filter((entry) => !entry.isDirectory()).length;
  const parent: AssetNode = {
    id: parentRel,
    name: parentRel ? path.basename(parentRel) : path.basename(root),
    relativePath: parentRel,
    kind: 'directory',
    assetType: classify(parentRel, true),
    managedType: parentRel ? resolveManagedType(root, parentRel) : undefined,
    size: 0,
    modifiedAt: iso(parentStat.mtimeMs),
    extension: '',
    sourceKind: 'discovered',
    exists: true,
    childCount: visible.length,
    fileCount: parentFileCount,
  };

  const repositories: RepositoryRevision[] = [];
  if (fs.existsSync(path.join(abs, '.git'))) {
    const rev = probeRepository(abs, parentRel);
    if (rev) {
      parent.git = rev;
      repositories.push(rev);
    }
  }

  const children: AssetNode[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  for (const entry of visible) {
    const isDir = entry.isDirectory();
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name;
    const childAbs = path.join(abs, entry.name);
    const st = statSafe(childAbs);
    const node = shallowNode(root, rel, entry.name, isDir, st);
    if (isDir) {
      // Unknown until this directory is opened. Zero here would falsely mean
      // "known empty", so omit both optional counts.
      if (fs.existsSync(path.join(childAbs, '.git'))) {
        const rev = probeRepository(childAbs, rel);
        if (rev) {
          node.git = rev;
          repositories.push(rev);
        }
      }
      directoryCount += 1;
    } else {
      fileCount += 1;
    }
    children.push(node);
  }

  return { parent, children, repositories, fileCount, directoryCount };
}
