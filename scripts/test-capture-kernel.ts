import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { createSession } from '../server/agentSessionService.ts';
import { createConversation, createTranscript } from '../server/managedAssetService.ts';
import {
  appendCaptureEvents,
  createCaptureSession,
  endCaptureSession,
  getCaptureSession,
  getCaptureStorePaths,
} from '../server/captureService.ts';

const originalRoot = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-capture-test-'));
for (const dir of ['04-conversations/transcripts', '04-conversations/codex', '02-design/decisions']) {
  fs.mkdirSync(path.join(workspace, dir), { recursive: true });
}
setProjectRoot(workspace);

try {
  const agent = createSession({ agentType: 'codex', taskTitle: 'capture kernel test' }).session;
  const first = createCaptureSession({ provider: 'opencode', providerSessionId: 'provider-one', captureSource: 'test', agentSessionId: agent.id });
  const second = createCaptureSession({ provider: 'other', providerSessionId: 'provider-two', captureSource: 'test' });
  assert.notEqual(first.captureSessionId, second.captureSessionId, 'sessions are isolated');

  let write = appendCaptureEvents(first.captureSessionId, [
    { eventId: 'evt-1', eventType: 'user.message', sequence: 1, timestamp: '2026-09-30T00:00:01.000Z', actor: 'user', content: 'hello' },
    { eventId: 'evt-2', eventType: 'assistant.message', sequence: 2, timestamp: '2026-09-30T00:00:02.000Z', actor: 'assistant', content: 'hello back' },
  ]);
  assert.deepEqual(write.accepted, ['evt-1', 'evt-2']);
  write = appendCaptureEvents(first.captureSessionId, [
    { eventId: 'evt-2', eventType: 'assistant.message', sequence: 2, timestamp: '2026-09-30T00:00:02.000Z', content: 'duplicate' },
    { eventId: 'evt-4', eventType: 'user.message', sequence: 4, timestamp: '2026-09-30T00:00:04.000Z', content: 'check project' },
  ]);
  assert.deepEqual(write.duplicates, ['evt-2']);
  assert.ok(write.warnings.some((warning) => warning.includes('sequence gap')), 'gap is visible');
  appendCaptureEvents(second.captureSessionId, [
    { eventId: 'other-1', eventType: 'user.message', sequence: 1, timestamp: '2026-09-30T00:00:01.000Z', content: 'separate' },
  ]);

  const store = getCaptureStorePaths(first.captureSessionId);
  assert.ok(fs.existsSync(store.state) && fs.existsSync(store.events) && fs.existsSync(store.rawEvents), 'event store files exist');
  assert.match(fs.readFileSync(store.rawEvents, 'utf8'), /evt-1/, 'raw payload preserved');
  assert.match(fs.readFileSync(store.events, 'utf8'), /"captureSessionId"/, 'canonical event preserved');
  assert.equal(getCaptureSession(first.captureSessionId).sequenceGaps.length, 1, 'restart-safe state can be read');

  const ended = await endCaptureSession(first.captureSessionId);
  assert.equal(ended.completeness, 'partial');
  assert.ok(fs.existsSync(path.join(workspace, ended.transcript.path)), 'materialized transcript exists');
  assert.match(fs.readFileSync(path.join(workspace, ended.transcript.path), 'utf8'), /hello back/);
  assert.equal(getCaptureSession(second.captureSessionId).status, 'active', 'other session was not touched');
  const linked = JSON.parse(fs.readFileSync(path.join(workspace, '.asset-workbench-data/agent-sessions', `${agent.id}.json`), 'utf8'));
  assert.equal(linked.transcriptAssetId, ended.transcript.id, 'AgentSession links transcript');
  assert.equal(linked.transcriptCaptureStatus, 'partial');

  const imported = await createTranscript({ title: 'legacy import', source: 'other', content: 'legacy raw', captureMode: 'imported-transcript' });
  assert.ok(fs.existsSync(path.join(workspace, imported.path)), 'old imported transcript remains supported');
  const work = await createConversation({ title: 'work record', source: 'codex', content: 'structured work record' });
  assert.ok(fs.existsSync(path.join(workspace, work.path)), 'work records remain independent');
  assert.throws(() => getCaptureSession('../../escape'), /invalid captureSessionId/, 'path traversal is blocked');
  console.log('CAPTURE_KERNEL_TEST PASS');
} finally {
  setProjectRoot(originalRoot);
  fs.rmSync(workspace, { recursive: true, force: true });
}
