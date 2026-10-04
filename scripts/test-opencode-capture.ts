/**
 * OpenCode capture adapter test.
 *
 * Uses the REAL OpenCode event shapes observed on this machine (opencode 1.18.34):
 *   plugin inbox:  { id, type: 'message.updated',
 *                    properties: { info: { id, role, sessionID, time } } }
 *                  { id, type: 'message.part.updated',
 *                    properties: { sessionID, part: { id, messageID, type: 'text', text } } }
 *                  { type: 'tool.execute.after', properties: { ... } }
 *   official export: { info: { id, model, agent, version }, messages: [ { info, parts } ] }
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { importOpencodeInbox, importOpencodeSession } from '../server/providerAdapterService.ts';
import { getCaptureSession, getCaptureStorePaths } from '../server/captureService.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-opencode-test-'));
fs.mkdirSync(path.join(workspace, '04-conversations', 'transcripts'), { recursive: true });
setProjectRoot(workspace);

const SID = 'ses_testopencode0001';

function eventsOf(id: string) {
  const file = getCaptureStorePaths(id).events;
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}
const line = (obj: unknown) => `${JSON.stringify(obj)}\n`;

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}`); console.error('        ', (error as Error).message); }
}

// A realistic plugin inbox: roles arrive via message.updated, text via
// message.part.updated (including repeated streaming updates for one part).
const inbox = path.join(workspace, 'inbox.jsonl');
fs.writeFileSync(inbox, [
  line({ id: 'e1', type: 'session.created', properties: { info: { id: SID } } }),
  line({ id: 'e2', type: 'message.updated', properties: { sessionID: SID, info: { id: 'm1', role: 'user', sessionID: SID, time: { created: 1_700_000_000_000 } } } }),
  line({ id: 'e3', type: 'message.part.updated', properties: { sessionID: SID, part: { id: 'p1', messageID: 'm1', type: 'text', text: 'what is 2+2' } } }),
  line({ id: 'e4', type: 'message.updated', properties: { sessionID: SID, info: { id: 'm2', role: 'assistant', sessionID: SID, time: { created: 1_700_000_001_000 } } } }),
  // streaming: same part id updated three times -> must collapse to ONE message
  line({ id: 'e5', type: 'message.part.updated', properties: { sessionID: SID, part: { id: 'p2', messageID: 'm2', type: 'text', text: 'The ' } } }),
  line({ id: 'e6', type: 'message.part.delta', properties: { sessionID: SID, partID: 'p2', field: 'text', delta: ' answer' } }),
  line({ id: 'e7', type: 'message.part.updated', properties: { sessionID: SID, part: { id: 'p2', messageID: 'm2', type: 'text', text: 'The answer' } } }),
  line({ id: 'e8', type: 'message.part.updated', properties: { sessionID: SID, part: { id: 'p2', messageID: 'm2', type: 'text', text: 'The answer is 4.' } } }),
  line({ id: 'e9', type: 'session.idle', properties: { sessionID: SID } }),
].join(''), 'utf8');

await check('plugin inbox: user/assistant roles are attributed correctly', () => {
  const r = importOpencodeInbox(inbox);
  const events = eventsOf(r.captureSessionId);
  const users = events.filter((e) => e.eventType === 'user.message');
  const assistants = events.filter((e) => e.eventType === 'assistant.message');
  assert.equal(users.length, 1, 'one user message');
  assert.equal(users[0].content, 'what is 2+2');
  assert.equal(assistants.length, 1, 'streaming updates must collapse to ONE assistant message');
  assert.equal(assistants[0].content, 'The answer is 4.', 'final part text wins');
});

await check('plugin inbox: repeated import is idempotent', () => {
  const again = importOpencodeInbox(inbox);
  assert.equal(again.imported, 0, 'no duplicate events on re-drain');
});

const exportPath = path.join(workspace, 'export.json');
fs.writeFileSync(exportPath, JSON.stringify({
  info: { id: SID, agent: 'build', version: '1.18.34', model: { providerID: 'opencode', id: 'big-pickle' } },
  messages: [
    { info: { id: 'm1', role: 'user', time: { created: 1_700_000_000_000 } }, parts: [{ id: 'p1', messageID: 'm1', type: 'text', text: 'what is 2+2' }] },
    { info: { id: 'm2', role: 'assistant', time: { created: 1_700_000_001_000 } }, parts: [{ id: 'p2', messageID: 'm2', type: 'text', text: 'The answer is 4.' }] },
    { info: { id: 'm3', role: 'user', time: { created: 1_700_000_002_000 } }, parts: [{ id: 'p3', messageID: 'm3', type: 'text', text: 'now run a command' }] },
    { info: { id: 'm4', role: 'assistant', time: { created: 1_700_000_003_000 } }, parts: [
      { id: 'p4', messageID: 'm4', type: 'step-start' },
      { id: 'p5', messageID: 'm4', type: 'tool', tool: 'bash', callID: 'call_1', state: { status: 'completed', input: { command: 'echo hi' }, output: 'hi\n', time: { start: 1, end: 2 } } },
      { id: 'p6', messageID: 'm4', type: 'step-finish' },
    ] },
    { info: { id: 'm5', role: 'assistant', time: { created: 1_700_000_004_000 } }, parts: [{ id: 'p7', messageID: 'm5', type: 'text', text: 'DONE' }] },
  ],
}), 'utf8');

await check('official export: full multi-turn session with tool event', () => {
  const r = importOpencodeSession(exportPath);
  const events = eventsOf(r.captureSessionId).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const types = events.map((e) => e.eventType);
  assert.equal(events.filter((e) => e.eventType === 'user.message').length, 2, 'two user turns');
  assert.equal(events.filter((e) => e.eventType === 'assistant.message').length, 2, 'two assistant answers');
  assert.equal(events.filter((e) => e.eventType === 'tool.completed').length, 1, 'one tool event');
  const seqs = events.map((e) => e.sequence ?? 0);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'sequence monotonic');
  assert.ok(types.includes('tool.completed'));
  const tool = events.find((e) => e.eventType === 'tool.completed')!;
  assert.equal(tool.toolCall?.name, 'bash');
  assert.equal(tool.toolResult?.output, 'hi\n');
});

await check('official export re-import is idempotent', () => {
  assert.equal(importOpencodeSession(exportPath).imported, 0);
});

await check('session identity is the real provider session id', () => {
  const r = importOpencodeSession(exportPath);
  const state = getCaptureSession(r.captureSessionId);
  assert.equal(state.provider, 'opencode');
  assert.equal(state.providerSessionId, SID);
});

setProjectRoot(original);
fs.rmSync(workspace, { recursive: true, force: true });
if (failures > 0) { console.error(`OPENCODE_CAPTURE_TEST FAIL (${failures})`); process.exit(1); }
console.log('OPENCODE_CAPTURE_TEST PASS');
