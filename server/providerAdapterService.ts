import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getDataDir } from './config.ts';
import { appendCaptureEvents, createCaptureSession, endCaptureSession, getCaptureSession, getCaptureStorePaths } from './captureService.ts';
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
  /** present in this install / reachable on PATH */
  installed?: boolean;
  /** detected provider version string, when discoverable */
  version?: string;
  /** a capture integration (hook config / adapter contract) is actually configured */
  configured?: boolean;
  /** ISO timestamp of the last verified real capture for this provider */
  lastVerifiedAt?: string;
  capabilities?: string[];
  limitations?: string[];
  lastError?: string;
}

/** Providers for which a real official lifecycle-hook payload is the capture source. */
const HOOK_PROVIDERS = new Set<CaptureProvider>(['codex', 'codebuddy', 'trae']);
interface AdapterState { captureSessionId: string; providerSessionId: string; updatedAt: string; }
function stateDir(): string { return path.join(getDataDir(), 'provider-adapters'); }
function stateFile(provider: CaptureProvider, providerSessionId: string): string {
  return path.join(stateDir(), provider, `${crypto.createHash('sha256').update(providerSessionId).digest('hex')}.json`);
}
function commandExists(command: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => fs.existsSync(path.join(dir, command)));
}
/**
 * Runtime verification evidence: at least one ENDED capture session for this
 * provider that actually materialized a transcript via the real adapter path.
 * `runtimeVerified=true` can therefore only come from a REAL capture, never from
 * a config file or a mock.
 */
export function runtimeVerificationFor(provider: CaptureProvider): { verified: boolean; lastVerifiedAt?: string } {
  const sessions = path.join(getDataDir(), 'capture', 'sessions');
  let last: string | undefined;
  try {
    for (const entry of fs.readdirSync(sessions)) {
      try {
        const state = JSON.parse(fs.readFileSync(path.join(sessions, entry, 'state.json'), 'utf8')) as {
          provider?: string; captureSource?: string; status?: string; transcriptAssetId?: string; endedAt?: string; startedAt?: string;
        };
        const matches = state.provider === provider && state.status === 'ended' && Boolean(state.transcriptAssetId);
        if (!matches) continue;
        // native-hook or import counts as a real provider-sourced capture; 'test' does not.
        if (state.captureSource !== 'native-hook' && state.captureSource !== 'import') continue;
        const stamp = state.endedAt ?? state.startedAt;
        if (stamp && (!last || stamp > last)) last = stamp;
      } catch { continue; }
    }
  } catch { return { verified: false }; }
  return last ? { verified: true, lastVerifiedAt: last } : { verified: false };
}
function hasCodexRuntimeVerification(): boolean { return runtimeVerificationFor('codex').verified; }
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

