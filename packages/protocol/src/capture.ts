export type CaptureProvider =
  | 'chatgpt'
  | 'codex'
  | 'codebuddy'
  | 'trae'
  | 'opencode'
  | 'codearts'
  | 'workbuddy'
  | 'other';

export type CaptureSource =
  | 'native-hook'
  | 'acp'
  | 'provider-api'
  | 'import'
  | 'manual'
  | 'test'
  | 'other';

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
