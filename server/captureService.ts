import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDataDir } from './config.ts';
import { createTranscript, findAssetById, patchAssetMetadataById } from './managedAssetService.ts';
import { readSession, updateSession } from './agentSessionService.ts';
import type {
  CanonicalCaptureEvent,
  CaptureEventType,
  CaptureProvider,
  CaptureSession,
  CaptureSource,
  ConversationSource,
  ManagedAssetResult,
} from '../src/domain/asset.ts';

const PROVIDERS = new Set<CaptureProvider>(['chatgpt', 'codex', 'codebuddy', 'trae', 'opencode', 'codearts', 'workbuddy', 'other']);
const SOURCES = new Set<CaptureSource>(['native-hook', 'acp', 'provider-api', 'import', 'manual', 'test', 'other']);
const EVENT_TYPES = new Set<CaptureEventType>([
  'session.started', 'user.message', 'assistant.message', 'system.message', 'tool.started', 'tool.completed',
  'file.changed', 'session.compacted', 'artifact.produced', 'session.ended',
]);

export class CaptureError extends Error {}
export class CaptureNotFoundError extends CaptureError {}
export class CaptureConflictError extends CaptureError {}

export interface CreateCaptureSessionInput {
  provider: CaptureProvider;
  providerSessionId: string;
  captureSource: CaptureSource;
  workspaceId?: string;
  agentSessionId?: string;
}
export interface AppendCaptureEventInput {
  eventId: string;
  eventType: CaptureEventType;
  sequence?: number;
  timestamp: string;
  actor?: string;
  content?: string;
  parentEventId?: string;
  parentSessionId?: string;
  toolCall?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  affectedFiles?: string[];
  attachments?: Array<Record<string, unknown>>;
  rawPayload?: unknown;
}

function captureRoot(): string { return path.join(getDataDir(), 'capture', 'sessions'); }
function sessionDir(id: string): string { return path.join(captureRoot(), id); }
function statePath(id: string): string { return path.join(sessionDir(id), 'state.json'); }
function eventsPath(id: string): string { return path.join(sessionDir(id), 'events.jsonl'); }
function rawEventsPath(id: string): string { return path.join(sessionDir(id), 'raw-events.jsonl'); }
function now(): string { return new Date().toISOString(); }
function safeString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CaptureError(`${field} is required`);
  if (value.length > 10_000) throw new CaptureError(`${field} is too long`);
  return value.trim();
}
function assertProvider(value: unknown): CaptureProvider {
  if (typeof value !== 'string' || !PROVIDERS.has(value as CaptureProvider)) throw new CaptureError('invalid provider');
  return value as CaptureProvider;
}
function assertSource(value: unknown): CaptureSource {
  if (typeof value !== 'string' || !SOURCES.has(value as CaptureSource)) throw new CaptureError('invalid captureSource');
  return value as CaptureSource;
}
function assertSessionId(id: string): string {
  if (!/^capture_[0-9a-f-]{36}$/.test(id)) throw new CaptureError('invalid captureSessionId');
  return id;
}
function writeJsonAtomic(target: string, value: unknown): void {
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, target);
}
function appendJsonl(target: string, value: unknown): void {
  const fd = fs.openSync(target, 'a');
  try {
    fs.writeSync(fd, `${JSON.stringify(value)}\n`, undefined, 'utf8');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}
function readState(id: string): CaptureSession {
  assertSessionId(id);
  try { return JSON.parse(fs.readFileSync(statePath(id), 'utf8')) as CaptureSession; }
  catch { throw new CaptureNotFoundError(`capture session not found: ${id}`); }
}
function readJsonl<T>(target: string): T[] {
  try {
    return fs.readFileSync(target, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as T]; } catch { return []; }
    });
  } catch { return []; }
}
function persistState(state: CaptureSession): void { writeJsonAtomic(statePath(state.captureSessionId), state); }
function sourceFor(provider: CaptureProvider): ConversationSource {
  const supported: ConversationSource[] = ['chatgpt', 'codex', 'codebuddy', 'opencode', 'trae', 'codearts', 'workbuddy', 'manual', 'other'];
  return supported.includes(provider as ConversationSource) ? (provider as ConversationSource) : 'other';
}

export function createCaptureSession(input: CreateCaptureSessionInput): CaptureSession {
  const provider = assertProvider(input.provider);
  const captureSource = assertSource(input.captureSource);
  const providerSessionId = safeString(input.providerSessionId, 'providerSessionId');
  const id = `capture_${crypto.randomUUID()}`;
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const state: CaptureSession = {
    schemaVersion: 1, captureSessionId: id, provider, providerSessionId,
    workspaceId: input.workspaceId?.trim() || 'asset-workbench', captureSource, status: 'active',
    sequenceGaps: [], orderingWarnings: [], startedAt: now(), agentSessionId: input.agentSessionId,
  };
  writeJsonAtomic(statePath(id), state);
  fs.writeFileSync(eventsPath(id), '', 'utf8');
  fs.writeFileSync(rawEventsPath(id), '', 'utf8');
  return state;
}

