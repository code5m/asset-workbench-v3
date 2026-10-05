/**
 * CodeBuddy capture adapter test.
 *
 * Uses the REAL CodeBuddy hook payload schema (verified against
 * @tencent-ai/codebuddy-code 2.127.0 in this machine):
 *   { session_id, transcript_path, cwd, hook_event_name, tool_name, tool_input,
 *     tool_response, generation_id, model, agent_type, client, version }
 * and for Stop: { ..., hook_event_name: 'Stop', stop_hook_active, last_assistant_message }
 *
 * Covers: session identity, multi-turn messages, several tools inside one
 * generation, hook retry idempotency, subagent isolation, and the official
 * transcript importer (dedupe + idempotency).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { endProviderSession, importCodebuddyHistory, ingestProviderEvent } from '../server/providerAdapterService.ts';
import { getCaptureSession, getCaptureStorePaths } from '../server/captureService.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-codebuddy-test-'));
fs.mkdirSync(path.join(workspace, '04-conversations', 'transcripts'), { recursive: true });
setProjectRoot(workspace);

const SID = 'codebuddy-e2e-session-1';
const base = { provider: 'codebuddy' as const, providerSessionId: SID, client: 'VSCode', agentType: 'craft', model: 'hy4-preview', providerVersion: '4.12.38765564', transcriptPath: '/tmp/fake/index.json' };

function eventsOf(captureSessionId: string): Array<{ eventType: string; content?: string; toolCall?: { name?: string } }> {
  const file = getCaptureStorePaths(captureSessionId).events;
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

let failures = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try { await fn(); console.log(`  PASS  ${name}`); }
    catch (error) {
      failures += 1;
      console.error(`  FAIL  ${name}`);
      console.error('        ', (error as Error).message);
    }
  })();
}

await check('SessionStart creates one CaptureSession for the providerSessionId', () => {
  const a = ingestProviderEvent({ ...base, hookEventName: 'SessionStart', cwd: workspace });
  const b = ingestProviderEvent({ ...base, hookEventName: 'SessionStart', cwd: workspace });
  assert.equal(a.captureSessionId, b.captureSessionId, 'concurrent/repeat start must reuse one session');
  assert.deepEqual(a.accepted.length, 1);
  assert.deepEqual(b.duplicates.length, 1, 'repeat SessionStart is deduped');
});

await check('user prompt + assistant reply + tools land in one session', () => {
  const u = ingestProviderEvent({ ...base, hookEventName: 'UserPromptSubmit', turnId: 'gen-1', prompt: 'first real question' });
  const t1 = ingestProviderEvent({ ...base, hookEventName: 'PostToolUse', turnId: 'gen-1', toolName: 'Read', toolInput: { filePath: 'a.ts' }, toolResponse: { content: 'x' } });
  const t2 = ingestProviderEvent({ ...base, hookEventName: 'PostToolUse', turnId: 'gen-1', toolName: 'Bash', toolInput: { command: 'ls' }, toolResponse: { stdout: 'y' } });
  const s = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 'gen-1', lastAssistantMessage: 'first real answer' });
  for (const r of [t1, t2, s]) assert.equal(r.captureSessionId, u.captureSessionId);
  // two distinct tools inside one generation must be two distinct events
  assert.equal(t1.accepted.length, 1);
  assert.equal(t2.accepted.length, 1);
  const tools = eventsOf(u.captureSessionId).filter((e) => e.eventType === 'tool.completed');
  assert.equal(tools.length, 2, 'distinct tool invocations stay distinct');
  assert.deepEqual(tools.map((t) => t.toolCall?.name).sort(), ['Bash', 'Read']);
});

await check('Stop retry does not duplicate the assistant message', () => {
  const first = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 'gen-2', lastAssistantMessage: 'second answer' });
  const retry = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 'gen-2', lastAssistantMessage: 'second answer' });
  assert.equal(retry.duplicates.length, 1, 'identical Stop retry is deduped');
  const assistants = eventsOf(first.captureSessionId).filter((e) => e.eventType === 'assistant.message' && e.content === 'second answer');
  assert.equal(assistants.length, 1);
});

await check('SubagentStop does not create a transcript entry', () => {
  const before = eventsOf(ingestProviderEvent({ ...base, hookEventName: 'SessionStart', cwd: workspace }).captureSessionId).length;
  const r = ingestProviderEvent({ ...base, hookEventName: 'SubagentStop', turnId: 'gen-3', lastAssistantMessage: 'subagent output' });
  const after = eventsOf(r.captureSessionId).length;
  assert.equal(after, before, 'subagent must not add a main-transcript event');
});

await check('provider provenance is preserved on canonical events', () => {
  const r = ingestProviderEvent({ ...base, hookEventName: 'UserPromptSubmit', turnId: 'gen-4', prompt: 'provenance check' });
  const raw = fs.readFileSync(getCaptureStorePaths(r.captureSessionId).rawEvents, 'utf8');
  assert.match(raw, /hy4-preview/, 'model preserved in raw payload');
  assert.match(raw, /craft/, 'agent type preserved in raw payload');
});

await check('official transcript import: dedupe + idempotency', async () => {
  const originalHome = process.env.HOME;
  const fakeHome = path.join(workspace, 'home');
  const sessionDir = path.join(fakeHome, '.local', 'share', 'CodeBuddyExtension', 'Data', 'vs', 'history', 'h1', 'transcript-session-9');
  fs.mkdirSync(path.join(sessionDir, 'messages'), { recursive: true });

  const store = (id: string, role: string, parts: unknown[]) => {
    fs.writeFileSync(path.join(sessionDir, 'messages', `${id}.json`), JSON.stringify({
      role, id, createdAt: Date.now(),
      message: JSON.stringify({ role, content: parts }),
    }), 'utf8');
  };
  store('m1', 'user', [{ type: 'text', text: 'real user question from transcript' }]);
  store('m2', 'assistant', [{ type: 'reasoning', text: 'internal reasoning must not be transcribed' }, { type: 'text', text: 'real assistant answer from transcript' }]);
  store('m3', 'assistant', [{ type: 'tool-call', toolName: 'Bash', toolCallId: 'call_1', args: { command: 'pwd' } }]);
  store('m4', 'tool', [{ type: 'tool-result', toolName: 'Bash', toolCallId: 'call_1', result: { stdout: '/' } }]);
  // legitimate repeated user text under a different provider message id
  store('m5', 'user', [{ type: 'text', text: 'real user question from transcript' }]);

  fs.writeFileSync(path.join(sessionDir, 'index.json'), JSON.stringify({
    requests: [{ id: 'r1', type: 'craft', messages: ['m1', 'm2', 'm3', 'm4', 'm5'] }],
  }), 'utf8');

  process.env.HOME = fakeHome;
  try {
    const first = await importCodebuddyHistory(sessionDir);
    assert.equal(first.imported > 0, true);
    const events = eventsOf(first.captureSessionId);
    const users = events.filter((e) => e.eventType === 'user.message');
    assert.equal(users.length, 2, 'identical text from distinct provider message ids must be preserved');
    assert.equal(users[0].content, 'real user question from transcript');
    const assistants = events.filter((e) => e.eventType === 'assistant.message');
    assert.equal(assistants.length, 1, 'one assistant message');
    assert.equal(assistants[0].content, 'real assistant answer from transcript', 'reasoning is excluded from chat text');
    assert.equal(events.filter((e) => e.eventType === 'tool.started').length, 1);
    assert.equal(events.filter((e) => e.eventType === 'tool.completed').length, 1);

    const second = await importCodebuddyHistory(sessionDir);
    assert.equal(second.captureSessionId, first.captureSessionId, 'same providerSessionId reuses one CaptureSession');
    assert.equal(second.imported, 0, 're-import is idempotent');
  } finally {
    process.env.HOME = originalHome;
  }
});

await check('ending the session materializes a real transcript', async () => {
  const r = ingestProviderEvent({ ...base, hookEventName: 'UserPromptSubmit', turnId: 'gen-5', prompt: 'final question' });
  await endProviderSession('codebuddy', SID);
  const state = getCaptureSession(r.captureSessionId);
  assert.equal(state.status, 'ended');
  assert.ok(state.transcriptAssetId, 'transcript asset created');
  const assetPath = state.transcriptAssetId!;
  const found = fs.readdirSync(path.join(workspace, '04-conversations', 'transcripts', 'codebuddy'), { recursive: true }) as string[];
  assert.ok(found.some((f) => f.endsWith('transcript.md')), 'transcript.md written');
  console.log(`        transcript asset: ${assetPath}`);
});

setProjectRoot(original);
fs.rmSync(workspace, { recursive: true, force: true });
if (failures > 0) {
  console.error(`CODEBUDDY_CAPTURE_TEST FAIL (${failures})`);
  process.exit(1);
}
console.log('CODEBUDDY_CAPTURE_TEST PASS');
