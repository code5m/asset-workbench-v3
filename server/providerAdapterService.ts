import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getDataDir, getProjectRoot } from './config.ts';
import { currentSession } from './agentSessionService.ts';
import { isProviderEnabled } from './providerRuntimeState.ts';
import { appendCaptureEvents, createCaptureSession, endCaptureSession, getCaptureSession, getCaptureStorePaths } from './captureService.ts';
import type { AppendCaptureEventInput } from './captureService.ts';
import type { CaptureProvider } from '../src/domain/asset.ts';

export type ProviderAvailability = 'AVAILABLE' | 'ENABLED' | 'DISABLED' | 'NOT_INSTALLED' | 'NEEDS_AUTH' | 'LIMITED' | 'BLOCKED' | 'ERROR';
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
  const opencodePath = commandExists('opencode')
    ? 'opencode'
    : firstExistingPath([
      path.join(home, '.local', 'bin', 'opencode'),
      path.join(home, '.opencode', 'bin', 'opencode'),
      '/usr/local/bin/opencode',
      '/usr/bin/opencode',
    ]);
  // Official OpenCode plugin location for this workspace.
  const opencodePlugin = fs.existsSync(path.join(projectRoot, '.opencode', 'plugins', 'awb-capture.js'));
  const opencodeEvidence = runtimeVerificationFor('opencode');
  const traePath = commandExists('trae-cn') ? 'trae-cn' : fs.existsSync('/usr/bin/trae-cn') ? '/usr/bin/trae-cn' : undefined;
  // Official Trae workspace hook config.
  const traeHooks = readHookConfigured(path.join(projectRoot, '.trae', 'hooks.json'));
  const traeEvidence = runtimeVerificationFor('trae');
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
      status: !opencodePath ? 'NOT_INSTALLED' : opencodePlugin ? 'ENABLED' : 'AVAILABLE',
      captureMethod: 'official plugin (.opencode/plugins) event stream + official `opencode export` session import',
      realtime: true,
      historicalImport: true,
      runtimeVerified: opencodeEvidence.verified,
      lastVerifiedAt: opencodeEvidence.lastVerifiedAt,
      installed: Boolean(opencodePath),
      version: opencodePath ? probeVersion('opencode') : undefined,
      configured: opencodePlugin,
      capabilities: opencodePlugin
        ? ['realtime-plugin-events', 'official-session-export', 'semantic-stream-merge', 'raw-events', 'canonical-events', 'tool-events']
        : [],
      limitations: [
        'Streaming is merged semantically: many message.part.updated / delta events collapse to one assistant message per messageId.',
      ],
      detail: !opencodePath
        ? 'OpenCode executable not installed; no event source is reachable.'
        : opencodePlugin
          ? (opencodeEvidence.verified
            ? 'Official plugin installed and a real OpenCode session was captured and materialized into a transcript.'
            : 'Official plugin installed; awaiting a real captured OpenCode session.')
          : 'OpenCode detected but no capture plugin is installed in this workspace.',
    },
    {
      provider: 'trae',
      status: !traePath ? 'NOT_INSTALLED' : traeHooks ? 'LIMITED' : 'AVAILABLE',
      captureMethod: 'official workspace hooks (SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop/Notification); this build has no SessionEnd',
      realtime: true,
      historicalImport: false,
      runtimeVerified: traeEvidence.verified,
      lastVerifiedAt: traeEvidence.lastVerifiedAt,
      installed: Boolean(traePath),
      version: traePath ? probeVersion(traePath) : undefined,
      configured: traeHooks,
      capabilities: traeHooks
        ? ['realtime-hook-configured', 'user-prompt', 'tool-events', 'assistant-final-via-stop']
        : [],
      limitations: [
        'The installed build exposes NO SessionEnd lifecycle event, so session finalization cannot be auto-confirmed; none will be fabricated.',
        'Trae is an IDE product: a real AI turn requires an interactive logged-in Trae session, which cannot be driven headlessly here, so no real Trae event has been observed yet.',
      ],
      detail: !traePath
        ? 'No Trae executable or local state was detected.'
        : traeHooks
          ? (traeEvidence.verified
            ? 'Trae hooks installed and a real Trae capture was materialized into a transcript.'
            : 'Trae hooks are installed and the adapter is wired, but no real Trae AI turn has been observed yet (needs an interactive logged-in Trae session).')
          : 'Trae detected but no hook configuration is installed in this workspace.',
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
/**
 * A provider may report its cwd only at SessionStart. Pin that directory to
 * the first session and reject later conflicting evidence before any write.
 * Existing framework-self integrations remain permissive for legacy imports;
 * locked business Instances must never accept a different project root.
 */
function assertCaptureProject(sourceCwd: string | undefined, provider: string, sessionId: string): void {
  if (!sourceCwd) return;
  const expected = fs.realpathSync(getProjectRoot());
  let actual: string;
  try { actual = fs.realpathSync(path.resolve(sourceCwd)); }
  catch { throw new Error('Capture source project directory does not exist'); }
  if (actual !== expected) throw new Error(`Capture project mismatch for ${provider}/${sessionId}: expected ${expected}, got ${actual}`);
}
export function ingestProviderEvent(input: AdapterEventInput): { captureSessionId: string; accepted: string[]; duplicates: string[] } {
  if (!isProviderEnabled(input.provider)) return { captureSessionId: '', accepted: [], duplicates: [] };
  if (input.cwd) assertCaptureProject(input.cwd, input.provider, input.providerSessionId);
  return withProviderLock(input.provider, input.providerSessionId, () => {
    let state = readState(input.provider, input.providerSessionId);
    if (!state) {
      const activeAgent = currentSession();
      const linkedAgentSessionId =
        activeAgent &&
        activeAgent.closureStatus === 'active' &&
        activeAgent.projectRoot === getProjectRoot() &&
        activeAgent.agentType === input.provider
          ? activeAgent.id
          : undefined;
      const session = createCaptureSession({
        provider: input.provider,
        providerSessionId: input.providerSessionId,
        captureSource: HOOK_PROVIDERS.has(input.provider) ? 'native-hook' : 'other',
        agentSessionId: linkedAgentSessionId,
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
  if (!isProviderEnabled(provider)) return;
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
  if (typeof meta?.cwd === 'string' && meta.cwd.trim()) assertCaptureProject(meta.cwd, 'codex', providerSessionId);
  else if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('Codex history has no project cwd; cannot safely import into a bound Instance');
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

// ---------------------------------------------------------------------------
// OpenCode
// ---------------------------------------------------------------------------

/** One normalized OpenCode record: either a live plugin event or an export part. */
interface OpencodeRecord {
  type?: string;
  timestamp?: number | string;
  sessionID?: string;
  role?: string;
  part?: Record<string, any>;
  properties?: Record<string, any>;
}

function opencodePart(record: OpencodeRecord): Record<string, any> | null {
  const direct = record.part;
  if (direct && typeof direct === 'object') return direct;
  const nested = record.properties?.part ?? record.properties;
  if (nested && typeof nested === 'object' && 'type' in nested) return nested as Record<string, any>;
  return null;
}

/**
 * Merge OpenCode records into canonical events with SEMANTIC dedupe.
 *
 * OpenCode streams many `message.part.updated` / `text` events for one answer.
 * Every part is keyed by (messageID, partId), so repeated stream updates for the
 * same part overwrite in place and each assistant answer produces exactly ONE
 * `assistant.message`. Tool parts remain their own independent events.
 */
function opencodeRecordsToEvents(records: OpencodeRecord[], providerSessionId: string): AppendCaptureEventInput[] {
  interface Bucket { role: string; parts: Map<string, { index: number; part: Record<string, any> }>; }
  const messages = new Map<string, Bucket>();
  const order: string[] = [];
  let counter = 0;

  // Pass 1: authoritative roles from `message.updated` (properties.info.role).
  // Live plugin events do not carry a role on the part itself, so without this
  // pass user prompts would be misattributed to the assistant.
  const roles = new Map<string, string>();
  for (const record of records) {
    const info = (record.properties as any)?.info ?? (record as any).info;
    const id = typeof info?.id === 'string' ? info.id : undefined;
    if (id && typeof info.role === 'string') roles.set(id, info.role);
    const partIdMsg = typeof record.part?.messageID === 'string' ? record.part.messageID : undefined;
    if (partIdMsg && typeof record.role === 'string') roles.set(partIdMsg, record.role);
  }

  for (const record of records) {
    const part = opencodePart(record);
    if (!part) continue;
    const messageID = typeof part.messageID === 'string' ? part.messageID : `__nomessage_${counter}`;
    if (!messages.has(messageID)) {
      messages.set(messageID, { role: roles.get(messageID) ?? 'assistant', parts: new Map() });
      order.push(messageID);
    }
    const bucket = messages.get(messageID)!;
    const role = roles.get(messageID);
    if (role) bucket.role = role;
    const partId = typeof part.id === 'string' ? part.id : `part_${counter}`;
    // Same partId seen again = streaming update: overwrite, never append.
    if (!bucket.parts.has(partId)) bucket.parts.set(partId, { index: counter, part });
    else bucket.parts.set(partId, { index: bucket.parts.get(partId)!.index, part });
    counter += 1;
  }

  const events: AppendCaptureEventInput[] = [];
  let sequence = 0;
  const stamp = (value: unknown): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
    if (typeof value === 'string' && value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    return now();
  };

  for (const messageID of order) {
    const bucket = messages.get(messageID)!;
    const parts = [...bucket.parts.values()].sort((a, b) => a.index - b.index);

    // Chat text: all `text` parts of one message collapse into ONE message event.
    const texts = parts
      .filter((entry) => entry.part.type === 'text' && typeof entry.part.text === 'string' && entry.part.text.trim())
      .map((entry) => String(entry.part.text));
    if (texts.length > 0 && (bucket.role === 'user' || bucket.role === 'assistant')) {
      events.push({
        eventId: `opencode:${providerSessionId}:${messageID}:text`,
        eventType: bucket.role === 'user' ? 'user.message' : 'assistant.message',
        sequence: sequence++,
        timestamp: stamp(parts[0]?.part?.time?.start ?? parts[0]?.part?.time?.created),
        actor: bucket.role,
        content: texts.join('\n'),
        attachments: [{ providerMessageId: messageID, captureSourceType: 'opencode-official' }],
      });
    }

    // Tool parts stay independent canonical events.
    for (const entry of parts) {
      if (entry.part.type !== 'tool') continue;
      const state = (entry.part.state ?? {}) as Record<string, any>;
      const partId = String(entry.part.id ?? `tool_${entry.index}`);
      events.push({
        eventId: `opencode:${providerSessionId}:${messageID}:tool:${partId}`,
        eventType: 'tool.completed',
        sequence: sequence++,
        timestamp: stamp(state.time?.end ?? state.time?.start),
        actor: 'tool',
        toolCall: { name: entry.part.tool, toolUseId: entry.part.callID, input: state.input },
        toolResult: { output: state.output, ok: state.status !== 'error', status: state.status },
        attachments: [{ providerMessageId: messageID, partId }],
      });
    }
  }
  return events;
}

function opencodeWithSession(providerSessionId: string, captureSource: 'native-hook' | 'import', events: AppendCaptureEventInput[]) {
  return withProviderLock('opencode', providerSessionId, () => {
    let state = readState('opencode', providerSessionId);
    if (!state) {
      const session = createCaptureSession({ provider: 'opencode', providerSessionId, captureSource });
      state = { captureSessionId: session.captureSessionId, providerSessionId, updatedAt: now() };
      saveState('opencode', state);
    }
    // Cumulative exports include old events again. Remove already-stored event
    // identities BEFORE assigning sequence numbers, then number only newly
    // accepted events contiguously after the current tail. This prevents false
    // sequence gaps on V1 -> cumulative V2 imports.
    const existingIds = new Set<string>();
    try {
      const lines = fs.readFileSync(getCaptureStorePaths(state.captureSessionId).events, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const prior = JSON.parse(line) as { eventId?: string };
          if (prior.eventId) existingIds.add(prior.eventId);
        } catch { continue; }
      }
    } catch { /* first import */ }

    const newEvents = events.filter((event) => !existingIds.has(event.eventId));
    let offset = 0;
    try {
      const current = getCaptureSession(state.captureSessionId);
      if (typeof current.lastSequence === 'number') offset = current.lastSequence + 1;
    } catch { offset = 0; }
    newEvents.forEach((event, index) => { event.sequence = offset + index; });
    const result = newEvents.length ? appendCaptureEvents(state.captureSessionId, newEvents) : { accepted: [] };
    state.updatedAt = now(); saveState('opencode', state);
    return { captureSessionId: state.captureSessionId, imported: result.accepted.length };
  });
}

/** Drain the fail-open plugin inbox (`.opencode/plugins/awb-capture.js`) into the Capture Kernel. */
export function importOpencodeInbox(inboxPath: string): { captureSessionId: string; imported: number } {
  const records: OpencodeRecord[] = fs.readFileSync(inboxPath, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as OpencodeRecord]; } catch { return []; }
  });
  const sessionIds = new Set<string>();
  for (const record of records) {
    const sid = record.sessionID ?? (record.part as any)?.sessionID ?? (record.properties as any)?.sessionID;
    if (typeof sid === 'string') sessionIds.add(sid);
  }
  if (sessionIds.size === 0) throw new Error('no OpenCode session id found in inbox');
  let last = { captureSessionId: '', imported: 0 };
  for (const sid of sessionIds) {
    const scoped = records.filter((record) => {
      const s = record.sessionID ?? (record.part as any)?.sessionID ?? (record.properties as any)?.sessionID;
      return s === sid;
    });
    last = opencodeWithSession(sid, 'native-hook', opencodeRecordsToEvents(scoped, sid));
  }
  return last;
}

/** Import an official `opencode export <sessionID>` JSON into the Capture Kernel. */
export function importOpencodeSession(exportPath: string): { captureSessionId: string; imported: number } {
  const parsed = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
    info?: { id?: string; model?: { id?: string; providerID?: string }; agent?: string; version?: string };
    messages?: Array<{ info?: { id?: string; role?: string; time?: { created?: number } }; parts?: Array<Record<string, any>> }>;
  };
  const providerSessionId = parsed.info?.id;
  if (!providerSessionId) throw new Error('OpenCode export missing info.id');

  const records: OpencodeRecord[] = [];
  for (const message of parsed.messages ?? []) {
    const role = message.info?.role ?? 'assistant';
    for (const part of message.parts ?? []) {
      records.push({
        type: typeof part.type === 'string' ? part.type : undefined,
        timestamp: message.info?.time?.created,
        sessionID: providerSessionId,
        role,
        part,
      });
    }
  }
  const events = opencodeRecordsToEvents(records, providerSessionId);
  // Preserve real provider provenance on every event.
  const provenance = {
    model: parsed.info?.model?.id ? `${parsed.info.model.providerID ?? 'opencode'}/${parsed.info.model.id}` : undefined,
    agentId: parsed.info?.agent,
    providerVersion: parsed.info?.version,
  };
  for (const event of events) {
    event.attachments = [...(event.attachments ?? []), provenance];
  }
  return opencodeWithSession(providerSessionId, 'import', events);
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

    // Provider message identity is the dedupe key. Identical text in two
    // different provider messages is legitimate conversation evidence and must
    // be preserved. appendCaptureEvents remains idempotent by eventId.

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
