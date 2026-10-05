import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getDataDir, getProjectRoot } from './config.ts';
import { detectProviders, type ProviderStatus } from './providerAdapterService.ts';
import { credentialStore } from './credentialStore.ts';

export type ProviderAuthType = 'none' | 'existing-session' | 'env' | 'api-key' | 'ak-sk' | 'oauth' | 'manual' | 'external';
export type EventSourceType = 'hooks' | 'plugin' | 'event-stream' | 'cli-json' | 'export-import' | 'manual-import' | 'custom';
export type FinalizationStrategy = 'explicit-event' | 'session-idle' | 'stop-event' | 'next-session' | 'manual' | 'custom';
export type ProviderPlatformStatus = 'ENABLED' | 'LIMITED' | 'BLOCKED_AUTH' | 'NOT_INSTALLED' | 'UNSUPPORTED_VERSION' | 'WAITING_REAL_EVENT' | 'ERROR';
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
];
const enabledFile = () => path.join(getDataDir(), 'provider-runtime', 'enabled.json');
const customFile = () => path.join(getDataDir(), 'provider-definitions', 'custom.json');
function json<T>(file: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; } }
function save(file: string, value: unknown): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); }
function enabled(): Record<string, boolean> { return json(enabledFile(), {}); }
function custom(): ProviderDefinition[] { return json(customFile(), []); }
function definition(id: string): ProviderDefinition { const found = [...builtins, ...custom()].find((item) => item.id === id); if (!found) throw new Error('provider definition not found'); return found; }
function credentialFields(def: ProviderDefinition): string[] { return def.auth.fields ?? []; }
function platformStatus(status: ProviderStatus, def: ProviderDefinition): ProviderPlatformStatus { if (!status.installed && def.id !== 'chatgpt') return 'NOT_INSTALLED'; if (def.auth.type === 'ak-sk' && credentialStore.listConfiguredFields(def.id, credentialFields(def)).length !== credentialFields(def).length) return 'BLOCKED_AUTH'; if (def.id === 'trae' && !status.runtimeVerified) return 'WAITING_REAL_EVENT'; if (status.runtimeVerified && status.configured) return 'ENABLED'; return status.status === 'ERROR' ? 'ERROR' : 'LIMITED'; }
export function listProviderDefinitions(): ProviderDefinition[] { return [...builtins, ...custom()]; }
export function getProviderDetail(id: string): ProviderDetail {
  const def = definition(id);
  const fallback: ProviderStatus = { provider: 'other', status: 'NOT_INSTALLED', captureMethod: def.eventSource.type, realtime: false, historicalImport: false, runtimeVerified: false, installed: false, configured: false, detail: 'Custom definition.' };
  const base: ProviderStatus = detectProviders(getProjectRoot()).find((item) => item.provider === id) ?? fallback;
  const state = enabled(); const active = state[id] !== false;
  const configuredFields = def.auth.type === 'ak-sk' ? credentialStore.listConfiguredFields(id, credentialFields(def)) : [];
  const authStatus = def.auth.type === 'ak-sk' ? (configuredFields.length === credentialFields(def).length ? 'CONFIGURED' : 'NOT_CONFIGURED') : def.auth.type === 'none' ? 'NOT_REQUIRED' : 'EXISTING_SESSION';
  const verification: ProviderDetail['verification'] = [{ step: 'Discovery', status: base.installed || id === 'chatgpt' ? 'PASS' : 'FAIL', detail: base.detail }, { step: 'Authentication', status: authStatus === 'NOT_CONFIGURED' ? 'BLOCKED' : 'PASS', detail: authStatus }, { step: 'Integration', status: base.configured ? 'PASS' : 'WAITING', detail: base.captureMethod }, { step: 'Transcript', status: base.runtimeVerified ? 'PASS' : 'WAITING', detail: base.runtimeVerified ? 'A real materialized transcript exists.' : 'Awaiting real provider evidence.' }];
  return { definition: def, status: { ...base, platformStatus: platformStatus(base, def), authStatus, enabled: active }, recentEvents: [], verification };
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
export function setProviderEnabled(id: string, value: boolean): ProviderDetail { definition(id); const state = enabled(); state[id] = value; save(enabledFile(), state); return getProviderDetail(id); }
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
