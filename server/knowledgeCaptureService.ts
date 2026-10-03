import fs from 'node:fs';
import path from 'node:path';
import { getProjectRoot } from './config.ts';
import type { AgentSession, ConversationSource, DecisionStatus, ManagedAssetMetadata, ManagedAssetResult } from '../src/domain/asset';
import {
  createConversation,
  createTranscript,
  patchAssetMetadataById,
  promoteConversationToDesign,
  promoteDesignToDecision,
  createDecision,
  updateDesign,
  updateDecision,
  findAssetById,
} from './managedAssetService.ts';
import { captureTranscript } from './transcript/transcriptSource.ts';
import { currentSessionId, readSession, updateSession, SessionError } from './agentSessionService.ts';

/**
 * Knowledge Capture Closure.
 *
 * Turns an open AgentSession into persisted knowledge assets, reusing the
 * existing Managed Asset Service (Conversation / Design / Decision + promotion
 * chain). The closure never invents content: it writes the agent's real work
 * record and only promotes to Design / Decision when the semantic bar is met.
 */

export interface ClosureDesignInput {
  action: 'create' | 'update' | 'none';
  /** required for action 'update' */
  id?: string;
  path?: string;
  title?: string;
  content?: string;
  designArea?: string;
}
export interface ClosureDecisionInput {
  action: 'create' | 'none';
  title?: string;
  content?: string;
  status?: DecisionStatus;
}
export interface ClosureInput {
  taskTitle?: string;
  summary?: string;
  investigation?: string;
  findings?: string;
  changes?: string[];
  verification?: string[];
  outcome?: string;
  /** defaults to true for substantive tasks; set false (with skipReason) for trivial changes */
  captureConversation?: boolean;
  skipReason?: string;
  affectedAssetPaths?: string[];
  design?: ClosureDesignInput;
  decision?: ClosureDecisionInput;
  /**
   * Optional explicit transcript content to treat as a captured/imported
   * transcript. Used by tests (and by an explicit import-during-closure). When
   * absent, the platform adapter is consulted and will honestly report
   * `unavailable` when no programmatic transcript exists. Never fabricate.
   */
  transcript?: {
    content: string;
    sourceSessionId?: string;
    completeness?: 'full' | 'partial';
    sourceType?: string;
  };
}

export interface ClosureResult {
  session: AgentSession;
  conversation?: ManagedAssetResult;
  transcript?: ManagedAssetResult;
  design?: ManagedAssetResult;
  decision?: ManagedAssetResult;
  skipped: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean).map((v) => v.trim()).filter(Boolean)));
}

/** Build the Conversation (Agent Work Record) body from the real closure input. */
function renderAgentWorkRecord(input: ClosureInput): string {
  const blocks: string[] = [];
  const section = (name: string, body?: string) => {
    if (body && body.trim()) blocks.push(`## ${name}\n\n${body.trim()}\n`);
  };
  section('Task', input.taskTitle);
  section('Context', input.summary);
  section('Investigation', input.investigation);
  section('Findings', input.findings);
  if (input.changes && input.changes.filter(Boolean).length > 0) {
    blocks.push(`## Changes\n\n${input.changes.filter(Boolean).map((c) => `- ${c}`).join('\n')}\n`);
  }
  if (input.verification && input.verification.filter(Boolean).length > 0) {
    blocks.push(`## Verification\n\n${input.verification.filter(Boolean).map((c) => `- ${c}`).join('\n')}\n`);
  }
  section('Outcome', input.outcome);
  blocks.push(
    '## Follow-up\n\n(Captured by Agent Knowledge Capture Protocol; outstanding follow-up is tracked in the AgentSession.)',
  );
  return blocks.join('\n');
}