export interface AppendResult { accepted: string[]; duplicates: string[]; warnings: string[]; }
export function appendCaptureEvents(captureSessionId: string, inputs: AppendCaptureEventInput[]): AppendResult {
  const state = readState(captureSessionId);
  if (state.status !== 'active') throw new CaptureConflictError(`capture session is ${state.status}`);
  if (!Array.isArray(inputs) || inputs.length === 0) throw new CaptureError('events must be a non-empty array');
  const existing = new Set(readJsonl<CanonicalCaptureEvent>(eventsPath(captureSessionId)).map((event) => event.eventId));
  const result: AppendResult = { accepted: [], duplicates: [], warnings: [] };
  for (const input of inputs) {
    const eventId = safeString(input.eventId, 'eventId');
    if (existing.has(eventId)) { result.duplicates.push(eventId); continue; }
    if (!EVENT_TYPES.has(input.eventType)) throw new CaptureError('invalid eventType');
    const timestamp = safeString(input.timestamp, 'timestamp');
    if (Number.isNaN(Date.parse(timestamp))) throw new CaptureError('timestamp must be ISO-compatible');
    if (input.sequence !== undefined && (!Number.isInteger(input.sequence) || input.sequence < 0)) throw new CaptureError('sequence must be a non-negative integer');
    const event: CanonicalCaptureEvent = {
      schemaVersion: 1, eventId, eventType: input.eventType, sequence: input.sequence, timestamp,
      actor: input.actor, content: input.content, parentEventId: input.parentEventId, parentSessionId: input.parentSessionId,
      toolCall: input.toolCall, toolResult: input.toolResult, affectedFiles: input.affectedFiles, attachments: input.attachments,
      provider: state.provider, providerSessionId: state.providerSessionId, captureSessionId, workspaceId: state.workspaceId,
      captureSource: state.captureSource,
    };
    appendJsonl(rawEventsPath(captureSessionId), { receivedAt: now(), payload: input.rawPayload ?? input });
    appendJsonl(eventsPath(captureSessionId), event);
    existing.add(eventId); result.accepted.push(eventId);
    if (event.sequence !== undefined) {
      if (state.lastSequence !== undefined && event.sequence > state.lastSequence + 1) {
        state.sequenceGaps.push({ after: state.lastSequence, before: event.sequence });
        const warning = `sequence gap: ${state.lastSequence} -> ${event.sequence}`;
        state.orderingWarnings.push(warning); result.warnings.push(warning);
      } else if (state.lastSequence !== undefined && event.sequence <= state.lastSequence) {
        const warning = `out-of-order sequence: ${event.sequence} after ${state.lastSequence}`;
        state.orderingWarnings.push(warning); result.warnings.push(warning);
      }
      state.firstSequence = state.firstSequence === undefined ? event.sequence : Math.min(state.firstSequence, event.sequence);
      state.lastSequence = state.lastSequence === undefined ? event.sequence : Math.max(state.lastSequence, event.sequence);
    }
    state.lastEventAt = timestamp;
  }
  persistState(state);
  return result;
}

function renderTranscript(events: CanonicalCaptureEvent[]): string {
  const ordered = [...events].sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.timestamp.localeCompare(b.timestamp));
  const blocks = ['# Conversation Transcript', ''];
  for (const event of ordered) {
    if (event.eventType === 'user.message' || event.eventType === 'assistant.message' || event.eventType === 'system.message') {
      const role = event.eventType.split('.')[0];
      blocks.push(`## ${role[0].toUpperCase()}${role.slice(1)}`, '', event.content ?? '', '');
    } else if (event.eventType === 'tool.started' || event.eventType === 'tool.completed') {
      blocks.push(`## Tool (${event.eventType === 'tool.started' ? 'started' : 'completed'})`, '', 'Tool event preserved in the capture event stream.', '');
    }
  }
  return `${blocks.join('\n').trimEnd()}\n`;
}

export interface EndCaptureResult { session: CaptureSession; transcript: ManagedAssetResult; completeness: 'full' | 'partial'; }
export async function endCaptureSession(captureSessionId: string): Promise<EndCaptureResult> {
  const state = readState(captureSessionId);
  if (state.status === 'ended' && state.transcriptAssetId) throw new CaptureConflictError('capture session already ended');
  if (state.status !== 'active') throw new CaptureConflictError(`capture session is ${state.status}`);
  const events = readJsonl<CanonicalCaptureEvent>(eventsPath(captureSessionId));
  const messageCount = events.filter((event) => event.eventType === 'user.message' || event.eventType === 'assistant.message' || event.eventType === 'system.message').length;
  const completeness = state.sequenceGaps.length > 0 || messageCount === 0 ? 'partial' : 'full';
  const transcript = await createTranscript({
    title: `Capture ${state.provider} ${captureSessionId.slice(-8)}`,
    source: sourceFor(state.provider), content: renderTranscript(events), captureMode: 'full-transcript', completeness,
    sourceSessionId: state.providerSessionId, agentSessionId: state.agentSessionId,
    sourceMetadata: { provider: state.provider, captureSource: state.captureSource, captureSessionId, eventCount: events.length },
  });
  state.status = 'ended'; state.endedAt = now(); state.transcriptAssetId = transcript.id; persistState(state);
  if (state.agentSessionId) {
    const agent = readSession(state.agentSessionId);
    if (agent) {
      const workRecordId = agent.workRecordAssetId ?? agent.conversationAssetId;
      if (workRecordId && findAssetById(workRecordId)) {
        await patchAssetMetadataById(workRecordId, { sourceTranscriptId: transcript.id, transcriptCaptureStatus: completeness === 'full' ? 'available' : 'partial' });
        await patchAssetMetadataById(transcript.id, { workRecordId });
      }
      updateSession(state.agentSessionId, {
        transcriptAssetId: transcript.id,
        transcriptCaptureStatus: completeness === 'full' ? 'available' : 'partial',
      });
    }
  }
  return { session: state, transcript, completeness };
}

export function getCaptureSession(captureSessionId: string): CaptureSession { return readState(captureSessionId); }
export function getCaptureStorePaths(captureSessionId: string): { state: string; rawEvents: string; events: string } {
  assertSessionId(captureSessionId);
  return { state: statePath(captureSessionId), rawEvents: rawEventsPath(captureSessionId), events: eventsPath(captureSessionId) };
}
