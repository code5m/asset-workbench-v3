import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertSafeEnterpriseManagedPath, canonicalEnterpriseRoot, readEnterpriseRegistry } from './enterpriseStorage.ts';
import { appendEnterprisePrivateFile, readEnterprisePrivateFile, writeEnterprisePrivateAtomic } from './enterprisePrivateIO.ts';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const PROVIDERS = new Set(['codex', 'codebuddy', 'trae', 'opencode', 'codearts', 'chatgpt', 'workbuddy', 'other']);
type Role = 'user' | 'assistant' | 'system' | 'tool' | 'session';
export interface EnterpriseProviderEvent {
  provider: string; providerSessionId: string; hookEventName: string;
  cwd?: string; observedCwd?: string; eventId?: string;
  timestamp?: string; rawPayload?: Record<string, unknown>;
  role?: Role; content?: string;
  captureSource?: 'native-hook' | 'official-import';
}
export interface EnterpriseCaptureState {
  schemaVersion: 1; id: string; workspaceId: string; projectRoot: string;
  repository: string | null; module: string | null; cwd: string;
  provider: string; providerSessionId: string; captureSource: 'native-hook' | 'official-import';
  startedAt: string; updatedAt: string; endedAt?: string; status: 'active' | 'ended';
  acceptedEvents: number; duplicates: number;
  attribution: 'observed-process-cwd' | 'provider-reported-cwd';
  transcriptPath?: string;
}
export interface EnterpriseCaptureResult {
  state: EnterpriseCaptureState; accepted: boolean; duplicate: boolean;
}
const safeString = (v: unknown, name: string, max = 4096): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('Invalid ' + name);
  return v.trim();
};
function within(p: string, root: string): boolean {
  return p === root || p.startsWith(root + path.sep);
}
function canonicalDir(input: string) {
  const real = fs.realpathSync(path.resolve(input));
  if (!fs.statSync(real).isDirectory()) throw new Error('Hook cwd must be a directory');
  return real;
}
function moduleFrom(cwd: string, repo: string, root: string): string | null {
  if (!within(cwd, repo)) return null;
  let dir = cwd;
  while (within(dir, repo)) {
    if (fs.existsSync(path.join(dir, 'pom.xml'))) return path.relative(root, dir).split(path.sep).join('/') || '.';
    if (dir === repo) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
function gitRepo(cwd: string, root: string): string | null {
  try {
    const git = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', timeout: 3500, stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }).trim();
    const canonical = canonicalDir(git);
    return within(canonical, root) ? canonical : null;
  } catch { return null; }
}
export function resolveEnterpriseProviderOrigin(cwd: string, observedCwd?: string): {
  workspaceId: string; projectRoot: string; cwd: string; repository: string | null;
  module: string | null; attribution: EnterpriseCaptureState['attribution'];
} {
  const actual = canonicalDir(cwd);
  const entries = readEnterpriseRegistry().filter(row => row.sourcePolicy === 'managed'
    && within(actual, row.projectRoot)).sort((a,b) => b.projectRoot.length - a.projectRoot.length);
  const selected = entries[0];
  if (!selected) throw new Error('No registered managed enterprise workspace covers the provider cwd');
  const projectRoot = canonicalEnterpriseRoot(selected.projectRoot);
  if (projectRoot !== selected.projectRoot) throw new Error('Managed workspace canonical root changed');
  const rel = path.relative(projectRoot, actual).split(path.sep);
  if (rel.includes('.asset-workbench-data') || rel.includes('.git')) throw new Error('Provider event originated in a private/ignored directory');
  let attribution: EnterpriseCaptureState['attribution'] = 'provider-reported-cwd';
  if (observedCwd) {
    const seen = canonicalDir(observedCwd);
    if (!within(seen, projectRoot)) {
      throw new Error('Hook process cwd outside the provider-reported managed workspace');
    }
    if (seen !== actual) throw new Error('Hook process cwd and reported project cwd disagree');
    attribution = 'observed-process-cwd';
  }
  const repo = gitRepo(actual, projectRoot);
  const relativeRepo = repo ? path.relative(projectRoot, repo).split(path.sep).join('/') || '.' : null;
  return {
    workspaceId: selected.workspaceId, projectRoot, cwd: actual,
    repository: relativeRepo, module: repo ? moduleFrom(actual, repo, projectRoot) : null, attribution,
  };
}
function sessionDirectory(root: string, id: string) {
  if (!/^enterprise_capture_[0-9a-f]{48}$/.test(id)) throw new Error('Invalid enterprise capture ID');
  return assertSafeEnterpriseManagedPath(root, 'capture/sessions/' + id);
}
function redactedPayload(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 250).map(x => redactedPayload(x, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 150).map(([key, data]) =>
      [key, /(password|authorization|access.?token|api.?key|private.?key|secret|credential)/i.test(key)
        ? '[redacted]' : redactedPayload(data, depth + 1)]));
  }
  if (typeof value === 'string') return value.slice(0, 100_000);
  return value;
}
function withLock<T>(dir: string, task: () => T): T {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = dir + '.lock';
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let tries = 0; tries < 200; tries++) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      try { return task(); } finally { fs.rmdirSync(lock); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 30_000) fs.rmdirSync(lock);
      } catch { /* another hook may have released it */ }
      Atomics.wait(wait, 0, 0, 10);
    }
  }
  throw new Error('Enterprise capture session is busy');
}
function jsonAtomic(file: string, body: unknown) {
  writeEnterprisePrivateAtomic(file, JSON.stringify(body, null, 2) + '\n');
}
function finalizeEndedEnterpriseCapture(root: string, state: EnterpriseCaptureState, log: string): boolean {
  const records = readEnterprisePrivateFile(log).toString('utf8').split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as { kind: string; timestamp: string; content: string });
  const ended = records.find(row => row.kind === 'session.ended');
  if (!ended) return false;
  const conversation = assertSafeEnterpriseManagedPath(root, 'conversations/transcripts');
  fs.mkdirSync(conversation, { recursive: true, mode: 0o700 });
  const md = ['# Provider 会话记录', '', '- Workspace: ' + state.workspaceId,
    '- Repository: ' + (state.repository || 'unresolved'),
    '- Module: ' + (state.module || 'unresolved'), '- Provider: ' + state.provider,
    '- Session ID: ' + state.providerSessionId, '',
    ...records.flatMap(row => row.content
      ? ['## ' + row.kind + ' · ' + row.timestamp, '', row.content, ''] : [])].join('\n');
  const name = state.id + '.md';
  writeEnterprisePrivateAtomic(path.join(conversation, name), md + '\n');
  state.transcriptPath = 'conversations/transcripts/' + name;
  state.status = 'ended'; state.endedAt = ended.timestamp;
  return true;
}
function eventKind(name: string, role?: Role) {
  const lower = name.toLowerCase();
  if (lower === 'sessionstart' || lower === 'session.started') return 'session.started';
  if (lower === 'sessionend' || lower === 'session.ended') return 'session.ended';
  if (lower === 'userpromptsubmit' || role === 'user') return 'user.message';
  if (lower === 'stop' || role === 'assistant') return 'assistant.message';
  if (lower === 'pretooluse' || lower === 'tool.execute.before') return 'tool.started';
  if (lower === 'posttooluse' || lower === 'posttoolusefailure' || lower === 'tool.execute.after') return 'tool.completed';
  if (lower === 'notification') return 'system.message';
  return 'other';
}
function contentFor(input: EnterpriseProviderEvent): string {
  if (input.content) return input.content.slice(0, 200_000);
  const raw = input.rawPayload || {};
  for (const key of ['prompt', 'last_assistant_message', 'message', 'text']) {
    if (typeof raw[key] === 'string') return (raw[key] as string).slice(0, 200_000);
  }
  return '';
}
export function appendEnterpriseProviderEvent(input: EnterpriseProviderEvent): EnterpriseCaptureResult {
  const provider = safeString(input.provider, 'provider', 80).toLowerCase();
  if (!PROVIDERS.has(provider)) throw new Error('Provider not supported');
  const providerSessionId = safeString(input.providerSessionId, 'providerSessionId', 300);
  const hookEventName = safeString(input.hookEventName, 'hookEventName', 100);
  const origin = resolveEnterpriseProviderOrigin(safeString(input.cwd, 'cwd'), input.observedCwd);
  const id = 'enterprise_capture_' + digest(origin.workspaceId + ':' + provider + ':' + providerSessionId).slice(0, 48);
  const dir = sessionDirectory(origin.projectRoot, id);
  const eventId = input.eventId?.trim()
    || digest(JSON.stringify({ hookEventName, timestamp: input.timestamp, input: redactedPayload(input.rawPayload) }));
  const time = input.timestamp && Number.isFinite(Date.parse(input.timestamp)) ? input.timestamp : new Date().toISOString();
  return withLock(dir, () => {
    const file = path.join(dir, 'state.json');
    let state: EnterpriseCaptureState;
    if (fs.existsSync(file)) {
      state = JSON.parse(readEnterprisePrivateFile(file, 512 * 1024).toString('utf8')) as EnterpriseCaptureState;
      if (state.workspaceId !== origin.workspaceId || state.projectRoot !== origin.projectRoot
        || state.provider !== provider || state.providerSessionId !== providerSessionId
        || state.repository !== origin.repository || state.cwd !== origin.cwd) {
        throw new Error('Provider session identity or repository changed (cross-project capture rejected)');
      }
    } else {
      state = {
        schemaVersion: 1, id, workspaceId: origin.workspaceId, projectRoot: origin.projectRoot,
        repository: origin.repository, module: origin.module, cwd: origin.cwd,
        provider, providerSessionId, captureSource: input.captureSource || 'native-hook', status: 'active',
        startedAt: time, updatedAt: time, acceptedEvents: 0, duplicates: 0,
        attribution: origin.attribution,
      };
      jsonAtomic(file, state);
    }
    const log = path.join(dir, 'events.jsonl');
    const prior = fs.existsSync(log) ? readEnterprisePrivateFile(log).toString('utf8') : '';
    const exists = prior.split('\n').filter(Boolean).some(line => {
      try { return (JSON.parse(line) as { eventId?: string }).eventId === eventId; }
      catch { throw new Error('Corrupt enterprise capture log, append refused'); }
    });
    if (exists) {
      // The process may have crashed after appending SessionEnd but before
      // materializing the transcript. An idempotent retry must repair it.
      if (state.status !== 'ended') finalizeEndedEnterpriseCapture(origin.projectRoot, state, log);
      state.duplicates++;
      jsonAtomic(file, state);
      return { state, accepted: false, duplicate: true };
    }
    if (state.status === 'ended') throw new Error('Ended provider session cannot be reopened');
    const event = {
      eventId, kind: eventKind(hookEventName, input.role), hookEventName, timestamp: time,
      role: input.role || null, content: contentFor(input),
      provider, providerSessionId, workspaceId: origin.workspaceId,
      repository: origin.repository, module: origin.module, attribution: origin.attribution,
      rawPayload: redactedPayload(input.rawPayload || {}),
    };
    appendEnterprisePrivateFile(log, JSON.stringify(event) + '\n');
    state.acceptedEvents++;
    state.updatedAt = time;
    if (event.kind === 'session.ended') {
      finalizeEndedEnterpriseCapture(origin.projectRoot, state, log);
    }
    jsonAtomic(file, state);
    return { state, accepted: true, duplicate: false };
  });
}
export function listEnterpriseProviderSessions(rootInput: string, max = 200): EnterpriseCaptureState[] {
  const root = canonicalEnterpriseRoot(rootInput);
  const dir = assertSafeEnterpriseManagedPath(root, 'capture/sessions');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(id => /^enterprise_capture_[0-9a-f]{48}$/.test(id)).flatMap(id => {
    try {
      const state = JSON.parse(readEnterprisePrivateFile(path.join(sessionDirectory(root, id), 'state.json'), 512 * 1024).toString('utf8')) as EnterpriseCaptureState;
      return state.projectRoot === root && state.workspaceId === readEnterpriseRegistry().find(x => x.projectRoot === root)?.workspaceId ? [state] : [];
    } catch { return []; }
  }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, Math.min(500, Math.max(1, max)));
}
export function readEnterpriseCaptureEvents(rootInput: string, id: string): unknown[] {
  const root = canonicalEnterpriseRoot(rootInput);
  const dir = sessionDirectory(root, id);
  const state = JSON.parse(readEnterprisePrivateFile(path.join(dir, 'state.json'), 512 * 1024).toString('utf8')) as EnterpriseCaptureState;
  if (state.projectRoot !== root || state.id !== id
    || state.workspaceId !== readEnterpriseRegistry().find(item => item.projectRoot === root)?.workspaceId) {
    throw new Error('Enterprise Provider session identity mismatch');
  }
  // Raw hook payloads may contain application-specific secrets even after key
  // redaction. This public UI endpoint intentionally never returns them.
  const records = readEnterprisePrivateFile(path.join(dir, 'events.jsonl')).toString('utf8')
    .split('\n').filter(Boolean).slice(-200);
  return records.map(line => {
    const event = JSON.parse(line) as {
      eventId: string; kind: string; timestamp: string; content: string;
      repository: string | null; module: string | null; provider: string;
    };
    return {
      eventId: event.eventId, kind: event.kind, timestamp: event.timestamp,
      content: event.content, repository: event.repository, module: event.module,
      provider: event.provider,
    };
  });
}
