/**
 * Shared Asset Engine contract.
 *
 * This is the single source of truth for the wire format exchanged between the
 * Local Asset Runtime (Vite dev middleware) and the React frontend. The server
 * modules import these types so the on-the-wire shape is defined exactly once.
 *
 * Single semantic rule: the filesystem is the first discovery source. A Git
 * remote is repository identity. A WorkspaceVersion is a future frozen project
 * version. Do not introduce parallel snapshot concepts here.
 */

export type AssetKind =
  | 'introduction'
  | 'code'
  | 'design'
  | 'document'
  | 'conversation'
  | 'derived'
  | 'other';

/**
 * The three managed knowledge asset types. These are semantic layers, NOT three
 * directories with the same format:
 *
 * - conversation = process evidence (raw discussion / reasoning)
 * - design       = a formal design proposal
 * - decision     = an accepted ruling the system should obey
 *
 * `decision` lives inside `02-design/decisions/` but is a distinct semantic type,
 * so the logical `assetType` (category) stays `design` while `managedType` is
 * `decision`.
 */
/**
 * Managed knowledge asset type. `conversation` is kept for backward-compatible
 * legacy files (pre dual-evidence-model). The two distinct dual-evidence types
 * are `conversation-transcript` (raw/original chat) and `agent-work-record`
 * (structured Agent work record). Never conflate them.
 */
export type ManagedAssetType =
  | 'conversation'
  | 'conversation-transcript'
  | 'agent-work-record'
  | 'design'
  | 'decision';

/**
 * Whether a real, original transcript was obtained for an AgentSession.
 * - available: a full original transcript was captured from the platform
 * - partial: only a partial original transcript was obtainable
 * - imported: the user imported a transcript file (export / markdown / json)
 * - unavailable: the platform exposes no programmatic transcript; only a Work
 *   Record is produced. This is an HONEST, supported state — never fake it.
 */
export type TranscriptCaptureStatus = 'available' | 'partial' | 'imported' | 'unavailable';

/** Completeness of a captured/imported transcript. */
export type TranscriptCompleteness = 'full' | 'partial' | 'unknown';

/** Stable source enum for conversations. Never free-form strings. */
export type ConversationSource = 'chatgpt' | 'codex' | 'codebuddy' | 'opencode' | 'trae' | 'codearts' | 'workbuddy' | 'manual' | 'other';

export type DecisionStatus = 'Accepted' | 'Proposed' | 'Superseded' | 'Deprecated';

/**
 * How a conversation asset was captured. Distinguishes a real exported chat
 * transcript from an Agent's structured work record. We never fake a full
 * transcript when the runtime cannot export one.
 */
export type CaptureMode = 'full-transcript' | 'agent-work-record' | 'imported-transcript' | 'manual';

/** Provider identity carried as data by the capture kernel, never a switch for provider-specific logic. */
export type CaptureProvider = 'chatgpt' | 'codex' | 'codebuddy' | 'trae' | 'opencode' | 'codearts' | 'workbuddy' | 'other';
export type CaptureSource = 'native-hook' | 'acp' | 'provider-api' | 'import' | 'manual' | 'test' | 'other';
export type CaptureEventType =
  | 'session.started'
  | 'user.message'
  | 'assistant.message'
  | 'system.message'
  | 'tool.started'
  | 'tool.completed'
  | 'file.changed'
  | 'session.compacted'
  | 'artifact.produced'
  | 'session.ended';

/** The provider-neutral record persisted in capture `events.jsonl`. */
export interface CanonicalCaptureEvent {
  schemaVersion: 1;
  eventId: string;
  provider: CaptureProvider;
  providerSessionId: string;
  captureSessionId: string;
  workspaceId: string;
  eventType: CaptureEventType;
  sequence?: number;
  timestamp: string;
  actor?: string;
  content?: string;
  parentEventId?: string;
  parentSessionId?: string;
  toolCall?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  affectedFiles?: string[];
  attachments?: Array<Record<string, unknown>>;
  captureSource: CaptureSource;
}

export interface CaptureSession {
  schemaVersion: 1;
  captureSessionId: string;
  provider: CaptureProvider;
  providerSessionId: string;
  workspaceId: string;
  captureSource: CaptureSource;
  status: 'active' | 'ended' | 'interrupted' | 'failed';
  firstSequence?: number;
  lastSequence?: number;
  sequenceGaps: Array<{ after: number; before: number }>;
  orderingWarnings: string[];
  startedAt: string;
  lastEventAt?: string;
  endedAt?: string;
  agentSessionId?: string;
  transcriptAssetId?: string;
}

/** Agent identity. Kept in sync with ConversationSource so Session and Conversation align. */
export type AgentType = 'chatgpt' | 'codex' | 'codebuddy' | 'opencode' | 'trae' | 'codearts' | 'workbuddy' | 'manual' | 'other';

/**
 * Single machine-readable relation record. Markdown shows human links; this is
 * the canonical source for the promotion chain. Stored as a sidecar metadata
 * file next to the Markdown content (never inferred from filenames alone).
 */
