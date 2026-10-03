import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProjectRoot, getDataDir } from './config.ts';
import type { AgentSession, AgentType, CaptureMode } from '../src/domain/asset';

/**
 * Agent Session lifecycle.
 *
 * An AgentSession is a single work-execution record for one task. It is NOT a
 * Conversation: the session is the "what the agent did" envelope, while the
 * Conversation is the knowledge evidence asset it may produce.
 *
 * Sessions live under the workbench runtime data
 * (`<projectRoot>/.asset-workbench-data/agent-sessions/`), which the Scanner
 * ignores and .gitignore excludes. They are persisted as plain JSON so the
 * CLI (Node only, no browser) can read/write them and so they survive a dev
 * server restart.
 */

export const AGENT_SESSION_SCHEMA_VERSION = 1;

function sessionDir(): string {
  return path.join(getDataDir(), 'agent-sessions');
}
function currentDir(): string {
  return path.join(getDataDir(), 'current-session');
}
function sessionFile(id: string): string {
  return path.join(sessionDir(), `${id}.json`);
}
function currentPointerFile(): string {
  return path.join(currentDir(), 'session-id');
}

function ensureDirs(): void {
  fs.mkdirSync(sessionDir(), { recursive: true });
  fs.mkdirSync(currentDir(), { recursive: true });
}

function newId(): string {
  return `session_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

function readSessionFile(id: string): AgentSession | null {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(id), 'utf8')) as AgentSession;
  } catch {
    return null;
  }
}

export interface CreateSessionInput {
  agentType: AgentType;
  taskTitle: string;
  taskSummary?: string;
  captureMode?: CaptureMode;
}

export interface CreateSessionResult {
  session: AgentSession;
  /** Previously active session that was marked interrupted because it was never closed. */
  interruptedPrevious: AgentSession | null;
}

export function createSession(input: CreateSessionInput): CreateSessionResult {
  ensureDirs();
  const prevId = currentSessionId();
  let interruptedPrevious: AgentSession | null = null;
  if (prevId) {
    const prev = readSessionFile(prevId);
    if (prev && prev.closureStatus === 'active') {
      interruptedPrevious = updateSession(prevId, { closureStatus: 'interrupted', completedAt: nowIso() });
    }
  }
  const id = newId();
  const session: AgentSession = {
    schemaVersion: AGENT_SESSION_SCHEMA_VERSION,
    id,
    agentType: input.agentType,
    startedAt: nowIso(),
    completedAt: null,
    taskTitle: (input.taskTitle ?? '').trim() || 'Untitled Agent Task',
    taskSummary: input.taskSummary ?? '',
    workspaceId: 'asset-workbench',
    projectRoot: getProjectRoot(),
    captureMode: input.captureMode ?? 'agent-work-record',
    captureStatus: 'pending',
    conversationAssetId: undefined,
    workRecordAssetId: undefined,
    transcriptAssetId: undefined,
    transcriptCaptureStatus: 'unavailable',
    resultingDesignIds: [],
    resultingDecisionIds: [],
    affectedAssetPaths: [],
    closureStatus: 'active',
  };
  fs.writeFileSync(sessionFile(id), JSON.stringify(session, null, 2), 'utf8');
  fs.writeFileSync(currentPointerFile(), id, 'utf8');
  return { session, interruptedPrevious };
}

export function currentSessionId(): string | null {
  try {
    return fs.readFileSync(currentPointerFile(), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

export function currentSession(): AgentSession | null {
  const id = currentSessionId();
  return id ? readSessionFile(id) : null;
}

export function readSession(id: string): AgentSession | null {
  return readSessionFile(id);
}

export function updateSession(id: string, patch: Partial<AgentSession>): AgentSession {
  const existing = readSessionFile(id);
  if (!existing) throw new SessionError(`session not found: ${id}`);
  const merged: AgentSession = { ...existing, ...patch, id: existing.id, schemaVersion: existing.schemaVersion };
  fs.writeFileSync(sessionFile(id), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export function listSessions(): AgentSession[] {
  ensureDirs();
  const out: AgentSession[] = [];
  try {
    for (const name of fs.readdirSync(sessionDir())) {
      if (!name.endsWith('.json')) continue;
      const s = readSessionFile(name.replace(/\.json$/, ''));
      if (s) out.push(s);
    }
  } catch {
    // empty
  }
  return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
