import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getDataDir, getProjectRoot } from './config.ts';
import { detectProviders, type ProviderStatus } from './providerAdapterService.ts';
import { credentialStore } from './credentialStore.ts';
import { isProviderEnabled, setProviderRuntimeEnabled } from './providerRuntimeState.ts';

export type ProviderAuthType = 'none' | 'existing-session' | 'env' | 'api-key' | 'ak-sk' | 'oauth' | 'manual' | 'external';
export type EventSourceType = 'hooks' | 'plugin' | 'event-stream' | 'cli-json' | 'export-import' | 'manual-import' | 'custom';
export type FinalizationStrategy = 'explicit-event' | 'session-idle' | 'stop-event' | 'next-session' | 'manual' | 'custom';
export type ProviderPlatformStatus = 'ENABLED' | 'DISABLED' | 'LIMITED' | 'BLOCKED_AUTH' | 'NOT_INSTALLED' | 'UNSUPPORTED_VERSION' | 'WAITING_REAL_EVENT' | 'ERROR';
export interface ProviderDefinition {
  schemaVersion: 1; version: string; id: string; displayName: string; description: string; providerType: string; documentationUrl?: string;
  discovery: { executables?: string[]; versionCommand?: string[]; configPaths?: string[]; pluginPaths?: string[]; minimumVersion?: string };
  auth: { type: ProviderAuthType; fields?: string[]; verifyCommand?: string[] };
  eventSource: { type: EventSourceType; projectConfigPath?: string };
  events: Record<string, { canonical?: string; contentPath?: string; sessionIdPath?: string; messageIdPath?: string; timestampPath?: string }>;
  transformer?: { type: 'builtin'; name: string };
  finalization: { strategy: FinalizationStrategy; event?: string; limitation?: string };
  verification: { required: string[]; optional?: string[]; requireTranscript: boolean };
  installation?: { supported: boolean; source?: string; command?: string[] };
}
export interface ProviderDetail { definition: ProviderDefinition; status: ProviderStatus & { platformStatus: ProviderPlatformStatus; authStatus: string; enabled: boolean }; recentEvents: string[]; verification: Array<{ step: string; status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING'; detail: string }>; }

const builtins: ProviderDefinition[] = [
  { schemaVersion: 1, version: '1.0.0', id: 'codex', displayName: 'Codex', description: 'Automatic project conversation capture.', providerType: 'coding-agent', documentationUrl: 'https://learn.chatgpt.com/docs/hooks', discovery: { executables: ['codex'], versionCommand: ['codex', '--version'], configPaths: ['.codex/hooks.json'] }, auth: { type: 'existing-session' }, eventSource: { type: 'hooks', projectConfigPath: '.codex/hooks.json' }, events: { SessionStart: { canonical: 'session.started' }, UserPromptSubmit: { canonical: 'user.message', contentPath: 'prompt' }, PostToolUse: { canonical: 'tool.completed' }, Stop: { canonical: 'assistant.message', contentPath: 'last_assistant_message' }, SessionEnd: { canonical: 'session.ended' } }, finalization: { strategy: 'explicit-event', event: 'SessionEnd' }, verification: { required: ['user.message', 'assistant.message'], optional: ['tool.completed'], requireTranscript: true } },
  { schemaVersion: 1, version: '1.0.0', id: 'codebuddy', displayName: 'CodeBuddy', description: 'Lifecycle hook and official transcript import.', providerType: 'coding-agent', discovery: { executables: ['codebuddy'], configPaths: ['.codebuddy/settings.json'] }, auth: { type: 'existing-session' }, eventSource: { type: 'hooks', projectConfigPath: '.codebuddy/settings.json' }, events: { SessionStart: { canonical: 'session.started' }, UserPromptSubmit: { canonical: 'user.message', contentPath: 'prompt' }, PreToolUse: { canonical: 'tool.started' }, PostToolUse: { canonical: 'tool.completed' }, Stop: { canonical: 'assistant.message', contentPath: 'last_assistant_message' }, SessionEnd: { canonical: 'session.ended' } }, finalization: { strategy: 'explicit-event', event: 'SessionEnd' }, verification: { required: ['user.message', 'assistant.message'], optional: ['tool.completed'], requireTranscript: true } },
  { schemaVersion: 1, version: '1.0.0', id: 'opencode', displayName: 'OpenCode', description: 'Plugin event stream with semantic merge.', providerType: 'coding-agent', discovery: { executables: ['opencode'], pluginPaths: ['.opencode/plugins/awb-capture.js'] }, auth: { type: 'none' }, eventSource: { type: 'plugin', projectConfigPath: '.opencode/plugins/awb-capture.js' }, events: {}, transformer: { type: 'builtin', name: 'opencode' }, finalization: { strategy: 'session-idle', limitation: 'Streaming events are merged by message ID.' }, verification: { required: ['user.message', 'assistant.message'], optional: ['tool.completed'], requireTranscript: true } },
  { schemaVersion: 1, version: '1.0.0', id: 'trae', displayName: 'Trae', description: 'Workspace hooks awaiting a real IDE event.', providerType: 'ide-agent', discovery: { executables: ['trae-cn'], configPaths: ['.trae/hooks.json'] }, auth: { type: 'existing-session' }, eventSource: { type: 'hooks', projectConfigPath: '.trae/hooks.json' }, events: { SessionStart: { canonical: 'session.started' }, UserPromptSubmit: { canonical: 'user.message', contentPath: 'prompt' }, PostToolUse: { canonical: 'tool.completed' }, Stop: { canonical: 'assistant.message', contentPath: 'last_assistant_message' } }, finalization: { strategy: 'custom', limitation: 'This build has no SessionEnd event.' }, verification: { required: ['user.message', 'assistant.message'], optional: ['tool.completed'], requireTranscript: true } },
  { schemaVersion: 1, version: '1.0.0', id: 'codearts', displayName: 'CodeArts', description: 'CLI export after access-key authentication.', providerType: 'coding-agent', discovery: { executables: ['codearts'] }, auth: { type: 'ak-sk', fields: ['CODEARTS_CLI_AK', 'CODEARTS_CLI_SK'], verifyCommand: ['codearts', 'session', 'list'] }, eventSource: { type: 'export-import' }, events: {}, finalization: { strategy: 'manual' }, verification: { required: ['user.message', 'assistant.message'], requireTranscript: true } },
  { schemaVersion: 1, version: '1.0.0', id: 'chatgpt', displayName: 'ChatGPT', description: 'User-provided transcript import only.', providerType: 'chat-product', discovery: {}, auth: { type: 'manual' }, eventSource: { type: 'manual-import' }, events: {}, finalization: { strategy: 'manual' }, verification: { required: [], requireTranscript: false } },
  { schemaVersion: 1, version: '1.0.0', id: 'workbuddy', displayName: 'WorkBuddy', description: 'Provider integration not installed on this machine.', providerType: 'coding-agent', discovery: {}, auth: { type: 'external' }, eventSource: { type: 'custom' }, events: {}, finalization: { strategy: 'custom', limitation: 'No verified local WorkBuddy adapter is installed.' }, verification: { required: ['user.message', 'assistant.message'], requireTranscript: true } },
];
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
    const configured = credentialStore.listConfiguredFields(def.id, fields);
    return configured.length === fields.length ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }
  return def.auth.type.toUpperCase();
}

