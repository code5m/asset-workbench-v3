import type { LucideIcon } from 'lucide-react';
import type { LStr } from '../i18n/translations';

export type StepState = 'ready' | 'active' | 'blocked' | 'future' | 'done';

export type RepositoryStatus = 'included' | 'warning' | 'unavailable';

export type ImportStatus = 'verified' | 'pending' | 'blocked';

export type ReleaseObservationStatus = 'matched' | 'drift' | 'missing';

export type AppSection = 'welcome' | 'guide' | 'assets' | 'console';

export type AssetKind = 'code' | 'design' | 'document' | 'conversation' | 'derived';

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: LStr;
  discoveryRoot: string;
  repositoryIdentity: string;
  mirrorRoot: string;
  captureMode: string;
  consistencyLevel: string;
}

export interface RepositoryCandidate {
  id: string;
  name: string;
  relativePath: string;
  remote: string;
  localState: string;
  factRef: string;
  factCommit: string;
  factTree: string;
  releaseRef: string;
  releaseCommit: string;
  releaseStatus: ReleaseObservationStatus;
  reason: LStr;
  status: RepositoryStatus;
}

export interface WorkspaceVersionSummary {
  id: string;
  label: LStr;
  compositionDigest: string;
  memberCount: number;
  capturedAt: string;
  rawLayout: string;
}

export interface SourceLayer {
  label: LStr;
  value: LStr;
  detail: LStr;
}

export interface RawImportItem {
  repositoryId: string;
  repositoryName: string;
  commit: string;
  tree: string;
  files: number;
  status: ImportStatus;
}

export interface WizardStep {
  id: string;
  title: LStr;
  eyebrow: LStr;
  state: StepState;
  icon: LucideIcon;
}

export interface MetricCard {
  label: LStr;
  value: string;
  detail: LStr;
}

export interface PipelineNote {
  text: LStr;
  warn: boolean;
}

export interface NavigationItem {
  id: AppSection;
  title: LStr;
  eyebrow: LStr;
  icon: LucideIcon;
}

export interface ExplainerStep {
  title: LStr;
  body: LStr;
}

export interface AssetCategory {
  id: AssetKind;
  name: LStr;
  path: string;
  description: LStr;
  count: number;
  indexed: number;
  icon: LucideIcon;
}

export interface AssetTreeNode {
  id: string;
  name: string;
  path: string;
  kind: AssetKind;
  type: 'directory' | 'file';
  source: LStr;
  summary: LStr;
  children?: AssetTreeNode[];
}

export interface AssetDetail {
  id: string;
  name: string;
  path: string;
  kind: AssetKind;
  assetType: LStr;
  source: LStr;
  version: string;
  updatedAt: string;
  summary: LStr;
  related: string[];
  preview: LStr;
}

/**
 * A real, directly readable project file surfaced on the welcome page.
 *
 * `path` is a real relative path inside the project root. Existence is never
 * assumed here: it is resolved at runtime from the Local Asset Engine.
 */
export interface KeyDocument {
  name: string;
  path: string;
  description: LStr;
}