export async function runClosure(sessionId: string, input: ClosureInput): Promise<ClosureResult> {
  const session = readSession(sessionId);
  if (!session) throw new SessionError(`session not found: ${sessionId}`);
  if (session.closureStatus === 'closed') throw new SessionError(`session already closed: ${sessionId}`);

  let working = session;
  if (input.taskTitle || input.summary) {
    working = updateSession(sessionId, {
      taskTitle: input.taskTitle ?? session.taskTitle,
      taskSummary: input.summary ?? session.taskSummary,
    });
  }
  const affected = uniqueStrings(input.affectedAssetPaths ?? []);

  // Trivial change: skip capture but require an explicit reason.
  const captureConversation = input.captureConversation !== false;
  if (!captureConversation) {
    const closed = updateSession(sessionId, {
      closureStatus: 'closed',
      completedAt: nowIso(),
      captureStatus: 'skipped',
      skipReason: input.skipReason ?? 'trivial-change',
      affectedAssetPaths: affected,
      closureInput: input as Record<string, unknown>,
    });
    return { session: closed, skipped: true };
  }

  // --- 1. Attempt to capture the original Transcript (if the platform allows it) ---
  // Honest: when no programmatic transcript exists, this returns `unavailable`
  // and no transcript asset is written. A Work Record is still produced below.
  const capture = await captureTranscript({
    agentType: working.agentType,
    agentSessionId: working.id,
    override: input.transcript
      ? {
          content: input.transcript.content,
          sourceSessionId: input.transcript.sourceSessionId,
          completeness: input.transcript.completeness,
          sourceType: input.transcript.sourceType,
        }
      : undefined,
  });

  let transcript: ManagedAssetResult | undefined;
  let transcriptCaptureStatus: AgentSession['transcriptCaptureStatus'] = 'unavailable';
  if (capture.status !== 'unavailable' && capture.content) {
    const isImported = capture.sourceType === 'imported';
    const transcriptSource: ConversationSource = isImported
      ? ((input.transcript?.source as ConversationSource) ?? 'other')
      : (working.agentType as ConversationSource);
    transcript = await createTranscript({
      title: working.taskTitle,
      source: transcriptSource,
      content: capture.content,
      captureMode: isImported ? 'imported-transcript' : 'full-transcript',
      completeness: capture.completeness,
      sourceSessionId: capture.sourceSessionId,
      agentSessionId: working.id,
      sourceMetadata: { provider: working.agentType, transcriptSource: capture.sourceType },
    });
    transcriptCaptureStatus = capture.status === 'partial' ? 'partial' : isImported ? 'imported' : 'available';
  }

  // --- 2. Always produce the Agent Work Record (structured evidence) ---
  const conv = await createConversation({
    title: working.taskTitle,
    source: working.agentType,
    content: renderAgentWorkRecord(input),
    relatedAssetPaths: affected,
    captureMode: working.captureMode,
    agentSessionId: working.id,
    sourceTranscriptId: transcript?.id,
  });

  // --- 3. Wire the bidirectional Transcript <-> Work Record link (if both exist) ---
  if (transcript) {
    await patchAssetMetadataById(transcript.id, { workRecordId: conv.id });
  }

  // Design: only when a formal, reusable design outcome exists.
  let design: ManagedAssetResult | undefined;
  let createdDesignId: string | undefined;
  const designAction = input.design?.action ?? 'none';
  if (designAction === 'create') {
    design = await promoteConversationToDesign(conv.id, {
      title: input.design!.title ?? working.taskTitle,
      designArea: input.design!.designArea ?? 'architecture',
      content: input.design!.content ?? '',
      relatedAssetPaths: affected,
    });
    createdDesignId = design.id;
  } else if (designAction === 'update') {
    design = await updateDesign({
      id: input.design!.id,
      path: input.design!.path,
      title: input.design!.title,
      content: input.design!.content ?? '',
      relatedAssetPaths: affected,
    });
  }

  // Decision: only with adopted/accepted evidence, never for a mere suggestion.
  let decision: ManagedAssetResult | undefined;
  const decisionAction = input.decision?.action ?? 'none';
  if (decisionAction === 'create') {
    if (design) {
      decision = await promoteDesignToDecision(design.id, {
        title: input.decision!.title ?? working.taskTitle,
        status: input.decision!.status ?? 'Accepted',
        content: input.decision!.content ?? '',
        relatedAssetPaths: affected,
      });
    } else {
      decision = await createDecision({
        title: input.decision!.title ?? working.taskTitle,
        status: input.decision!.status ?? 'Accepted',
        content: input.decision!.content ?? '',
        sourceConversations: [conv.id],
        relatedAssetPaths: affected,
      });
    }
  }

  const closed = updateSession(sessionId, {
    closureStatus: 'closed',
    completedAt: nowIso(),
    captureStatus: 'captured',
    conversationAssetId: conv.id,
    workRecordAssetId: conv.id,
    transcriptAssetId: transcript?.id,
    transcriptCaptureStatus,
    resultingDesignIds: createdDesignId ? [createdDesignId] : [],
    resultingDecisionIds: decision ? [decision.id] : [],
    affectedAssetPaths: affected,
    closureInput: input as Record<string, unknown>,
  });

  return { session: closed, conversation: conv, transcript, design, decision, skipped: false };
}

