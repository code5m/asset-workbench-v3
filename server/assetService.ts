import { getProjectRoot, setProjectRoot as persistRoot } from './config.ts';
import { scanProject, type ScanResult } from './assetScanner.ts';
import { readAssetContent } from './fileReader.ts';
import { AssetWatcher } from './assetWatcher.ts';
import { isIgnoredPath } from './ignorePolicy.ts';
import type {
  AssetNode,
  AssetContent,
  ExpectedSkeletonEntry,
  ProjectWorkspace,
  RepositoryRevision,
  ServerEvent,
  TreeResponse,
} from '../src/domain/asset';

/**
 * AssetService is the single in-memory owner of the discovered asset state.
 *
 * Scanner and watcher both funnel through here. The frontend only ever reads
 * this state (via the API). There is no second "watcher state" — a filesystem
 * change triggers a re-scan that rebuilds the exact same structure.
 */

const EXPECTED_SKELETON: { path: string; assetType: ExpectedSkeletonEntry['assetType'] }[] = [
  { path: '00-introduction', assetType: 'introduction' },
  { path: '01-code', assetType: 'code' },
  { path: '02-design', assetType: 'design' },
  { path: '03-docs', assetType: 'document' },
  { path: '04-conversations', assetType: 'conversation' },
  { path: '05-derived', assetType: 'derived' },
];

export class AssetService {
  private scanPromise: Promise<ScanResult> | null = null;
  private lastResult: ScanResult | null = null;
  private watcher: AssetWatcher | null = null;
  private listeners = new Set<(e: ServerEvent) => void>();

  ensureScanned(): Promise<ScanResult> {
    if (!this.scanPromise) this.scanPromise = this.doScan();
    return this.scanPromise;
  }

  async scan(): Promise<ScanResult> {
    this.scanPromise = this.doScan();
    return this.scanPromise;
  }

  private async doScan(): Promise<ScanResult> {
    const result = scanProject(getProjectRoot());
    this.lastResult = result;
    this.emit({
      type: 'scan',
      scannedAt: result.root.modifiedAt,
      nodeCount: result.nodeCount,
      fileCount: result.fileCount,
      directoryCount: result.directoryCount,
    });
    return result;
  }

  private requireResult(): ScanResult {
    if (!this.lastResult) throw new Error('asset scan not ready');
    return this.lastResult;
  }

  getTree(parentRel = ''): TreeResponse {
    const result = this.requireResult();
    const parent = parentRel === '' ? result.root : result.nodeMap.get(parentRel);
    if (!parent) throw new Error(`node not found: ${parentRel}`);
    return {
      parent,
      children: parent.children ?? [],
      nodeCount: result.nodeCount,
      fileCount: result.fileCount,
      directoryCount: result.directoryCount,
    };
  }

  getNode(rel: string): AssetNode {
    return this.requireResult().nodeMap.get(rel) ?? this.requireResult().root;
  }

  getContent(rel: string): AssetContent {
    const root = getProjectRoot();
    return readAssetContent(root, rel);
  }

  getRepositories(): RepositoryRevision[] {
    return this.requireResult().repositories;
  }

  getExpectedSkeleton(): ExpectedSkeletonEntry[] {
    const result = this.requireResult();
    return EXPECTED_SKELETON.map((entry) => {
      const node = result.nodeMap.get(entry.path);
      let status: ExpectedSkeletonEntry['status'] = 'MISSING';
      if (node) {
        status = (node.children?.length ?? 0) === 0 ? 'PARTIAL' : 'FOUND';
      }
      return { path: entry.path, assetType: entry.assetType, status };
    });
  }

  getWorkspace(): ProjectWorkspace {
    const result = this.lastResult;
    return {
      id: 'asset-workbench',
      name: result ? result.root.name : 'asset-workbench',
      rootPath: getProjectRoot(),
      lastScannedAt: result?.root.modifiedAt,
      status: result ? 'ready' : 'scanning',
    };
  }

  startWatcher(): void {
    if (this.watcher) return;
    this.watcher = new AssetWatcher(getProjectRoot(), () => {
      this.scan().catch((e) => this.emit({ type: 'error', message: String((e as Error)?.message ?? e) }));
    });
    this.watcher.start();
  }

  restartWatcher(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    this.startWatcher();
  }

  changeRoot(rootPath: string): void {
    persistRoot(rootPath);
    this.restartWatcher();
  }

  subscribe(listener: (e: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ServerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // listener errors must not break the broadcast
      }
    }
  }
}

export const assetService = new AssetService();
