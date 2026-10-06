export type ProviderAuthType =
  | 'none'
  | 'existing-session'
  | 'env'
  | 'api-key'
  | 'ak-sk'
  | 'oauth'
  | 'manual'
  | 'external';

export type EventSourceType =
  | 'hooks'
  | 'plugin'
  | 'event-stream'
  | 'cli-json'
  | 'export-import'
  | 'manual-import'
  | 'custom';

export type FinalizationStrategy =
  | 'explicit-event'
  | 'session-idle'
  | 'stop-event'
  | 'next-session'
  | 'manual'
  | 'custom';

export type ProviderPlatformStatus =
  | 'ENABLED'
  | 'DISABLED'
  | 'LIMITED'
  | 'BLOCKED_AUTH'
  | 'NOT_INSTALLED'
  | 'UNSUPPORTED_VERSION'
  | 'WAITING_REAL_EVENT'
  | 'ERROR';

export interface ProviderEventMapping {
  canonical?: string;
  contentPath?: string;
  sessionIdPath?: string;
  messageIdPath?: string;
  timestampPath?: string;
}

export interface ProviderDefinition {
  schemaVersion: 1;
  version: string;
  id: string;
  displayName: string;
  description: string;
  providerType: string;
  documentationUrl?: string;
  discovery: {
    executables?: string[];
    versionCommand?: string[];
    configPaths?: string[];
    pluginPaths?: string[];
    minimumVersion?: string;
  };
  auth: {
    type: ProviderAuthType;
    fields?: string[];
    verifyCommand?: string[];
  };
  eventSource: {
    type: EventSourceType;
    projectConfigPath?: string;
  };
  events: Record<string, ProviderEventMapping>;
  transformer?: { type: 'builtin'; name: string };
  finalization: {
    strategy: FinalizationStrategy;
    event?: string;
    limitation?: string;
  };
  verification: {
    required: string[];
    optional?: string[];
    requireTranscript: boolean;
  };
  installation?: {
    supported: boolean;
    source?: string;
    command?: string[];
  };
}