function firstExistingPath(candidates: string[]): string | undefined {
  return candidates.find((candidate) => fs.existsSync(candidate));
}
/** Best-effort version probe. Never throws and never blocks provider work. */
function probeVersion(command: string): string | undefined {
  try {
    const output = execFileSync(command, ['--version'], { timeout: 2500, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.trim().split('\n')[0]?.trim() || undefined;
  } catch { return undefined; }
}
function readHookConfigured(file: string): boolean {
  try { return Boolean((JSON.parse(fs.readFileSync(file, 'utf8')) as { hooks?: unknown }).hooks); } catch { return false; }
}

export function detectProviders(projectRoot: string): ProviderStatus[] {
  const home = process.env.HOME ?? '';
  const codexHooks = path.join(projectRoot, '.codex', 'hooks.json');
  const codebuddyHooks = path.join(projectRoot, '.codebuddy', 'settings.json');

  const codexInstalled = commandExists('codex');
  const codexConfigured = fs.existsSync(codexHooks);
  const codexVerified = hasCodexRuntimeVerification();
  const codebuddyInstalled = commandExists('codebuddy');
  const codebuddyConfigured = readHookConfigured(codebuddyHooks);
  const codebuddyEvidence = runtimeVerificationFor('codebuddy');
  const codeartsInstalled = commandExists('codearts');
  // CodeArts CLI refuses every command (including `session list`) without these.
  const codeartsCreds = Boolean(process.env.CODEARTS_CLI_AK && process.env.CODEARTS_CLI_SK);
  const opencodePath = firstExistingPath([
    path.join(home, '.local', 'bin', 'opencode'),
    path.join(home, '.opencode', 'bin', 'opencode'),
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ]);
  const traePath = commandExists('trae-cn') ? 'trae-cn' : fs.existsSync('/usr/bin/trae-cn') ? '/usr/bin/trae-cn' : undefined;
  const chatgptInstalled = commandExists('chatgpt');

  return [
    {
      provider: 'codex',
      status: codexConfigured ? 'ENABLED' : codexInstalled ? 'AVAILABLE' : 'NOT_INSTALLED',
      captureMethod: 'official lifecycle hooks (SessionStart/UserPromptSubmit/PostToolUse/Stop/SessionEnd) + JSONL history import',
      realtime: true,
      historicalImport: true,
      runtimeVerified: codexVerified,
      installed: codexInstalled,
      version: codexInstalled ? probeVersion('codex') : undefined,
      configured: codexConfigured,
      capabilities: ['realtime-hook', 'history-import', 'raw-events', 'canonical-events', 'transcript-materialization'],
      limitations: [],
      detail: codexConfigured
        ? (codexVerified
          ? 'Hook definition present and a completed real Codex capture was verified.'
          : 'Hook definition present; no completed Codex capture has been verified yet in this workspace.')
        : 'Codex CLI detected but no hook definition is installed.',
    },
    {
      provider: 'codebuddy',
      status: !codebuddyInstalled ? 'NOT_INSTALLED' : !codebuddyConfigured ? 'AVAILABLE' : 'ENABLED',
      captureMethod: 'official lifecycle hooks in .codebuddy/settings.json + official session transcript (transcript_path) import',
      realtime: true,
      historicalImport: true,
      runtimeVerified: codebuddyEvidence.verified,
      lastVerifiedAt: codebuddyEvidence.lastVerifiedAt,
      installed: codebuddyInstalled,
      version: codebuddyInstalled ? probeVersion('codebuddy') : undefined,
      configured: codebuddyConfigured,
      capabilities: ['realtime-hook', 'official-transcript-import', 'raw-events', 'canonical-events', 'tool-events', 'dedupe-by-generation'],
      limitations: codebuddyInstalled
        ? ['Creating a brand-new session headlessly (print mode / ACP session/new) requires an interactive provider login, so new sessions cannot be fabricated unattended.']
        : [],
      detail: !codebuddyInstalled
        ? 'CodeBuddy CLI not detected.'
        : !codebuddyConfigured
          ? 'CodeBuddy detected, but no hook configuration is installed in this workspace.'
          : (codebuddyEvidence.verified
            ? 'Hooks installed and a real CodeBuddy capture was materialized into a transcript.'
            : 'Hooks installed; awaiting a real CodeBuddy capture to materialize.'),
    },
    {
      provider: 'codearts',
      status: !codeartsInstalled ? 'NOT_INSTALLED' : codeartsCreds ? 'AVAILABLE' : 'BLOCKED',
      captureMethod: 'official session export / ACP (requires AK/SK credentials)',
      realtime: false,
      historicalImport: codeartsInstalled,
      runtimeVerified: false,
      installed: codeartsInstalled,
      version: codeartsInstalled ? probeVersion('codearts') : undefined,
      configured: codeartsCreds,
      capabilities: codeartsCreds ? ['session-export'] : [],
      limitations: [
        'CodeArts CLI rejects every command (including `codearts session list` and `codearts run`) without CODEARTS_CLI_AK / CODEARTS_CLI_SK.',
        'Credentials must be provisioned by the user; auto-acquiring them is out of scope.',
      ],
      lastError: codeartsInstalled && !codeartsCreds
        ? '认证失败，没有设置环境变量CODEARTS_CLI_AK/CODEARTS_CLI_SK (observed from `codearts run` and `codearts session list`)'
        : undefined,
      detail: !codeartsInstalled
        ? 'CodeArts CLI not detected.'
        : codeartsCreds
          ? 'CodeArts detected with credentials present; export can be attempted.'
          : 'CodeArts is installed but unauthenticated: no real session can be run or exported, so capture cannot be proven.',
    },
    {
      provider: 'opencode',
      status: opencodePath ? 'AVAILABLE' : 'NOT_INSTALLED',
      captureMethod: 'official plugin / SDK event stream (pending executable)',
      realtime: false,
      historicalImport: false,
      runtimeVerified: false,
      installed: Boolean(opencodePath),
      configured: Boolean(opencodePath),
      capabilities: [],
      limitations: opencodePath
        ? []
        : ['No OpenCode executable found in PATH, ~/.local/bin, ~/.opencode/bin, /usr/local/bin or /usr/bin. A leftover ~/.local/share/opencode data directory exists but its internal DB schema is deliberately not used as a capture source.'],
      detail: opencodePath
        ? `OpenCode executable detected at ${opencodePath}, but no adapter is wired yet.`
        : 'OpenCode executable not installed; no event source is reachable.',
    },
    {
      provider: 'trae',
      status: traePath ? 'UNSUPPORTED' : 'NOT_INSTALLED',
      captureMethod: 'no official session/hook interface found in the installed build',
      realtime: false,
      historicalImport: false,
      runtimeVerified: false,
      installed: Boolean(traePath),
      version: traePath ? probeVersion(traePath) : undefined,
      configured: false,
      capabilities: [],
      limitations: [
        'The installed Trae CN binary exposes only editor options (diff/merge/add/goto/new-window/user-data-dir); no AI session CLI, hook event names, or documented session export.',
        'A SessionEnd-like lifecycle event was NOT found, and none will be fabricated.',
      ],
      detail: traePath
        ? `Trae CN IDE detected at ${traePath}, but it exposes no official realtime session event or hook interface that this adapter can subscribe to, so no capture is claimed.`
        : 'No Trae executable or local state was detected.',
    },
    {
      provider: 'chatgpt',
      status: 'LIMITED',
      captureMethod: 'explicit transcript import only (no automatic local feed is used)',
      realtime: false,
      historicalImport: true,
      runtimeVerified: false,
      installed: chatgptInstalled,
      configured: true,
      capabilities: ['explicit-import'],
      limitations: [
        'No reliable local lifecycle hook or stable public session-event API is exposed for ChatGPT conversations.',
        'Browser/private-API/DOM scraping is deliberately NOT used as a capture source.',
      ],
      detail: 'The desktop ChatGPT boundary does not expose a local automatic capture feed to this workspace; only user-supplied imports are accepted.',
    },
    { provider: 'workbuddy', status: 'NOT_INSTALLED', captureMethod: 'provider integration pending', realtime: false, historicalImport: false, runtimeVerified: false, installed: false, configured: false, detail: 'No WorkBuddy installation was detected.' },
    { provider: 'other', status: 'AVAILABLE', captureMethod: 'Capture API / adapter contract', realtime: true, historicalImport: true, runtimeVerified: true, installed: true, configured: true, detail: 'Generic provider adapter is available through the Capture API.' },
  ];
}

/** Provider-native identity/provenance. Never used to *guess* a session; only stored as evidence. */
export interface AdapterProvenance {
  transcriptPath?: string;
  agentTranscriptPath?: string;
  agentType?: string;
  client?: string;
  providerVersion?: string;
  stopHookActive?: boolean;
  source?: string;
  reason?: string;
  model?: string;
  turnId?: string;
}
export interface AdapterEventInput {
  provider: CaptureProvider;
  providerSessionId: string;
  cwd?: string;
  model?: string;
  hookEventName: string;
  turnId?: string;
  prompt?: string;
  lastAssistantMessage?: string | null;
  toolName?: string;
  toolInput?: unknown;
  toolResponse?: unknown;
  rawPayload?: unknown;
  provenance?: AdapterProvenance;
  /** Flattened provider-native fields, filled by scripts/capture-provider-event.ts. */
  transcriptPath?: string;
  agentTranscriptPath?: string;
  agentType?: string;
  client?: string;
  providerVersion?: string;
  stopHookActive?: boolean;
  source?: string;
  reason?: string;
}

function stableHash(parts: unknown[]): string {
  const serialized = parts.map((part) => (part === undefined ? '\u0000undef' : JSON.stringify(part))).join('\u0000');
  return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
function provenanceOf(input: AdapterEventInput): Record<string, unknown> {
  const extra = input.provenance ?? {};
  const merged: Record<string, unknown> = {};
  const candidates: Array<[string, unknown]> = [
    ['model', input.model ?? extra.model],
    ['client', input.client ?? extra.client],
    ['agentType', input.agentType ?? extra.agentType],
    ['providerVersion', input.providerVersion ?? extra.providerVersion],
    ['transcriptPath', input.transcriptPath ?? extra.transcriptPath],
    ['agentTranscriptPath', input.agentTranscriptPath ?? extra.agentTranscriptPath],
    ['stopHookActive', input.stopHookActive ?? extra.stopHookActive],
    ['source', input.source ?? extra.source],
    ['reason', input.reason ?? extra.reason],
    ['turnId', input.turnId ?? extra.turnId],
  ];
  for (const [key, value] of candidates) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
export function ingestProviderEvent(input: AdapterEventInput): { captureSessionId: string; accepted: string[]; duplicates: string[] } {
  return withProviderLock(input.provider, input.providerSessionId, () => {
    let state = readState(input.provider, input.providerSessionId);
    if (!state) {
      const session = createCaptureSession({
        provider: input.provider,
        providerSessionId: input.providerSessionId,
        captureSource: HOOK_PROVIDERS.has(input.provider) ? 'native-hook' : 'other',
      });
      state = { captureSessionId: session.captureSessionId, providerSessionId: input.providerSessionId, updatedAt: now() };
      saveState(input.provider, state);
    }
    const providerKey = `${input.provider}:${input.providerSessionId}`;
    const turnKey = input.turnId ?? 'session';
    const provenance = provenanceOf(input);
    const events: AppendCaptureEventInput[] = [];

    /**
     * Deterministic identities built from REAL stable provider fields only.
     * Messages collapse per turn so a retried/duplicated hook cannot produce two
     * messages; tool events include the tool name + payload so several distinct
     * tool invocations inside one assistant turn stay distinct.
     */
    const messageIdentity = (kind: string, content: string): string =>
      `${providerKey}:${input.turnId ? `t-${input.turnId}` : `c-${stableHash([content])}`}:${kind}`;
    const toolIdentity = (kind: string): string =>
      `${providerKey}:t-${turnKey}:${kind}:${stableHash([input.toolName, input.toolInput, input.hookEventName])}`;

    if (input.hookEventName === 'SessionStart') {
      events.push({
        eventId: `${providerKey}:${input.turnId ? `t-${input.turnId}` : 'session'}:start`,
        eventType: 'session.started',
        timestamp: now(),
        actor: 'system',
        affectedFiles: input.cwd ? [input.cwd] : undefined,
        attachments: [provenance],
        rawPayload: input.rawPayload,
      });
    }
    if (input.hookEventName === 'UserPromptSubmit' && input.prompt) {
      events.push({
        eventId: messageIdentity('user', input.prompt),
        eventType: 'user.message',
        timestamp: now(),
        actor: 'user',
        content: input.prompt,
        attachments: [provenance],
        rawPayload: input.rawPayload,
      });
    }
    if (input.hookEventName === 'PreToolUse') {
      events.push({
        eventId: toolIdentity('tool-start'),
        eventType: 'tool.started',
        timestamp: now(),
        actor: 'tool',
        toolCall: { name: input.toolName, input: input.toolInput, ...provenance },
        rawPayload: input.rawPayload,
      });
    }
    if (input.hookEventName === 'PostToolUse' || input.hookEventName === 'PostToolUseFailure') {
      const failed = input.hookEventName === 'PostToolUseFailure';
      events.push({
        eventId: toolIdentity('tool-done'),
        eventType: 'tool.completed',
        timestamp: now(),
        actor: 'tool',
        toolCall: { name: input.toolName, input: input.toolInput, ...provenance },
        toolResult: { output: input.toolResponse, ok: !failed, failed },
        rawPayload: input.rawPayload,
      });
    }
    if (input.hookEventName === 'Stop' && input.lastAssistantMessage) {
      events.push({
        eventId: messageIdentity('assistant', input.lastAssistantMessage),
        eventType: 'assistant.message',
        timestamp: now(),
        actor: 'assistant',
        content: input.lastAssistantMessage,
        attachments: [provenance],
        rawPayload: input.rawPayload,
      });
    }
    if (input.hookEventName === 'PreCompact') {
      events.push({
        eventId: `${providerKey}:t-${turnKey}:compact`,
        eventType: 'session.compacted',
        timestamp: now(),
        actor: 'system',
        attachments: [provenance],
        rawPayload: input.rawPayload,
      });
    }
    // SubagentStart / SubagentStop deliberately produce NO canonical event:
    // a subagent must never create its own main transcript entry. Its identity
    // is preserved only in the raw payload and provenance metadata.
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

/** Official CodeBuddy history root. Hook payloads hand us `transcript_path` inside this tree. */
function codebuddyHistoryRoot(): string {
  return path.join(process.env.HOME ?? '', '.local', 'share', 'CodeBuddyExtension', 'Data');
}

interface ContentPart { type?: string; text?: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown; }
interface StoredMessage { role?: string; message?: string; id?: string; createdAt?: string | number; }

function parseStoredMessage(raw: string): { role: string; content: ContentPart[] } | null {
  const container = JSON.parse(raw) as StoredMessage;
  if (typeof container.message !== 'string') return null;
  const inner = JSON.parse(container.message) as { role?: string; content?: ContentPart[] };
  return { role: inner.role ?? container.role ?? 'unknown', content: Array.isArray(inner.content) ? inner.content : [] };
}
function textOf(part: ContentPart): string { return typeof part.text === 'string' ? part.text : ''; }
function iso(value: string | number | undefined, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return fallback;
}

/**
 * Import an official CodeBuddy session transcript directory (index.json +
 * messages/<id>.json) into the shared Capture Kernel.
 *
 * The directory is *given to us* by the official hook payload's `transcript_path`
 * field, so this is not a guessed cache location. Still treated as an import
 * (not realtime): idempotent by messageId+part index, raw payload preserved.
 */
export async function importCodebuddyHistory(sourcePath: string): Promise<{ captureSessionId: string; imported: number }> {
  const resolved = path.resolve(sourcePath);
  const root = codebuddyHistoryRoot();
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`CodeBuddy transcript must be under ${root}`);
  }
  const sessionDir = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
  const providerSessionId = path.basename(sessionDir);
  const indexPath = path.join(sessionDir, 'index.json');
  const messagesDir = path.join(sessionDir, 'messages');
  if (!fs.existsSync(indexPath)) throw new Error(`CodeBuddy transcript index missing: ${indexPath}`);

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { requests?: Array<{ messages?: string[] }> };
  const orderedIds: string[] = [];
  for (const request of Array.isArray(index.requests) ? index.requests : []) {
    for (const id of request.messages ?? []) {
      if (typeof id === 'string' && !orderedIds.includes(id)) orderedIds.push(id);
    }
  }

  return withProviderLock('codebuddy', providerSessionId, () => {
    let state = readState('codebuddy', providerSessionId);
    if (!state) {
      const session = createCaptureSession({ provider: 'codebuddy', providerSessionId, captureSource: 'import' });
      state = { captureSessionId: session.captureSessionId, providerSessionId, updatedAt: now() };
      saveState('codebuddy', state);
    }

    const events: AppendCaptureEventInput[] = [];
    let sequence = 0;

    /**
     * Exact-duplicate suppression: some re-emissions (session resume, provider
     * re-sending the leading prompt) repeat identical conversation content under
     * a NEW provider message id, so id-based dedupe alone is not enough.
     * Suppressing identical (eventType + content) pairs keeps one correct message
     * without relying on content-only ids that would also drop genuinely repeated
     * short replies during a single pass.
     */
    const seenContent = new Set<string>();
    const contentKey = (eventType: string, content: string): string => `${eventType}|${stableHash([content])}`;
    try {
      const existing = fs.readFileSync(getCaptureStorePaths(state.captureSessionId).events, 'utf8').split('\n').filter(Boolean);
      for (const line of existing) {
        try {
          const prior = JSON.parse(line) as { eventType?: string; content?: string };
          if (prior.content && prior.eventType) seenContent.add(contentKey(prior.eventType, prior.content));
        } catch { continue; }
      }
    } catch { /* no prior events yet */ }

    for (const messageId of orderedIds) {
      const file = path.join(messagesDir, `${messageId}.json`);
      if (!fs.existsSync(file)) continue;
      let parsed: { role: string; content: ContentPart[] } | null = null;
      let containerRaw: StoredMessage | null = null;
      try {
        const raw = fs.readFileSync(file, 'utf8');
        containerRaw = JSON.parse(raw) as StoredMessage;
        parsed = parseStoredMessage(raw);
      } catch {
        parsed = null;
      }
      if (!parsed) continue;
      const stamp = iso(containerRaw?.createdAt, now());

      // Chat text first, in order. `reasoning` is internal and is NOT transcribed.
      const texts = parsed.content.filter((part) => part.type === 'text').map(textOf).filter(Boolean);
      if (texts.length > 0 && (parsed.role === 'user' || parsed.role === 'assistant')) {
        const content = texts.join('\n');
        const key = contentKey(parsed.role === 'user' ? 'user.message' : 'assistant.message', content);
        if (seenContent.has(key)) continue;
        seenContent.add(key);
        events.push({
          eventId: `codebuddy-transcript:${providerSessionId}:${messageId}:text`,
          eventType: parsed.role === 'user' ? 'user.message' : 'assistant.message',
          sequence: sequence++,
          timestamp: stamp,
          actor: parsed.role,
          content,
          attachments: [{ providerMessageId: messageId, captureSourceType: 'codebuddy-official-transcript' }],
          rawPayload: { file, role: parsed.role },
        });
      }

      // Tool events stay separate from the chat body (they are their own events).
      for (const [partIndex, part] of parsed.content.entries()) {
        if (part.type === 'tool-call') {
          events.push({
            eventId: `codebuddy-transcript:${providerSessionId}:${messageId}:call:${partIndex}`,
            eventType: 'tool.started',
            sequence: sequence++,
            timestamp: stamp,
            actor: 'tool',
            toolCall: { name: part.toolName, toolUseId: part.toolCallId, input: part.args },
            rawPayload: { file, part },
          });
        } else if (part.type === 'tool-result') {
          events.push({
            eventId: `codebuddy-transcript:${providerSessionId}:${messageId}:result:${partIndex}`,
            eventType: 'tool.completed',
            sequence: sequence++,
            timestamp: stamp,
            actor: 'tool',
            toolCall: { name: part.toolName, toolUseId: part.toolCallId },
            toolResult: { output: part.result, ok: true },
            rawPayload: { file, part },
          });
        }
      }
    }

    const result = events.length ? appendCaptureEvents(state.captureSessionId, events) : { accepted: [] };
    state.updatedAt = now(); saveState('codebuddy', state);
    return { captureSessionId: state.captureSessionId, imported: result.accepted.length };
  });
}
