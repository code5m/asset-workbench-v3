import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getDataDir, getProjectRoot } from './config.ts';
import type { ProviderStatus } from './providerAdapterService.ts';
import { getProviderSnapshot, invalidateProviderSnapshot } from './providerSnapshot.ts';
import { credentialStore } from './credentialStore.ts';
import { isProviderEnabled, setProviderRuntimeEnabled } from './providerRuntimeState.ts';
import { BUILTIN_PROVIDER_DEFINITIONS, validateProviderDefinition } from '../packages/provider-sdk/src/index.ts';
import type { ProviderDefinition, ProviderPlatformStatus } from '../packages/protocol/src/provider.ts';

export type { ProviderAuthType, EventSourceType, FinalizationStrategy, ProviderPlatformStatus, ProviderDefinition } from '../packages/protocol/src/provider.ts';
export interface ProviderDetail { definition: ProviderDefinition; status: ProviderStatus & { platformStatus: ProviderPlatformStatus; authStatus: string; enabled: boolean }; recentEvents: string[]; verification: Array<{ step: string; status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING'; detail: string }>; detectedAt?: string; }

const builtins: ProviderDefinition[] = [...BUILTIN_PROVIDER_DEFINITIONS];
const customFile = () => path.join(getDataDir(), 'provider-definitions', 'custom.json');
function json<T>(file: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; } }
function save(file: string, value: unknown): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); }
function custom(): ProviderDefinition[] { return json(customFile(), []); }
function definition(id: string): ProviderDefinition { const found = [...builtins, ...custom()].find((item) => item.id === id); if (!found) throw new Error('provider definition not found'); return found; }
function credentialFields(def: ProviderDefinition): string[] { return def.auth.fields ?? []; }

function authStatusFor(def: ProviderDefinition): string {
  if (def.auth.type === 'none') return 'NOT_REQUIRED';
  if (def.auth.type === 'manual') return 'MANUAL_IMPORT';
  if (def.auth.type === 'existing-session') return 'EXISTING_SESSION';
  if (def.auth.type === 'oauth') return 'OAUTH_SESSION';
  if (def.auth.type === 'external') return 'EXTERNAL';
  if (def.auth.type === 'env') return 'ENVIRONMENT';
  if (def.auth.type === 'api-key' || def.auth.type === 'ak-sk') {
    const fields = credentialFields(def);
    try {
      const configured = credentialStore.listConfiguredFields(def.id, fields);
      return configured.length === fields.length ? 'CONFIGURED' : 'NOT_CONFIGURED';
    } catch {
      // OS Keyring, libsecret or the local compiler can be unavailable in a fresh Instance.
      // Keep the entire Provider Manager operational; never imply authentication succeeded.
      return 'SECURE_STORE_UNAVAILABLE';
    }
  }
  return 'EXTERNAL';
}

function platformStatus(status: ProviderStatus, def: ProviderDefinition, active: boolean): ProviderPlatformStatus {
  if (!active) return 'DISABLED';
  if (def.id === 'chatgpt') return 'LIMITED';
  if (def.providerType === 'custom') return 'LIMITED';
  if (!status.installed) return 'NOT_INSTALLED';
  if ((def.auth.type === 'ak-sk' || def.auth.type === 'api-key') && ['NOT_CONFIGURED', 'SECURE_STORE_UNAVAILABLE'].includes(authStatusFor(def))) return 'BLOCKED_AUTH';
  if (def.id === 'trae' && !status.runtimeVerified) return 'WAITING_REAL_EVENT';
  if (status.runtimeVerified && status.configured) return 'ENABLED';
  return status.status === 'ERROR' ? 'ERROR' : 'LIMITED';
}