// ---------------------------------------------------------------------------
// Relation consistency
// ---------------------------------------------------------------------------

export interface RelationIssue {
  assetId: string;
  path: string;
  message: string;
}

/**
 * Verify bidirectional relation consistency for a set of asset ids.
 * Returns one issue per broken link. Used by verify:knowledge.
 */
export function checkRelationConsistency(ids: string[]): RelationIssue[] {
  const issues: RelationIssue[] = [];
  const map = new Map<string, { meta: ManagedAssetMetadata; contentRel: string }>();
  for (const id of ids) {
    const found = findAssetById(id);
    if (!found) {
      issues.push({ assetId: id, path: '', message: 'asset referenced by session not found on disk' });
      continue;
    }
    map.set(id, { meta: found.metadata, contentRel: found.contentRel });
  }
  for (const [id, { meta, contentRel }] of map) {
    if (meta.type === 'conversation' || meta.type === 'agent-work-record') {
      for (const p of meta.promotedTo ?? []) {
        const d = map.get(p.id);
        if (!d) {
          issues.push({ assetId: id, path: contentRel, message: `promotedTo ${p.type} ${p.id} missing` });
          continue;
        }
        if (p.type === 'design' && !(d.meta.sourceConversations ?? []).includes(id)) {
          issues.push({ assetId: id, path: contentRel, message: `design ${p.id} missing sourceConversation back-link` });
        }
      }
    }
    if (meta.type === 'design') {
      for (const did of meta.promotedToDecisions ?? []) {
        const dec = map.get(did);
        if (!dec) {
          issues.push({ assetId: id, path: contentRel, message: `promotedToDecision ${did} missing` });
          continue;
        }
        if (!(dec.meta.sourceDesigns ?? []).includes(id)) {
          issues.push({ assetId: id, path: contentRel, message: `decision ${did} missing sourceDesign back-link` });
        }
      }
      for (const cid of meta.sourceConversations ?? []) {
        const c = map.get(cid);
        if (!c) {
          issues.push({ assetId: id, path: contentRel, message: `sourceConversation ${cid} missing` });
          continue;
        }
        if (!(c.meta.promotedTo ?? []).some((p) => p.type === 'design' && p.id === id)) {
          issues.push({ assetId: id, path: contentRel, message: `sourceConversation ${cid} missing promotedTo back-link` });
        }
      }
    }
    if (meta.type === 'decision') {
      for (const cid of meta.sourceConversations ?? []) {
        if (!map.get(cid)) issues.push({ assetId: id, path: contentRel, message: `sourceConversation ${cid} missing` });
      }
      for (const did of meta.sourceDesigns ?? []) {
        if (!map.get(did)) issues.push({ assetId: id, path: contentRel, message: `sourceDesign ${did} missing` });
      }
    }
  }
  return issues;
}

