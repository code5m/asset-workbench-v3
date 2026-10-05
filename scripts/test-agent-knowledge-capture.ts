/**
 * Integration tests for the Agent Knowledge Capture Protocol.
 *
 * Run with: npm run test:agent
 *
 * Uses an isolated temporary workspace (projectRoot pointed at a temp dir) so
 * the real project tree is never mutated, including the runtime
 * `.asset-workbench-data` which lives under the temp root.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import {
  createSession,
  readSession,
  currentSessionId,
  listSessions,
  updateSession,
} from '../server/agentSessionService.ts';
import {
  runClosure,
  verifyKnowledgeCapture,
  checkRelationConsistency,
} from '../server/knowledgeCaptureService.ts';
import {
  findAssetById,
  createConversation,
  createTranscript,
} from '../server/managedAssetService.ts';
import { resolveManagedType } from '../server/assetClassifier.ts';

function tmpRoot(): string {
  return path.join(os.tmpdir(), `aw3-agent-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}

function makeWorkspace(): string {
  const root = tmpRoot();
  fs.mkdirSync(root, { recursive: true });
  for (const d of [
    '04-conversations/chatgpt',
    '04-conversations/codex',
    '02-design/architecture',
    '02-design/product',
    '02-design/decisions',
    '03-docs',
    '05-derived',
  ]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Agent Rules\n');
  return root;
}

let savedRoot = '';
let workspace = '';

test.before(() => {
  savedRoot = getProjectRoot();
  workspace = makeWorkspace();
  setProjectRoot(workspace);
});

test.after(() => {
  setProjectRoot(savedRoot);
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// 1. preflight creates a session -------------------------------------------
test('preflight creates an active AgentSession on disk', () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'T1' });
  assert.equal(session.closureStatus, 'active');
  assert.equal(session.schemaVersion, 1);
  const file = path.join(workspace, '.asset-workbench-data', 'agent-sessions', `${session.id}.json`);
  assert.ok(fs.existsSync(file), 'session file written');
  assert.equal(currentSessionId(), session.id, 'current pointer set');
  assert.equal(readSession(session.id)!.id, session.id);
});

// 2 + 3. duplicate / interrupted session -----------------------------------
test('duplicate preflight detects the un-closed previous session and marks it interrupted', () => {
  const a = createSession({ agentType: 'codex', taskTitle: 'A' }).session;
  const b = createSession({ agentType: 'codex', taskTitle: 'B' });
  assert.ok(b.interruptedPrevious, 'previous session reported as interrupted');
  assert.equal(b.interruptedPrevious!.id, a.id);
  assert.equal(readSession(a.id)!.closureStatus, 'interrupted', 'stale session not silently overwritten');
  assert.equal(currentSessionId(), b.session.id);
});

// 4. close creates a conversation ------------------------------------------
test('close creates a real Conversation asset', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Conv Task' });
  const res = await runClosure(session.id, {
    taskTitle: 'Conv Task',
    summary: 'did a thing',
    investigation: 'looked at code',
    changes: ['edited x'],
    verification: ['ran build'],
    outcome: 'done',
  });
  assert.equal(res.skipped, false);
  assert.ok(res.conversation, 'conversation produced');
  const convDir = path.join(workspace, path.dirname(res.conversation!.path));
  assert.ok(fs.existsSync(path.join(convDir, 'conversation.md')));
  assert.ok(fs.existsSync(path.join(workspace, res.conversation!.metadataPath)));
  assert.equal(readSession(session.id)!.captureStatus, 'captured');
  assert.equal(readSession(session.id)!.conversationAssetId, res.conversation!.id);
});

// 5. close with design creates a Design (correct relation) -----------------
test('close with design creates Design and keeps relations', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Design Task' });
  const res = await runClosure(session.id, {
    taskTitle: 'Design Task',
    design: { action: 'create', title: 'My Design', designArea: 'architecture', content: 'formal design body' },
  });
  assert.ok(res.design, 'design produced');
  const convMeta = findAssetById(res.conversation!.id)!.metadata;
  const designMeta = findAssetById(res.design!.id)!.metadata;
  assert.ok(convMeta.promotedTo?.some((p) => p.type === 'design' && p.id === res.design!.id));
  assert.ok(designMeta.sourceConversations?.includes(res.conversation!.id));
  const issues = checkRelationConsistency([res.conversation!.id, res.design!.id]);
  assert.equal(issues.length, 0, JSON.stringify(issues));
});

// 6. close with decision creates Decision (full chain) --------------------
test('close with conversation+design+decision keeps the full chain consistent', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Decision Task' });
  const res = await runClosure(session.id, {
    taskTitle: 'Decision Task',
    design: { action: 'create', title: 'Chain Design', content: 'd' },
    decision: { action: 'create', title: 'Chain Decision', content: 'adopted ruling', status: 'Accepted' },
  });
  assert.ok(res.design && res.decision);
  const issues = checkRelationConsistency([res.conversation!.id, res.design!.id, res.decision!.id]);
  assert.equal(issues.length, 0, JSON.stringify(issues));
  const decisionMeta = findAssetById(res.decision!.id)!.metadata;
  assert.ok(decisionMeta.sourceDesigns?.includes(res.design!.id));
  assert.ok(decisionMeta.sourceConversations?.includes(res.conversation!.id));
});

// 7. no-decision flow is valid ---------------------------------------------
test('conversation-only flow passes the knowledge gate', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Conv Only' });
  await runClosure(session.id, { taskTitle: 'Conv Only', investigation: 'x' });
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
});

// 8. trivial skip is valid ------------------------------------------------
test('trivial change can be legitimately skipped', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Trivial' });
  const res = await runClosure(session.id, { taskTitle: 'Trivial', captureConversation: false, skipReason: 'trivial-change' });
  assert.equal(res.skipped, true);
  assert.equal(readSession(session.id)!.captureStatus, 'skipped');
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
});

// 9. missing required conversation fails verify ----------------------------
test('verify fails when a captured asset is missing on disk', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Will Delete' });
  const res = await runClosure(session.id, { taskTitle: 'Will Delete', investigation: 'x' });
  // Simulate a broken capture: remove the conversation files.
  const convDir = path.join(workspace, path.dirname(res.conversation!.path));
  fs.rmSync(convDir, { recursive: true, force: true });
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.includes('not found on disk')), JSON.stringify(v.issues));
});

// 10. relation mismatch fails verify ---------------------------------------
test('verify fails on a broken relation (scenario E)', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Break Rel' });
  const res = await runClosure(session.id, {
    taskTitle: 'Break Rel',
    design: { action: 'create', title: 'BR Design', content: 'd' },
  });
  // Corrupt the conversation sidecar: drop the promotedTo back-link.
  const metaPath = path.join(workspace, res.conversation!.metadataPath);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.promotedTo = [];
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.includes('relation')), JSON.stringify(v.issues));
});

// 11. metadata schemaVersion present ---------------------------------------
test('every created asset carries schemaVersion = 1', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Schema' });
  const res = await runClosure(session.id, {
    taskTitle: 'Schema',
    design: { action: 'create', title: 'S Design', content: 'd' },
    decision: { action: 'create', title: 'S Decision', content: 'r' },
  });
  for (const r of [res.conversation!, res.design!, res.decision!]) {
    const meta = findAssetById(r.id)!.metadata;
    assert.equal(meta.schemaVersion, 1, `${r.id} should have schemaVersion 1`);
  }
  assert.equal(
    findAssetById(res.conversation!.id)!.metadata.captureMode,
    'agent-work-record',
    'conversation captureMode recorded',
  );
});

// 12. restart preserves AgentSession ---------------------------------------
test('AgentSession and knowledge assets survive a restart (disk-backed)', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Restart' });
  const res = await runClosure(session.id, { taskTitle: 'Restart', investigation: 'x' });
  // Simulate a fresh process: read straight from disk, no in-memory state.
  const reread = readSession(session.id);
  assert.equal(reread!.closureStatus, 'closed');
  assert.equal(currentSessionId(), session.id);
  assert.ok(findAssetById(res.conversation!.id), 'conversation still discoverable after restart');
  assert.equal(listSessions().some((s) => s.id === session.id), true);
});

// 13. scanner sees created knowledge assets --------------------------------
test('created knowledge assets are discoverable under the managed tree', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Discoverable' });
  const res = await runClosure(session.id, {
    taskTitle: 'Discoverable',
    design: { action: 'create', title: 'Disc Design', content: 'd' },
  });
  const convAbs = path.join(workspace, res.conversation!.path);
  const designAbs = path.join(workspace, res.design!.path);
  assert.ok(fs.existsSync(convAbs), 'conversation.md on disk');
  assert.ok(fs.existsSync(designAbs), 'design.md on disk');
  assert.ok(findAssetById(res.conversation!.id), 'conversation discoverable by engine');
  assert.ok(findAssetById(res.design!.id), 'design discoverable by engine');
});

// 14. no temp residue -----------------------------------------------------
test('no .awtmp- temp residue remains after closure', async () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Clean' });
  await runClosure(session.id, {
    taskTitle: 'Clean',
    design: { action: 'create', title: 'C Design', content: 'd' },
    decision: { action: 'create', title: 'C Decision', content: 'r' },
  });
  const residue: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.startsWith('.awtmp-')) residue.push(full);
    }
  };
  for (const top of ['04-conversations', '02-design', '03-docs', '05-derived']) {
    const d = path.join(workspace, top);
    if (fs.existsSync(d)) walk(d);
  }
  assert.equal(residue.length, 0, `temp residue: ${residue.join(', ')}`);
});

// Gate must fail for an un-closed (active) session -------------------------
test('verify fails for an active, un-closed session', () => {
  const { session } = createSession({ agentType: 'codex', taskTitle: 'Open' });
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.includes("closureStatus is 'active'")), JSON.stringify(v.issues));
});

// === Dual-evidence model: Transcript != Agent Work Record =================

// Scenario A: a real, full transcript is available (via the test adapter).
test('Scenario A: full transcript + work record both created and linked', async () => {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: 'Has Transcript' });
  const res = await runClosure(session.id, {
    taskTitle: 'Has Transcript',
    summary: 'did a thing',
    investigation: 'looked at code',
    changes: ['edited x'],
    verification: ['ran build'],
    outcome: 'done',
    transcript: {
      content: 'User: do the thing\nAssistant: here is the full original chat\nUser: thanks',
      sourceSessionId: 'cb-sess-123',
      completeness: 'full',
      sourceType: 'test',
    },
  });
  assert.ok(res.transcript, 'transcript asset produced');
  assert.ok(res.conversation, 'work record produced');
  assert.equal(res.transcript!.type, 'conversation-transcript');
  assert.equal(res.conversation!.type, 'agent-work-record');
  const s = readSession(session.id)!;
  assert.equal(s.transcriptAssetId, res.transcript!.id);
  assert.equal(s.workRecordAssetId, res.conversation!.id);
  assert.equal(s.transcriptCaptureStatus, 'available');
  const tDir = path.join(workspace, path.dirname(res.transcript!.path));
  assert.ok(fs.existsSync(path.join(tDir, 'transcript.md')), 'transcript.md on disk');
  assert.ok(fs.existsSync(path.join(workspace, res.transcript!.metadataPath)));
  const tMeta = findAssetById(res.transcript!.id)!.metadata;
  assert.equal(tMeta.captureMode, 'full-transcript');
  assert.equal(tMeta.completeness, 'full');
  assert.equal(tMeta.sourceSessionId, 'cb-sess-123');
  assert.equal(tMeta.workRecordId, res.conversation!.id, 'bidirectional link present');
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
});

// Scenario B: no transcript obtainable -> work record still created, gate PASS.
test('Scenario B: unavailable transcript still closes with a work record', async () => {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: 'No Transcript' });
  const res = await runClosure(session.id, {
    taskTitle: 'No Transcript',
    investigation: 'x',
  });
  assert.ok(res.conversation, 'work record produced');
  assert.equal(res.transcript, undefined, 'no transcript asset');
  const s = readSession(session.id)!;
  assert.equal(s.transcriptCaptureStatus, 'unavailable');
  assert.equal(s.transcriptAssetId, undefined);
  assert.ok(s.workRecordAssetId, 'work record id set');
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
});

// Scenario C: a transcript is imported (human import path).
test('Scenario C: imported transcript is typed imported-transcript and linkable', async () => {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: 'Import' });
  const imported = await createTranscript({
    title: 'Imported ChatGPT export',
    source: 'chatgpt',
    content: 'User: hello\nAssistant: hi there, this is imported verbatim',
    captureMode: 'imported-transcript',
    completeness: 'full',
    sourceSessionId: 'cg-export-9',
    agentSessionId: session.id,
    sourceMetadata: { provider: 'chatgpt', transcriptSource: 'imported' },
  });
  assert.equal(imported.type, 'conversation-transcript');
  const meta = findAssetById(imported.id)!.metadata;
  assert.equal(meta.captureMode, 'imported-transcript');
  assert.equal(meta.type, 'conversation-transcript');
  assert.equal(meta.agentSessionId, session.id);
  // Provider identity owns the directory; import vs realtime is metadata.
  assert.ok(imported.path.includes('04-conversations/transcripts/chatgpt/'), imported.path);
});

// Scenario D: a Work Record must never be mislabeled as a full transcript.
test('Scenario D: verify fails when a Work Record is mislabeled full-transcript', async () => {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: 'Fake' });
  const conv = await createConversation({
    title: 'Fake Work Record',
    source: 'codebuddy',
    content: 'Task / Context / ...',
    captureMode: 'agent-work-record' as never,
  });
  // Simulate a lying author: rewrite the sidecar to claim full-transcript.
  const metaPath = path.join(workspace, conv.metadataPath);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.captureMode = 'full-transcript';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  // Wire the session so the gate inspects this asset (persisted to disk).
  updateSession(session.id, {
    captureStatus: 'captured',
    workRecordAssetId: conv.id,
    closureStatus: 'closed',
    completedAt: new Date().toISOString(),
  });
  const v = verifyKnowledgeCapture(session.id);
  assert.equal(v.ok, false, 'gate must reject fabricated full-transcript');
  assert.ok(
    v.issues.some((i) => i.includes('mislabeled as full-transcript')),
    JSON.stringify(v.issues),
  );
});

// Scenario E: legacy agent-work-record data is still classified correctly.
test('Scenario E: legacy conversation + agent-work-record classified as agent-work-record', () => {
  const dir = path.join(workspace, '04-conversations', 'codebuddy', '2026-09-29-legacy');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'conversation.md'), 'Task\nContext\n');
  const meta = {
    schemaVersion: 1,
    id: 'conv_legacy',
    type: 'conversation',
    captureMode: 'agent-work-record',
    title: 'Legacy',
    source: 'codebuddy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    relatedAssetPaths: [],
    promotedTo: [],
  };
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2));
  const resolved = resolveManagedType(workspace, '04-conversations/codebuddy/2026-09-29-legacy/conversation.md');
  assert.equal(resolved, 'agent-work-record', 'legacy data must resolve to agent-work-record, not transcript');
});