function verificationFor(def: ProviderDefinition, base: ProviderStatus): ProviderDetail['verification'] {
  const authStatus = authStatusFor(def);
  const manualImport = def.eventSource.type === 'manual-import';
  const customDefinition = def.providerType === 'custom';
  return [
    {
      step: 'Discovery',
      status: base.installed || manualImport || customDefinition ? 'PASS' : 'FAIL',
      detail: manualImport ? 'Manual import is available; no local executable is required.' : customDefinition ? 'Provider Definition is saved; executable probing is intentionally not run for custom providers.' : base.detail,
    },
    {
      step: 'Authentication',
      status: ['NOT_CONFIGURED', 'SECURE_STORE_UNAVAILABLE'].includes(authStatus) ? 'BLOCKED' : 'PASS',
      detail: authStatus,
    },
    {
      step: 'Integration',
      status: manualImport ? 'PASS' : customDefinition ? 'WAITING' : base.configured ? 'PASS' : 'WAITING',
      detail: manualImport ? 'Explicit transcript import is the configured integration.' : customDefinition ? 'Definition saved. A trusted adapter/event mapping must be installed before realtime capture can be enabled.' : base.captureMethod,
    },
    {
      step: 'Real Event',
      status: manualImport ? 'PASS' : base.runtimeVerified ? 'PASS' : 'WAITING',
      detail: manualImport ? 'Not applicable to realtime capture; evidence arrives only when the user imports a transcript.' : base.runtimeVerified ? 'At least one real provider-sourced capture completed.' : 'Waiting for a real provider event/session; fixtures do not count.',
    },
    {
      step: 'Transcript',
      status: base.runtimeVerified ? 'PASS' : 'WAITING',
      detail: base.runtimeVerified ? 'A real materialized transcript exists.' : manualImport ? 'Import a ChatGPT transcript to create evidence.' : 'No real materialized transcript has been observed yet.',
    },
  ];
}

export function listProviderDefinitions(): ProviderDefinition[] { return [...builtins, ...custom()]; }

export function getProviderDetail(id: string): ProviderDetail {
  const def = definition(id);
  const fallback: ProviderStatus = { provider: def.id as ProviderStatus['provider'], status: def.id === 'workbuddy' ? 'NOT_INSTALLED' : 'LIMITED', captureMethod: def.eventSource.type, realtime: false, historicalImport: false, runtimeVerified: false, installed: false, configured: false, detail: def.id === 'workbuddy' ? 'No WorkBuddy installation was detected.' : 'Custom Provider Definition is saved; a trusted adapter is still required.' };
  const snapshot = getProviderSnapshot(false);
  const base: ProviderStatus = snapshot.providers.find((item) => item.provider === id) ?? fallback;
  const active = isProviderEnabled(id);
  const authStatus = authStatusFor(def);
  const verification = verificationFor(def, base);
  return { definition: def, status: { ...base, platformStatus: platformStatus(base, def, active), authStatus, enabled: active }, recentEvents: [], verification, detectedAt: snapshot.detectedAt };
}

function buildProviderStatuses(force = false): { providers: Array<ProviderDetail['status']>; detectedAt: string } {
  const snapshot = getProviderSnapshot(force);
  const providers = listProviderDefinitions().map((item) => {
    const def = definition(item.id);
    const fallback: ProviderStatus = { provider: def.id as ProviderStatus['provider'], status: def.id === 'workbuddy' ? 'NOT_INSTALLED' : 'LIMITED', captureMethod: def.eventSource.type, realtime: false, historicalImport: false, runtimeVerified: false, installed: false, configured: false, detail: def.id === 'workbuddy' ? 'No WorkBuddy installation was detected.' : 'Custom Provider Definition is saved; a trusted adapter is still required.' };
    const base = snapshot.providers.find((candidate) => candidate.provider === item.id) ?? fallback;
    const active = isProviderEnabled(item.id);
    return { ...base, platformStatus: platformStatus(base, def, active), authStatus: authStatusFor(def), enabled: active };
  });
  return { providers, detectedAt: snapshot.detectedAt };
}

export function listProviderStatuses(): { providers: Array<ProviderDetail['status']>; detectedAt: string } {
  return buildProviderStatuses(false);
}

