import { getProjectRoot } from './config.ts';
import { detectProviders, type ProviderStatus } from './providerAdapterService.ts';

const TTL_MS = 5 * 60 * 1000;

interface ProviderSnapshot {
  detectedAt: string;
  expiresAt: number;
  projectRoot: string;
  providers: ProviderStatus[];
}

let snapshot: ProviderSnapshot | null = null;

export function getProviderSnapshot(force = false): ProviderSnapshot {
  const root = getProjectRoot();
  const now = Date.now();
  if (!force && snapshot && snapshot.projectRoot === root && snapshot.expiresAt > now) return snapshot;
  snapshot = {
    detectedAt: new Date(now).toISOString(),
    expiresAt: now + TTL_MS,
    projectRoot: root,
    providers: detectProviders(root),
  };
  return snapshot;
}

export function invalidateProviderSnapshot(): void {
  snapshot = null;
}

export function providerSnapshotTtlMs(): number {
  return TTL_MS;
}
