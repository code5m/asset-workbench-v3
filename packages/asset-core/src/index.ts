import type { AssetKind } from '../../protocol/src/asset.ts';

export interface AssetSkeletonEntry {
  path: string;
  assetType: AssetKind;
  description: string;
}

export const DEFAULT_ASSET_SKELETON: readonly AssetSkeletonEntry[] = [
  { path: '00-introduction', assetType: 'introduction', description: 'Project introduction and entry point' },
  { path: '01-code', assetType: 'code', description: 'Code assets and repositories' },
  { path: '02-design', assetType: 'design', description: 'Designs, architecture, and decisions' },
  { path: '03-docs', assetType: 'document', description: 'Project documents and guides' },
  { path: '04-conversations', assetType: 'conversation', description: 'Transcripts and Agent Work Records' },
  { path: '05-derived', assetType: 'derived', description: 'Derived indexes, graphs, and analysis' },
] as const;
