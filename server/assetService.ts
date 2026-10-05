import fs from 'node:fs';
import path from 'node:path';
import { getProjectRoot, setProjectRoot as persistRoot } from './config.ts';
import { scanDirectory, type DirectoryScanResult } from './assetScanner.ts';
import { readAssetContent } from './fileReader.ts';
import { AssetWatcher } from './assetWatcher.ts';
import { MANAGED_ROOTS } from './managedPathPolicy.ts';
import { recoverDurableTransactions } from './durableWrite.ts';
import { probeRepository } from './gitProbe.ts';
import type {
  AssetNode,
  AssetContent,
  ExpectedSkeletonEntry,
  ProjectWorkspace,
  RepositoryRevision,
  ServerEvent,
  TreeResponse,
} from '../src/domain/asset';

const EXPECTED_SKELETON: { path: string; assetType: ExpectedSkeletonEntry['assetType'] }[] = [
  { path: '00-introduction', assetType: 'introduction' },
  { path: '01-code', assetType: 'code' },
  { path: '02-design', assetType: 'design' },
  { path: '03-docs', assetType: 'document' },
  { path: '04-conversations', assetType: 'conversation' },
  { path: '05-derived', assetType: 'derived' },
];

const MAX_DIRECTORY_CACHE = 96;

export class AssetService {
  private cache = new Map<string, DirectoryScanResult>();
  private watcher: AssetWatcher | null = null;
  private listeners = new Set<(e: ServerEvent) => void>();
  private lastScannedAt: string | undefined;
  private recoveredRoot: string | null = null;

  async ensureScanned(): Promise<void> {
    if (!this.cache.has('')) this.loadDirectory('');
  }

  async scan(): Promise<TreeResponse> {
    this.cache.clear();
    this.watcher?.resetToRoot();
    const result = this.loadDirectory('');
    return this.toTreeResponse(result);
  }

  private touch(key: string, value: DirectoryScanResult): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > MAX_DIRECTORY_CACHE) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
      this.watcher?.unwatchDirectory(oldest);
    }
  }

  private loadDirectory(parentRel: string): DirectoryScanResult {
    const root = getProjectRoot();
    if (this.recoveredRoot !== root) {
      recoverDurableTransactions(root, MANAGED_ROOTS);
      this.recoveredRoot = root;
    }
    const result = scanDirectory(root, parentRel);
    this.touch(parentRel, result);
    this.lastScannedAt = result.parent.modifiedAt;
    this.watcher?.watchDirectory(parentRel);
    return result;
  }

  private getDirectory(parentRel: string): DirectoryScanResult {
    const cached = this.cache.get(parentRel);
    if (cached) {
      this.touch(parentRel, cached);
      this.watcher?.watchDirectory(parentRel);
      return cached;
    }
    return this.loadDirectory(parentRel);
  }

  private loadedCounts(): { nodeCount: number; fileCount: number; directoryCount: number } {
    const seen = new Set<string>();
    let fileCount = 0;
    let directoryCount = 0;
    for (const result of this.cache.values()) {
      for (const node of result.children) {
        if (seen.has(node.relativePath)) continue;
        seen.add(node.relativePath);
        if (node.kind === 'file') fileCount += 1;
        else directoryCount += 1;
      }
    }
    return { nodeCount: seen.size, fileCount, directoryCount };
  }

  private toTreeResponse(result: DirectoryScanResult): TreeResponse {
    const counts = this.loadedCounts();
    const parent: AssetNode = { ...result.parent };
    delete parent.children;
    const children = result.children.map((node) => {
      const shallow = { ...node };
      delete shallow.children;
      return shallow;
    });
    return {
      parent,
      children,
      ...counts,
      statsScope: 'loaded',
      cachedDirectoryCount: this.cache.size,
    };
  }

  getTree(parentRel = ''): TreeResponse {
    return this.toTreeResponse(this.getDirectory(parentRel));
  }

  getNode(rel: string): AssetNode {
    if (!rel) return this.getDirectory('').parent;
    const parent = path.posix.dirname(rel);
    const parentRel = parent === '.' ? '' : parent;
    const found = this.getDirectory(parentRel).children.find((node) => node.relativePath === rel);
    if (!found) throw new Error(`node not found: ${rel}`);
    return found;
  }

  getContent(rel: string): AssetContent {
    return readAssetContent(getProjectRoot(), rel);
  }

  getRepositories(): RepositoryRevision[] {
    const byId = new Map<string, RepositoryRevision>();
    const root = getProjectRoot();
    if (fs.existsSync(path.join(root, '.git'))) {
      const rev = probeRepository(root, '');
      if (rev) byId.set(rev.repositoryId, rev);
    }
    for (const result of this.cache.values()) {
      for (const rev of result.repositories) byId.set(rev.repositoryId, rev);
    }
    return [...byId.values()];
  }

  getExpectedSkeleton(): ExpectedSkeletonEntry[] {
    const root = getProjectRoot();
    return EXPECTED_SKELETON.map((entry) => {
      const abs = path.join(root, entry.path);
      if (!fs.existsSync(abs)) return { ...entry, status: 'MISSING' as const };
      let status: ExpectedSkeletonEntry['status'] = 'PARTIAL';
      try {
        status = fs.readdirSync(abs).length > 0 ? 'FOUND' : 'PARTIAL';
      } catch { status = 'PARTIAL'; }
      return { ...entry, status };
    });
  }

  getWorkspace(): ProjectWorkspace {
    return {
      id: 'asset-workbench',
      name: path.basename(getProjectRoot()),
      rootPath: getProjectRoot(),
      lastScannedAt: this.lastScannedAt,
      status: this.cache.size > 0 ? 'ready' : 'scanning',
    };
  }

  invalidate(paths: string[]): void {
    const invalidated = new Set<string>();
    for (const raw of paths) {
      let current = raw;
      while (true) {
        if (this.cache.delete(current)) {
          invalidated.add(current);
          this.watcher?.unwatchDirectory(current);
        }
        if (!current) break;
        const parent = path.posix.dirname(current);
        current = parent === '.' ? '' : parent;
      }
    }
    const scannedAt = new Date().toISOString();
    this.lastScannedAt = scannedAt;
    this.emit({ type: 'refresh', scannedAt, invalidatedPaths: [...invalidated] });
  }

  startWatcher(): void {
    if (this.watcher) return;
    this.watcher = new AssetWatcher(getProjectRoot(), (paths) => this.invalidate(paths));
    this.watcher.start();
    for (const rel of this.cache.keys()) this.watcher.watchDirectory(rel);
  }

  restartWatcher(): void {
    this.watcher?.stop();
    this.watcher = null;
    this.startWatcher();
  }

  changeRoot(rootPath: string): void {
    persistRoot(rootPath);
    this.cache.clear();
    this.lastScannedAt = undefined;
    this.recoveredRoot = null;
    this.restartWatcher();
  }

  subscribe(listener: (e: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ServerEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* listener errors do not break broadcast */ }
    }
  }
}

export const assetService = new AssetService();
