import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { createSession, readSession } from '../server/agentSessionService.ts';
import { ingestProviderEvent, endProviderSession } from '../server/providerAdapterService.ts';
import { runClosure, verifyKnowledgeCapture } from '../server/knowledgeCaptureService.ts';
import { findAssetById } from '../server/managedAssetService.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-transcript-linkage-'));
fs.mkdirSync(path.join(workspace, '04-conversations', 'transcripts'), { recursive: true });
fs.mkdirSync(path.join(workspace, '04-conversations', 'codebuddy'), { recursive: true });
fs.mkdirSync(path.join(workspace, '02-design', 'architecture'), { recursive: true });
setProjectRoot(workspace);

async function providerFirst() {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: '中文会话先结束' });
  const sid = 'codebuddy-link-provider-first';
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'SessionStart', cwd: workspace });
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'UserPromptSubmit', turnId: '1', prompt: '你好，这是一条中文问题。' });
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'Stop', turnId: '1', lastAssistantMessage: '你好，这是完整保留的中文回答。' });
  await endProviderSession('codebuddy', sid);

  const afterCapture = readSession(session.id)!;
  assert.equal(afterCapture.transcriptCaptureStatus, 'available');
  assert.ok(afterCapture.transcriptAssetId);

  const closed = await runClosure(session.id, { taskTitle: '中文会话先结束', summary: '这是中文工作摘要。' });
  assert.ok(closed.transcript);
  const work = findAssetById(closed.conversation!.id)!;
  const transcript = findAssetById(closed.transcript!.id)!;
  assert.equal(work.metadata.sourceTranscriptId, transcript.metadata.id);
  assert.equal(work.metadata.transcriptCaptureStatus, 'available');
  assert.equal(transcript.metadata.workRecordId, work.metadata.id);
  const transcriptText = fs.readFileSync(path.join(workspace, transcript.contentRel), 'utf8');
  assert.match(transcriptText, /你好，这是一条中文问题/);
  assert.match(transcriptText, /你好，这是完整保留的中文回答/);
  const verify = verifyKnowledgeCapture(session.id);
  assert.equal(verify.ok, true, verify.issues.join('; '));
  assert.equal(verify.warnings.length, 0);
}

async function agentFirst() {
  const { session } = createSession({ agentType: 'codebuddy', taskTitle: '中文会话后结束' });
  const sid = 'codebuddy-link-agent-first';
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'SessionStart', cwd: workspace });
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'UserPromptSubmit', turnId: '1', prompt: '第二条中文问题。' });
  ingestProviderEvent({ provider: 'codebuddy', providerSessionId: sid, hookEventName: 'Stop', turnId: '1', lastAssistantMessage: '第二条中文回答。' });

  const closed = await runClosure(session.id, { taskTitle: '中文会话后结束', summary: '先关闭 Agent，再等 Provider SessionEnd。' });
  assert.equal(closed.session.transcriptCaptureStatus, 'unavailable');
  const before = findAssetById(closed.conversation!.id)!;
  assert.equal(before.metadata.transcriptCaptureStatus, 'unavailable');

  await endProviderSession('codebuddy', sid);
  const after = readSession(session.id)!;
  assert.equal(after.transcriptCaptureStatus, 'available');
  assert.ok(after.transcriptAssetId);
  const work = findAssetById(closed.conversation!.id)!;
  const transcript = findAssetById(after.transcriptAssetId!)!;
  assert.equal(work.metadata.sourceTranscriptId, transcript.metadata.id);
  assert.equal(work.metadata.transcriptCaptureStatus, 'available');
  assert.equal(transcript.metadata.workRecordId, work.metadata.id);
  const verify = verifyKnowledgeCapture(session.id);
  assert.equal(verify.ok, true, verify.issues.join('; '));
  assert.equal(verify.warnings.length, 0);
}

try {
  await providerFirst();
  await agentFirst();
  console.log('TRANSCRIPT_LINKAGE_TEST PASS');
} finally {
  setProjectRoot(original);
  fs.rmSync(workspace, { recursive: true, force: true });
}
