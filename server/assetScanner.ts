import fs from 'node:fs';
import path from 'node:path';
import { classify, resolveManagedType } from './assetClassifier.ts';
import { shouldIgnoreEntry } from './ignorePolicy.ts';
import { probeRepository } from './gitProbe.ts';
import type { AssetNode, RepositoryRevision } from '../src/domain/asset';

/**
 * Recursive scanner. Produces the single, authoritative discovered asset tree.
 *
 * The scanner is the ONLY source of the directory tree. The watcher never
 * builds a second tree; it triggers a re-scan and the same code path builds the
 * same structure, so the frontend always reads one state.
 */

export interface ScanResult {
  root: AssetNode;
  nodeMap: Map<string, AssetNode>;
  repositories: RepositoryRevision[];
  nodeCount: number;
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
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

export function scanProject(root: string): ScanResult {
  const nodeMap = new Map<string, AssetNode>();
  const repositories: RepositoryRevision[] = [];
  let nodeCount = 0;
  let fileCount = 0;
  let directoryCount = 0;

  const rootStat = statSafe(root) ?? { mtimeMs: Date.now() };
  const rootNode: AssetNode = {
    id: '',
    name: path.basename(root),
    relativePath: '',
    kind: 'directory',
    assetType: classify('', true),
    size: 0,
    modifiedAt: iso(rootStat.mtimeMs),
    extension: '',
    sourceKind: 'discovered',
    exists: true,
    childCount: 0,
    fileCount: 0,
  };

  // The project root itself may be a Git repository.
  if (fs.existsSync(path.join(root, '.git'))) {
    const rev = probeRepository(root, '');
    if (rev) {
      rootNode.git = rev;
      repositories.push(rev);
    }
  }

  walk(root, root, '', rootNode, nodeMap, repositories, (node) => {
    nodeCount += 1;
    if (node.kind === 'file') fileCount += 1;
    else directoryCount += 1;
  });

  nodeMap.set('', rootNode);
  return { root: rootNode, nodeMap, repositories, nodeCount, fileCount, directoryCount };
}

function walk(
  projectRoot: string,
  dir: string,
  parentRel: string,
  parentNode: AssetNode,
  nodeMap: Map<string, AssetNode>,
  repositories: RepositoryRevision[],
  onCount: (node: AssetNode) => void,
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const e of entries) {
    if (e.name === '.git') continue;
    const isDir = e.isDirectory();
    if (shouldIgnoreEntry(parentRel, e.name, isDir)) continue;

    const rel = parentRel ? `${parentRel}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    const st = statSafe(abs);

    if (isDir) {
      const node: AssetNode = {
        id: rel,
        name: e.name,
        relativePath: rel,
        kind: 'directory',
        assetType: classify(rel, true),
        managedType: resolveManagedType(projectRoot, rel),
        size: 0,
        modifiedAt: st ? iso(st.mtimeMs) : iso(Date.now()),
        extension: '',
        sourceKind: 'discovered',
        exists: true,
        childCount: 0,
        fileCount: 0,
      };
      if (fs.existsSync(path.join(abs, '.git'))) {
        const rev = probeRepository(abs, rel);
        if (rev) {
          node.git = rev;
          repositories.push(rev);
        }
      }
      parentNode.children = parentNode.children ?? [];
      parentNode.children.push(node);
      nodeMap.set(rel, node);
      onCount(node);
      parentNode.childCount = (parentNode.childCount ?? 0) + 1;
      walk(projectRoot, abs, rel, node, nodeMap, repositories, onCount);
    } else {
      const size = st ? st.size : 0;
      const node: AssetNode = {
        id: rel,
        name: e.name,
        relativePath: rel,
        kind: 'file',
        assetType: classify(rel, false),
        managedType: resolveManagedType(projectRoot, rel),
        size,
        modifiedAt: st ? iso(st.mtimeMs) : iso(Date.now()),
        extension: extOf(e.name),
        sourceKind: 'discovered',
        exists: true,
      };
      parentNode.children = parentNode.children ?? [];
      parentNode.children.push(node);
      nodeMap.set(rel, node);
      onCount(node);
      parentNode.childCount = (parentNode.childCount ?? 0) + 1;
      parentNode.fileCount = (parentNode.fileCount ?? 0) + 1;
    }
  }
}