function platformStatus(status: ProviderStatus, def: ProviderDefinition, active: boolean): ProviderPlatformStatus {
  if (!active) return 'DISABLED';
  if (def.id === 'chatgpt') return 'LIMITED';
  if (def.providerType === 'custom') return 'LIMITED';
  if (!status.installed) return 'NOT_INSTALLED';
  if ((def.auth.type === 'ak-sk' || def.auth.type === 'api-key') && authStatusFor(def) === 'NOT_CONFIGURED') return 'BLOCKED_AUTH';
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
      status: authStatus === 'NOT_CONFIGURED' ? 'BLOCKED' : 'PASS',
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
  const base: ProviderStatus = detectProviders(getProjectRoot()).find((item) => item.provider === id) ?? fallback;
  const active = isProviderEnabled(id);
  const authStatus = authStatusFor(def);
  const verification = verificationFor(def, base);
  return { definition: def, status: { ...base, platformStatus: platformStatus(base, def, active), authStatus, enabled: active }, recentEvents: [], verification };
}

export function listProviderStatuses(): Array<ProviderDetail['status']> {
  return listProviderDefinitions().map((item) => getProviderDetail(item.id).status);
}

export function runProviderVerification(id: string): ProviderDetail & { verificationRunAt: string; authProbe?: ReturnType<typeof verifyProviderAuth> } {
  const def = definition(id);
  let authProbe: ReturnType<typeof verifyProviderAuth> | undefined;
  if ((def.auth.type === 'ak-sk' || def.auth.type === 'api-key') && authStatusFor(def) !== 'NOT_CONFIGURED') {
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
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.id)) throw new Error('provider id must use lowercase letters, numbers, and hyphens');
  if (builtins.some((item) => item.id === input.id)) throw new Error('built-in provider definitions cannot be replaced');
  if (!input.displayName || !input.eventSource?.type || !input.finalization?.strategy) throw new Error('provider definition is incomplete');
  if (input.auth?.verifyCommand?.length || input.discovery?.versionCommand?.length || input.installation?.command?.length) {
    throw new Error('custom provider definitions cannot contain executable commands');
  }
  const all = custom().filter((item) => item.id !== input.id);
  const safe = { ...input, schemaVersion: 1 as const, version: input.version || '1.0.0' };
  all.push(safe);
  save(customFile(), all);
  return safe;
}
export function deleteCustomDefinition(id: string): void { if (builtins.some((item) => item.id === id)) throw new Error('built-in provider definitions cannot be deleted'); const all = custom(); if (!all.some((item) => item.id === id)) throw new Error('custom provider definition not found'); save(customFile(), all.filter((item) => item.id !== id)); }
