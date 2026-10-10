import type {
  AssetContent,
  AssetNode,
  ExpectedSkeletonEntry,
  ManagedAssetMetadata,
  ManagedAssetResult,
  ProjectWorkspace,
  RepositoryRevision,
  ServerEvent,
  TreeResponse,
} from '../domain/asset';

export interface ProviderStatusView {
  provider: string;
  status: string;
  captureMethod: string;
  realtime: boolean;
  historicalImport: boolean;
  runtimeVerified: boolean;
  detail: string;
  installed?: boolean;
  version?: string;
  configured?: boolean;
  lastVerifiedAt?: string;
  capabilities?: string[];
  limitations?: string[];
  platformStatus?: string;
  authStatus?: string;
  enabled?: boolean;
}
export interface ProviderDetailView { definition: any; status: ProviderStatusView & { platformStatus: string; authStatus: string; enabled: boolean }; verification: Array<{ step: string; status: string; detail: string }>; recentEvents: string[]; detectedAt?: string; verificationRunAt?: string; }

/**
 * Asset Client — the only boundary the React layer uses to reach the real
 * filesystem. It never imports fs or child_process; everything goes through the
 * Local Asset API mounted by the Vite plugin.
 */

const BASE = '/api';

const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
let providerOverviewCache: { value: { providers: ProviderStatusView[]; detectedAt: string }; expiresAt: number } | null = null;
const providerDetailCache = new Map<string, { value: ProviderDetailView; expiresAt: number }>();

