import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDataDir } from './config.ts';
import { appendCaptureEvents, createCaptureSession, endCaptureSession, getCaptureSession } from './captureService.ts';
import type { AppendCaptureEventInput } from './captureService.ts';
import type { CaptureProvider } from '../src/domain/asset.ts';

export type ProviderAvailability = 'AVAILABLE' | 'ENABLED' | 'DISABLED' | 'NOT_INSTALLED' | 'NEEDS_AUTH' | 'LIMITED' | 'ERROR';
export interface ProviderStatus {
  provider: CaptureProvider;
  status: ProviderAvailability;
  captureMethod: string;
  realtime: boolean;
  historicalImport: boolean;
  runtimeVerified: boolean;
  detail: string;
}

interface AdapterState { captureSessionId: string; providerSessionId: string; updatedAt: string; }
function stateDir(): string { return path.join(getDataDir(), 'provider-adapters'); }
function stateFile(provider: CaptureProvider, providerSessionId: string): string {
  return path.join(stateDir(), provider, `${crypto.createHash('sha256').update(providerSessionId).digest('hex')}.json`);
}
function commandExists(command: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => fs.existsSync(path.join(dir, command)));
}
function hasCodexRuntimeVerification(): boolean {
  const sessions = path.join(getDataDir(), 'capture', 'sessions');
  try {
    return fs.readdirSync(sessions).some((entry) => {
      try {
        const state = JSON.parse(fs.readFileSync(path.join(sessions, entry, 'state.json'), 'utf8')) as { provider?: string; captureSource?: string; status?: string; transcriptAssetId?: string };
        return state.provider === 'codex' && state.captureSource === 'native-hook' && state.status === 'ended' && Boolean(state.transcriptAssetId);
      } catch { return false; }
    });
  } catch { return false; }
}
function now(): string { return new Date().toISOString(); }
function readState(provider: CaptureProvider, providerSessionId: string): AdapterState | null {
  try { return JSON.parse(fs.readFileSync(stateFile(provider, providerSessionId), 'utf8')) as AdapterState; } catch { return null; }
}
function saveState(provider: CaptureProvider, state: AdapterState): void {
  const target = stateFile(provider, state.providerSessionId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(state, null, 2), 'utf8');
}
function withProviderLock<T>(provider: CaptureProvider, providerSessionId: string, action: () => T): T {
  const lock = `${stateFile(provider, providerSessionId)}.lock`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      fs.mkdirSync(lock);
      try { return action(); } finally { fs.rmdirSync(lock); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      Atomics.wait(wait, 0, 0, 10);
    }
  }
  throw new Error(`provider session lock timed out: ${provider}`);
}

export function detectProviders(projectRoot: string): ProviderStatus[] {
  const codexHooks = path.join(projectRoot, '.codex', 'hooks.json');
  const codexVerified = hasCodexRuntimeVerification();
  return [
    { provider: 'codex', status: fs.existsSync(codexHooks) ? 'ENABLED' : commandExists('codex') ? 'AVAILABLE' : 'NOT_INSTALLED', captureMethod: 'official lifecycle hooks + JSONL history import', realtime: true, historicalImport: true, runtimeVerified: codexVerified, detail: fs.existsSync(codexHooks) ? codexVerified ? 'Hook definition present and a completed local Codex capture was verified.' : 'Hook definition present; Codex trust review is required by Codex.' : 'Codex CLI detected but hook definition is absent.' },
    { provider: 'codebuddy', status: commandExists('codebuddy') ? 'LIMITED' : 'NOT_INSTALLED', captureMethod: 'ACP / stream-json adapter contract', realtime: false, historicalImport: false, runtimeVerified: false, detail: commandExists('codebuddy') ? 'CLI supports ACP and stream JSON, but this workspace has no configured CodeBuddy event subscriber yet.' : 'CodeBuddy CLI not detected.' },
    { provider: 'codearts', status: commandExists('codearts') ? 'LIMITED' : 'NOT_INSTALLED', captureMethod: 'ACP / exported-session ingestion', realtime: false, historicalImport: commandExists('codearts'), runtimeVerified: false, detail: commandExists('codearts') ? 'CLI supports ACP and session export, but automatic event subscription needs a configured running endpoint.' : 'CodeArts CLI not detected.' },
    { provider: 'opencode', status: fs.existsSync(path.join(process.env.HOME ?? '', '.local/share/opencode')) ? 'LIMITED' : 'NOT_INSTALLED', captureMethod: 'local-history adapter pending stable format', realtime: false, historicalImport: false, runtimeVerified: false, detail: 'Local state exists but no OpenCode executable or stable session schema was detected.' },
    { provider: 'trae', status: 'NOT_INSTALLED', captureMethod: 'provider integration pending', realtime: false, historicalImport: false, runtimeVerified: false, detail: 'No Trae executable or local state was detected.' },
    { provider: 'chatgpt', status: 'LIMITED', captureMethod: 'explicit transcript import only', realtime: false, historicalImport: true, runtimeVerified: false, detail: 'The desktop ChatGPT conversation boundary does not expose a local automatic capture feed to this workspace.' },
    { provider: 'workbuddy', status: 'NOT_INSTALLED', captureMethod: 'provider integration pending', realtime: false, historicalImport: false, runtimeVerified: false, detail: 'No WorkBuddy installation was detected.' },
    { provider: 'other', status: 'AVAILABLE', captureMethod: 'Capture API / adapter contract', realtime: true, historicalImport: true, runtimeVerified: true, detail: 'Generic provider adapter is available through the Capture API.' },
  ];
}