export interface ManagedAssetMetadata {
  /** Metadata schema version. New assets always write 1; legacy assets without this field are treated as v1. */
  schemaVersion: number;
  id: string;
  type: ManagedAssetType;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** conversation only */
  source?: ConversationSource;
  /** conversation only: how the evidence was captured */
  captureMode?: CaptureMode;
  /**
   * Transcript completeness (only meaningful for conversation-transcript).
   * - full: the entire original conversation was captured/imported
   * - partial: only part of the original conversation was obtainable
   * - unknown: completeness could not be determined
   */
  completeness?: TranscriptCompleteness;
  /** conversation-transcript: when the raw transcript was captured (may differ from createdAt for imports) */
  capturedAt?: string;
  /** conversation-transcript: id of the source platform session, if known */
  sourceSessionId?: string;
  /** agent-work-record / conversation-transcript: the AgentSession that produced/owns this asset */
  agentSessionId?: string;
  /** agent-work-record: id of the associated original transcript, if one exists */
  sourceTranscriptId?: string;
  /** agent-work-record: explicit truth about whether an original transcript was obtained */
  transcriptCaptureStatus?: TranscriptCaptureStatus;
  /** agent-work-record: id of the associated work record, if one exists (transcript side) */
  workRecordId?: string;
  /** platform-specific, non-core fields (provider, conversationId, ...). Never core model dependencies. */
  sourceMetadata?: Record<string, unknown>;
  /** design only */
  designArea?: string;
  /** decision only */
  status?: DecisionStatus;
  /** upstream ids this asset was promoted / derived from */
  sourceConversations?: string[];
  sourceDesigns?: string[];
  /** free-form related asset paths (any managed path) */
  relatedAssetPaths?: string[];
  /** conversation -> design/decision it was promoted into */
  promotedTo?: { type: 'design' | 'decision'; id: string }[];
  /** design -> decision it was promoted into */
  promotedToDecisions?: string[];
}

/**
 * A single Agent work-execution record. Distinct from a Conversation (which is
 * knowledge evidence). The session records what the agent did and which assets
 * it produced; it lives under the workbench runtime data, NOT in 04-conversations.
 */
export interface AgentSession {
  schemaVersion: number;
  id: string;
  agentType: AgentType;
  startedAt: string;
  completedAt: string | null;
  taskTitle: string;
  taskSummary: string;
  workspaceId: string;
  /** project root captured at preflight, used to detect cwd drift */
  projectRoot: string;
  captureMode: CaptureMode;
  /** captured = assets written; skipped = trivial change; pending = not yet decided */
  captureStatus: 'captured' | 'skipped' | 'pending';
  skipReason?: string;
  /** legacy/alias field: id of the produced Agent Work Record (conversation) asset */
  conversationAssetId?: string;
  /** id of the produced Agent Work Record asset (structured work record) */
  workRecordAssetId?: string;
  /** id of the produced original Transcript asset, if a real one was captured/imported */
  transcriptAssetId?: string;
  /** whether a real original transcript was obtained for this session */
  transcriptCaptureStatus: TranscriptCaptureStatus;
  resultingDesignIds: string[];
  resultingDecisionIds: string[];
  affectedAssetPaths: string[];
  /** active = running; closed = closure done; interrupted/stale = not cleanly closed */
  closureStatus: 'active' | 'closed' | 'interrupted' | 'stale';
  /** the closure input that produced this result, kept for traceability */
  closureInput?: Record<string, unknown>;
}

/** Payload returned by the managed-asset API for a single asset. */
export interface ManagedAssetView {
  id: string;
  type: ManagedAssetType;
  path: string;
  metadata: ManagedAssetMetadata;
}

/** Result returned after creating / promoting a managed asset. */
export interface ManagedAssetResult {
  id: string;
  type: ManagedAssetType;
  /** relative path of the Markdown content file */
  path: string;
  /** relative path of the metadata sidecar */
  metadataPath: string;
}

export type AssetSourceKind = 'discovered' | 'expected';

export type CodeLanguage =
  | 'java'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'other';

/** Read-only Git identity/version evidence for one discovered repository. */
export interface RepositoryRevision {
  repositoryId: string;
  path: string;
  branch?: string;
  remote?: string;
  headCommit?: string;
  dirty: boolean;
  modifiedCount: number;
  untrackedCount: number;
  originMasterCommit?: string;
  originMainCommit?: string;
}

/** One node in the real discovered asset tree. */
export interface AssetNode {
  id: string;
  name: string;
  relativePath: string;
  kind: 'file' | 'directory';
  assetType: AssetKind;
  size: number;
  modifiedAt: string;
  extension: string;
  sourceKind: AssetSourceKind;
  exists: boolean;
  childCount?: number;
  fileCount?: number;
  git?: RepositoryRevision;
  children?: AssetNode[];
  /** Semantic managed-asset type when the node lives in a managed knowledge area. */
  managedType?: ManagedAssetType;
  /** Programming language for code files when it can be determined cheaply from the path. */
  codeLanguage?: CodeLanguage;
}

export interface AssetManifest {
  workspaceId: string;
  projectRoot: string;
  scannedAt: string;
  root: AssetNode;
  nodeCount: number;
  fileCount: number;
  directoryCount: number;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  rootPath: string;
  createdAt?: string;
  lastScannedAt?: string;
  status: 'ready' | 'scanning' | 'error' | 'not-configured';
}

export type SkeletonStatus = 'FOUND' | 'MISSING' | 'PARTIAL';

export interface ExpectedSkeletonEntry {
  path: string;
  assetType: AssetKind;
  status: SkeletonStatus;
}

export interface AssetContent {
  id: string;
  path: string;
  previewable: boolean;
  truncated: boolean;
  size: number;
  content?: string;
  reason?: string;
}

export interface TreeResponse {
  /** Parent is intentionally shallow: it never embeds recursive children. */
  parent: AssetNode;
  /** Direct children only. Descendants are loaded with another /tree request. */
  children: AssetNode[];
  /** Counts describe the directories currently held in the bounded lazy cache, not the whole project. */
  nodeCount: number;
  fileCount: number;
  directoryCount: number;
  statsScope?: 'loaded';
  cachedDirectoryCount?: number;
}

export type ServerEvent =
  | { type: 'connected'; scannedAt?: string }
  | { type: 'scan'; scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number }
  | { type: 'refresh'; scannedAt: string; invalidatedPaths?: string[] }
  | { type: 'error'; message: string };