function clearProviderClientCache(): void {
  providerOverviewCache = null;
  providerDetailCache.clear();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

async function errorMessage(res: Response): Promise<string> {
  const value = await res.json().catch(() => ({})) as { error?: string };
  return value.error ?? res.statusText;
}

function encode(rel: string): string {
  return encodeURIComponent(rel);
}

export interface KnowledgeVerificationCheckView {
  path: string;
  kind: 'file' | 'directory';
  ok: boolean;
  detail: string;
}

export interface KnowledgeVerificationView {
  target: string;
  ok: boolean;
  checks: KnowledgeVerificationCheckView[];
}

export interface KnowledgeCreateView {
  target: string;
  created: string[];
  verification: KnowledgeVerificationView;
}

export type CreatorCapabilityIdView = 'knowledge' | 'instance' | 'upgrade' | 'migration';

export interface InstanceManifestView {
  schemaVersion: 1;
  instanceId: string;
  projectRoot: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  generation: number;
  state: 'ready';
  framework: { version: string; revision: string };
  capabilities: Record<CreatorCapabilityIdView, string>;
  knowledge: { status: 'verified' | 'not-initialized'; verified: boolean };
  lastMigrationId?: string;
}

export interface InstanceVerificationView {
  projectRoot: string;
  ok: boolean;
  upToDate: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  manifest: InstanceManifestView | null;
}

export interface InstanceUpgradePlanView {
  schemaVersion: 1;
  planId: string;
  instanceId: string;
  projectRoot: string;
  createdAt: string;
  actions: Array<{
    id: string;
    kind: 'framework-version' | 'framework-revision' | 'capability-version';
    capability?: CreatorCapabilityIdView;
    from: string;
    to: string;
  }>;
  status: 'noop' | 'ready' | 'applied';
  appliedMigrationId?: string;
}

export interface MigrationRecordView {
  schemaVersion: 1;
  migrationId: string;
  planId: string;
  instanceId: string;
  projectRoot: string;
  createdAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
  status: 'prepared' | 'applied' | 'rolled-back';
  backupPath: string;
}

export interface InstanceStatusView {
  manifest: InstanceManifestView | null;
  verification: InstanceVerificationView;
  latestMigration: MigrationRecordView | null;
}

export interface InstanceSelfTestView {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  framework: { version: string; revision: string };
  steps: Array<{ id: string; ok: boolean; detail: string }>;
}

export const assetClient = {
  workspace(): Promise<ProjectWorkspace> {
    return getJson<ProjectWorkspace>(`${BASE}/workspace`);
  },
  tree(rel = ''): Promise<TreeResponse> {
    return getJson<TreeResponse>(`${BASE}/workspace/tree?path=${encode(rel)}`);
  },
  content(rel = ''): Promise<AssetContent> {
    return getJson<AssetContent>(`${BASE}/assets/content?id=${encode(rel)}`);
  },
  repositories(): Promise<RepositoryRevision[]> {
    return getJson<RepositoryRevision[]>(`${BASE}/repositories`);
  },
  skeleton(): Promise<ExpectedSkeletonEntry[]> {
    return getJson<ExpectedSkeletonEntry[]>(`${BASE}/workspace/skeleton`);
  },
  config(): Promise<{
    projectRoot: string;
    appRoot: string;
    mode: 'framework-self' | 'business-project';
    hasExternalProject: boolean;
    frameworkVersion: string;
    frameworkRevision: string;
    configurable: boolean;
    instanceId?: string;
    lockedToInstance?: boolean;
  }> {
    return getJson(`${BASE}/config`);
  },
  async createKnowledge(target: string, name?: string): Promise<KnowledgeCreateView> {
    const res = await fetch(`${BASE}/creator/knowledge/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target, name }),
    });
    const value = await res.json() as KnowledgeCreateView & { error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async verifyKnowledge(target: string): Promise<KnowledgeVerificationView> {
    const res = await fetch(`${BASE}/creator/knowledge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const value = await res.json() as KnowledgeVerificationView & { error?: string };
    if (!res.ok && res.status !== 422) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async createStarter(target: string, name?: string): Promise<KnowledgeCreateView> {
    return this.createKnowledge(target, name);
  },
  async instanceRuntime(projectRoot: string, action: 'status' | 'start' | 'stop'): Promise<{
    projectRoot: string; instanceId: string; status: 'running' | 'stopped';
    url: string | null; port: number | null; pid: number | null;
    frameworkVersion: string; frameworkRevision: string;
  }> {
    const response = await fetch(`${BASE}/creator/runtime/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot }),
    });
    const value = await response.json() as { error?: string };
    if (!response.ok) throw new ApiError(response.status, value.error ?? response.statusText);
    return value as { projectRoot: string; instanceId: string; status: 'running' | 'stopped'; url: string | null; port: number | null; pid: number | null; frameworkVersion: string; frameworkRevision: string };
  },
  async createInstance(projectRoot: string, name?: string, initializeKnowledge = false): Promise<{ manifest: InstanceManifestView; knowledgeVerification: KnowledgeVerificationView; manifestPath: string }> {
    const res = await fetch(`${BASE}/creator/instance/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot, name, initializeKnowledge }),
    });
    const value = await res.json() as { manifest: InstanceManifestView; knowledgeVerification: KnowledgeVerificationView; manifestPath: string; error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async instanceStatus(projectRoot: string): Promise<InstanceStatusView> {
    const res = await fetch(`${BASE}/creator/instance/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot }),
    });
    const value = await res.json() as InstanceStatusView & { error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async verifyInstance(projectRoot: string): Promise<InstanceVerificationView> {
    const res = await fetch(`${BASE}/creator/instance/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot }),
    });
    const value = await res.json() as InstanceVerificationView & { error?: string };
    if (!res.ok && res.status !== 422) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async planInstanceUpgrade(projectRoot: string): Promise<InstanceUpgradePlanView> {
    const res = await fetch(`${BASE}/creator/instance/upgrade/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot }),
    });
    const value = await res.json() as InstanceUpgradePlanView & { error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async applyInstanceUpgrade(projectRoot: string, planId: string): Promise<{ applied: boolean; manifest: InstanceManifestView; plan: InstanceUpgradePlanView; migration: MigrationRecordView | null }> {
    const res = await fetch(`${BASE}/creator/instance/upgrade/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot, planId }),
    });
    const value = await res.json() as { applied: boolean; manifest: InstanceManifestView; plan: InstanceUpgradePlanView; migration: MigrationRecordView | null; error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async runInstanceSelfTest(): Promise<InstanceSelfTestView> {
    const res = await fetch(`${BASE}/creator/instance/self-test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const value = await res.json() as InstanceSelfTestView & { error?: string };
    if (!res.ok && res.status !== 422) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async rollbackInstance(projectRoot: string, migrationId?: string): Promise<MigrationRecordView> {
    const res = await fetch(`${BASE}/creator/instance/rollback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot, migrationId }),
    });
    const value = await res.json() as MigrationRecordView & { error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    return value;
  },
  async providerOverview(force = false): Promise<{ providers: ProviderStatusView[]; detectedAt: string }> {
    const now = Date.now();
    if (!force && providerOverviewCache && providerOverviewCache.expiresAt > now) return providerOverviewCache.value;
    const endpoint = force ? `${BASE}/provider-manager/redetect` : `${BASE}/providers`;
    const res = force
      ? await fetch(endpoint, { method: 'POST' })
      : await fetch(endpoint);
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')) || res.statusText);
    const value = await res.json() as { providers: ProviderStatusView[]; detectedAt: string };
    providerOverviewCache = { value, expiresAt: now + PROVIDER_CACHE_TTL_MS };
    if (force) providerDetailCache.clear();
    return value;
  },
  providers(): Promise<ProviderStatusView[]> {
    return this.providerOverview(false).then((result) => result.providers);
  },
  async providerDetail(id: string, force = false): Promise<ProviderDetailView> {
    const now = Date.now();
    const cached = providerDetailCache.get(id);
    if (!force && cached && cached.expiresAt > now) return cached.value;
    const value = await getJson<ProviderDetailView>(`${BASE}/provider-manager/providers/${encodeURIComponent(id)}`);
    providerDetailCache.set(id, { value, expiresAt: now + PROVIDER_CACHE_TTL_MS });
    return value;
  },
  async providerAction(id: string, action: string, body: Record<string, unknown> = {}): Promise<any> {
    const res = await fetch(`${BASE}/provider-manager/providers/${encodeURIComponent(id)}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const value = await res.json() as any;
    if (!res.ok) throw new ApiError(res.status, value?.error ?? res.statusText);
    clearProviderClientCache();
    return value;
  },
  async saveCustomProvider(input: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${BASE}/provider-manager/custom`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const value = await res.json() as any;
    if (!res.ok) throw new ApiError(res.status, value?.error ?? res.statusText);
    clearProviderClientCache();
    return value;
  },
  async deleteCustomProvider(id: string): Promise<void> {
    const res = await fetch(`${BASE}/provider-manager/custom/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    clearProviderClientCache();
  },
  async scan(): Promise<{ scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number }> {
    const res = await fetch(`${BASE}/workspace/scan`, { method: 'POST' });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return await res.json() as { scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number };
  },
  async setRoot(rootPath: string): Promise<{ projectRoot: string; scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number }> {
    const res = await fetch(`${BASE}/workspace/root`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath }),
    });
    const value = await res.json() as { projectRoot: string; scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number; error?: string };
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    clearProviderClientCache();
    return value;
  },
  events(): EventSource {
    return new EventSource(`${BASE}/workspace/events`);
  },

  // ---- Managed Knowledge Asset persistence ----------------------------------
  async createConversation(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/conversation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async createDesign(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async createDecision(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async createTranscript(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async promoteConversationToDesign(id: string, input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/conversation/${encodeURIComponent(id)}/promote/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async promoteDesignToDecision(id: string, input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/design/${encodeURIComponent(id)}/promote/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as ManagedAssetResult;
  },
  async getManagedAsset(rel: string): Promise<ManagedAssetMetadata | null> {
    const res = await fetch(`${BASE}/managed/asset?path=${encodeURIComponent(rel)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    const data = (await res.json()) as { metadata: ManagedAssetMetadata };
    return data.metadata;
  },
};

export type { AssetNode };
export type { ServerEvent };