/** Recursively find any leftover `.awtmp-*` write temp files under managed areas. */
function scanTempResidue(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.startsWith('.awtmp-')) found.push(full);
    }
  };
  for (const top of ['04-conversations', '02-design', '03-docs', '05-derived']) {
    const d = path.join(root, top);
    if (fs.existsSync(d)) walk(d);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Knowledge Capture Gate
// ---------------------------------------------------------------------------

export interface VerifyResult {
  ok: boolean;
  issues: string[];
}

/**
 * The final兜底 gate. A task is only fully closed when this returns ok=true.
 */
export function verifyKnowledgeCapture(sessionId?: string): VerifyResult {
  const issues: string[] = [];
  const id = sessionId ?? currentSessionId();
  if (!id) {
    return { ok: false, issues: ['no active AgentSession (run agent:preflight first)'] };
  }
  const session = readSession(id);
  if (!session) return { ok: false, issues: [`AgentSession not found: ${id}`] };

  if (session.closureStatus !== 'closed') {
    issues.push(`closureStatus is '${session.closureStatus}', expected 'closed' (run agent:close first)`);
  }

  if (session.captureStatus === 'skipped') {
    if (!session.skipReason) issues.push('capture skipped but skipReason missing');
  }

  if (session.captureStatus === 'captured') {
    const workRecordId = session.workRecordAssetId ?? session.conversationAssetId;
    const transcriptId = session.transcriptAssetId;
    const tcs: AgentSession['transcriptCaptureStatus'] = session.transcriptCaptureStatus ?? 'unavailable';

    // Work Record is always required when captured (it is the structural record).
    if (!workRecordId) {
      issues.push('captured session has no workRecordAssetId');
    } else {
      const found = findAssetById(workRecordId);
      if (!found) {
        issues.push(`work record ${workRecordId} not found on disk (Scanner would not see it)`);
      } else {
        if (found.metadata.schemaVersion !== 1) {
          issues.push(`work record ${workRecordId} metadata missing schemaVersion=1`);
        }
        // Truthfulness guard (scenario D): an Agent Work Record must never be
        // mislabeled as a full original transcript.
        if (found.metadata.type === 'agent-work-record' && found.metadata.captureMode === 'full-transcript') {
          issues.push(
            `work record ${workRecordId} is mislabeled as full-transcript (a Work Record is not an original transcript)`,
          );
        }
      }
    }

    // Transcript checks: required only when a transcript was reported available.
    if (tcs !== 'unavailable') {
      if (!transcriptId) {
        issues.push(`transcriptCaptureStatus is '${tcs}' but no transcriptAssetId present`);
      } else {
        const found = findAssetById(transcriptId);
        if (!found) {
          issues.push(`transcript ${transcriptId} not found on disk (Scanner would not see it)`);
        } else if (found.metadata.schemaVersion !== 1) {
          issues.push(`transcript ${transcriptId} metadata missing schemaVersion=1`);
        }
      }
    }

    // Relation consistency across conversation/design/decision chain.
    const assetIds: string[] = [];
    if (workRecordId) assetIds.push(workRecordId);
    if (transcriptId) assetIds.push(transcriptId);
    assetIds.push(...session.resultingDesignIds, ...session.resultingDecisionIds);

    const relIssues = checkRelationConsistency(assetIds);
    for (const ri of relIssues) issues.push(`relation: ${ri.message} (${ri.assetId})`);

    // Decisions created in an agent closure must keep source traceability.
    if (session.resultingDecisionIds.length > 0 && (session.conversationAssetId || session.resultingDesignIds.length > 0)) {
      for (const did of session.resultingDecisionIds) {
        const found = findAssetById(did);
        if (found && (found.metadata.sourceConversations ?? []).length === 0 && (found.metadata.sourceDesigns ?? []).length === 0) {
          issues.push(`decision ${did} missing source traceability`);
        }
      }
    }

    const residue = scanTempResidue(getProjectRoot());
    if (residue.length > 0) issues.push(`temp write residue found: ${residue.map((r) => path.relative(getProjectRoot(), r)).join(', ')}`);
  }

  return { ok: issues.length === 0, issues };
}
