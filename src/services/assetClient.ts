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

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
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

function encode(rel: string): string {
  return encodeURIComponent(rel);
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
  config(): Promise<{ projectRoot: string; configurable: boolean }> {
    return getJson(`${BASE}/config`);
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
    const value = await res.json();
    if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText);
    providerDetailCache.delete(id);
    if (action === 'enable' || action === 'disable' || action === 'run-verification') providerOverviewCache = null;
    return value;
  },
  async saveCustomProvider(input: Record<string, unknown>): Promise<any> { const res = await fetch(`${BASE}/provider-manager/custom`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); const value = await res.json(); if (!res.ok) throw new ApiError(res.status, value.error ?? res.statusText); return value; },
  async deleteCustomProvider(id: string): Promise<void> { const res = await fetch(`${BASE}/provider-manager/custom/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (!res.ok) { const value = await res.json(); throw new ApiError(res.status, value.error ?? res.statusText); } },
  scan(): Promise<{ scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number }> {
    return fetch(`${BASE}/workspace/scan`, { method: 'POST' }).then((r) => r.json());
  },
  setRoot(rootPath: string): Promise<{ projectRoot: string; scannedAt: string; nodeCount: number; fileCount: number; directoryCount: number }> {
    return fetch(`${BASE}/workspace/root`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath }),
    }).then((r) => r.json());
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
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async createDesign(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async createDecision(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async createTranscript(input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async promoteConversationToDesign(id: string, input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/conversation/${encodeURIComponent(id)}/promote/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async promoteDesignToDecision(id: string, input: Record<string, unknown>): Promise<ManagedAssetResult> {
    const res = await fetch(`${BASE}/managed/design/${encodeURIComponent(id)}/promote/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    return (await res.json()) as ManagedAssetResult;
  },
  async getManagedAsset(rel: string): Promise<ManagedAssetMetadata | null> {
    const res = await fetch(`${BASE}/managed/asset?path=${encodeURIComponent(rel)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? res.statusText);
    const data = (await res.json()) as { metadata: ManagedAssetMetadata };
    return data.metadata;
  },
};

export type { AssetNode };
export type { ServerEvent };