export interface AdapterEventInput { provider: CaptureProvider; providerSessionId: string; cwd?: string; model?: string; hookEventName: string; turnId?: string; prompt?: string; lastAssistantMessage?: string | null; toolName?: string; toolInput?: unknown; toolResponse?: unknown; rawPayload?: unknown; }
export function ingestProviderEvent(input: AdapterEventInput): { captureSessionId: string; accepted: string[]; duplicates: string[] } {
  return withProviderLock(input.provider, input.providerSessionId, () => {
    let state = readState(input.provider, input.providerSessionId);
    if (!state) {
      const session = createCaptureSession({ provider: input.provider, providerSessionId: input.providerSessionId, captureSource: input.provider === 'codex' ? 'native-hook' : 'other' });
      state = { captureSessionId: session.captureSessionId, providerSessionId: input.providerSessionId, updatedAt: now() };
      saveState(input.provider, state);
    }
    const eventBase = `${input.provider}:${input.providerSessionId}:${input.turnId ?? 'session'}:${input.hookEventName}`;
    const events: AppendCaptureEventInput[] = [];
    if (input.hookEventName === 'SessionStart') events.push({ eventId: `${eventBase}:start`, eventType: 'session.started', timestamp: now(), actor: 'system', affectedFiles: input.cwd ? [input.cwd] : undefined, rawPayload: input.rawPayload });
    if (input.hookEventName === 'UserPromptSubmit' && input.prompt) events.push({ eventId: `${eventBase}:user`, eventType: 'user.message', timestamp: now(), actor: 'user', content: input.prompt, rawPayload: input.rawPayload });
    if (input.hookEventName === 'PostToolUse') events.push({ eventId: `${eventBase}:tool`, eventType: 'tool.completed', timestamp: now(), actor: 'tool', toolCall: { name: input.toolName, input: input.toolInput }, toolResult: { output: input.toolResponse }, rawPayload: input.rawPayload });
    if ((input.hookEventName === 'Stop' || input.hookEventName === 'SubagentStop') && input.lastAssistantMessage) events.push({ eventId: `${eventBase}:assistant`, eventType: 'assistant.message', timestamp: now(), actor: 'assistant', content: input.lastAssistantMessage, rawPayload: input.rawPayload });
    if (events.length === 0) return { captureSessionId: state.captureSessionId, accepted: [], duplicates: [] };
    const result = appendCaptureEvents(state.captureSessionId, events);
    state.updatedAt = now(); saveState(input.provider, state);
    return { captureSessionId: state.captureSessionId, accepted: result.accepted, duplicates: result.duplicates };
  });
}

export async function endProviderSession(provider: CaptureProvider, providerSessionId: string): Promise<void> {
  const state = readState(provider, providerSessionId);
  if (!state) return;
  if (getCaptureSession(state.captureSessionId).status === 'active') await endCaptureSession(state.captureSessionId);
}

/** Import a persisted Codex JSONL rollout without touching its source file. Re-running is safe by ordinal event id. */
export async function importCodexHistory(sourcePath: string): Promise<{ captureSessionId: string; imported: number }> {
  const absolute = path.resolve(sourcePath);
  const codexSessions = path.join(process.env.HOME ?? '', '.codex', 'sessions');
  if (!absolute.startsWith(`${codexSessions}${path.sep}`)) throw new Error('Codex history must be under ~/.codex/sessions');
  const rows = fs.readFileSync(absolute, 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line) as Record<string, any>]; } catch { return []; } });
  const meta = rows.find((row) => row.type === 'session_meta')?.payload;
  const providerSessionId = typeof meta?.session_id === 'string' ? meta.session_id : path.basename(absolute, '.jsonl');
  return withProviderLock('codex', providerSessionId, () => {
    let state = readState('codex', providerSessionId);
    if (!state) {
      const session = createCaptureSession({ provider: 'codex', providerSessionId, captureSource: 'import' });
      state = { captureSessionId: session.captureSessionId, providerSessionId, updatedAt: now() };
      saveState('codex', state);
    }
    const events: AppendCaptureEventInput[] = [];
    for (let ordinal = 0; ordinal < rows.length; ordinal++) {
      const row = rows[ordinal];
      const payload = row.payload ?? {};
      const item = payload.type === 'message' ? payload : payload.item ?? payload;
      const role = item.role;
      const text = Array.isArray(item.content) ? item.content.map((part: any) => part.text ?? part.content ?? '').filter(Boolean).join('\n') : typeof item.text === 'string' ? item.text : '';
      if (role === 'user' && text) events.push({ eventId: `codex-history:${providerSessionId}:${ordinal}`, eventType: 'user.message', sequence: ordinal, timestamp: row.timestamp ?? now(), actor: 'user', content: text });
      if (role === 'assistant' && text) events.push({ eventId: `codex-history:${providerSessionId}:${ordinal}`, eventType: 'assistant.message', sequence: ordinal, timestamp: row.timestamp ?? now(), actor: 'assistant', content: text });
    }
    const result = events.length ? appendCaptureEvents(state.captureSessionId, events) : { accepted: [] };
    state.updatedAt = now(); saveState('codex', state);
    return { captureSessionId: state.captureSessionId, imported: result.accepted.length };
  });
}