export function redetectProviderStatuses(): { providers: Array<ProviderDetail['status']>; detectedAt: string } {
  invalidateProviderSnapshot();
  return buildProviderStatuses(true);
}

export function runProviderVerification(id: string): ProviderDetail & { verificationRunAt: string; authProbe?: ReturnType<typeof verifyProviderAuth> } {
  invalidateProviderSnapshot();
  getProviderSnapshot(true);
  const def = definition(id);
  let authProbe: ReturnType<typeof verifyProviderAuth> | undefined;
  if ((def.auth.type === 'ak-sk' || def.auth.type === 'api-key') && authStatusFor(def) === 'CONFIGURED') {
    authProbe = verifyProviderAuth(id);
  }
  return { ...getProviderDetail(id), verificationRunAt: new Date().toISOString(), authProbe };
}
export function saveCredentials(id: string, values: Record<string, unknown>): { configured: boolean; fields: string[] } { const def = definition(id); if (def.auth.type !== 'ak-sk' && def.auth.type !== 'api-key') throw new Error('this provider does not accept stored credentials'); const fields = credentialFields(def); for (const field of fields) { const value = values[field]; if (typeof value === 'string' && value) credentialStore.save(id, field, value); } const configured = credentialStore.listConfiguredFields(id, fields); if (configured.length !== fields.length) throw new Error('all required credentials are required'); return { configured: true, fields: configured }; }
export function deleteCredentials(id: string): { configured: boolean; fields: string[] } { const def = definition(id); for (const field of credentialFields(def)) credentialStore.delete(id, field); return { configured: false, fields: [] }; }
export function verifyProviderAuth(id: string): { authStatus: 'VERIFIED' | 'INVALID' | 'ERROR' | 'NOT_CONFIGURED' | 'NOT_REQUIRED'; detail: string } {
  const def = definition(id);
  if (def.auth.type !== 'ak-sk') return { authStatus: 'NOT_REQUIRED', detail: 'This provider uses no stored credential.' };
  const builtin = builtins.find((item) => item.id === id);
  if (!builtin?.auth.verifyCommand?.length) {
    return { authStatus: 'ERROR', detail: 'Custom provider command verification is not permitted.' };
  }
  const fields = credentialFields(def);
  const values: Record<string, string | undefined> = Object.fromEntries(fields.map((field) => [field, credentialStore.get(id, field) ?? undefined]));
  if (Object.values(values).some((value) => !value)) return { authStatus: 'NOT_CONFIGURED', detail: 'Required credentials are not configured.' };
  try {
    execFileSync(builtin.auth.verifyCommand[0], builtin.auth.verifyCommand.slice(1), { env: { ...process.env, ...values }, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { authStatus: 'VERIFIED', detail: 'Credential verification command completed.' };
  } catch {
    return { authStatus: 'INVALID', detail: 'Authentication failed.' };
  }
}
export function setProviderEnabled(id: string, value: boolean): ProviderDetail { definition(id); setProviderRuntimeEnabled(id, value); return getProviderDetail(id); }
export function saveCustomDefinition(input: ProviderDefinition): ProviderDefinition {
  if (builtins.some((item) => item.id === input.id)) throw new Error('built-in provider definitions cannot be replaced');
  const normalized = { ...input, schemaVersion: 1 as const, version: input.version || '1.0.0' };
  const safe = validateProviderDefinition(normalized, { allowExecutableCommands: false });
  const all = custom().filter((item) => item.id !== input.id);
  all.push(safe);
  save(customFile(), all);
  return safe;
}
export function deleteCustomDefinition(id: string): void { if (builtins.some((item) => item.id === id)) throw new Error('built-in provider definitions cannot be deleted'); const all = custom(); if (!all.some((item) => item.id === id)) throw new Error('custom provider definition not found'); save(customFile(), all.filter((item) => item.id !== id)); }
