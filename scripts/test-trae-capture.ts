/**
 * Trae capture adapter test.
 *
 * Trae CN is an IDE product. Its AI agent module (libai_agent.so) exposes real
 * workspace hook events and payload fields verified on this machine:
 *   hook events : SessionStart, UserPromptSubmit, PreToolUse, PostToolUse,
 *                 PreCompact, Stop, Notification        (NO SessionEnd)
 *   payload     : session_id, hook_event_name, prompt, last_assistant_message,
 *                 stop_hook_active, tool_name / tool_input / tool_response
 *
 * This test proves the adapter contract. It does NOT claim a real Trae E2E: a
 * real Trae AI turn requires an interactive logged-in Trae session, which cannot
 * be driven headlessly here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { endProviderSession, ingestProviderEvent } from '../server/providerAdapterService.ts';
import { getCaptureSession, getCaptureStorePaths } from '../server/captureService.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-trae-test-'));
fs.mkdirSync(path.join(workspace, '04-conversations', 'transcripts'), { recursive: true });
setProjectRoot(workspace);

const SID = 'trae-session-e2e-1';
const base = {
  provider: 'trae' as const,
  providerSessionId: SID,
  client: 'Trae CN',
  agentType: 'build',
  model: 'trae-model',
  providerVersion: '1.107.1',
};

function eventsOf(id: string) {
  return fs.readFileSync(getCaptureStorePaths(id).events, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}`); console.error('        ', (error as Error).message); }
}

await check('SessionStart + UserPromptSubmit + PostToolUse + Stop map correctly', () => {
  const start = ingestProviderEvent({ ...base, hookEventName: 'SessionStart', cwd: workspace });
  const user = ingestProviderEvent({ ...base, hookEventName: 'UserPromptSubmit', turnId: 't1', prompt: 'please fix the bug' });
  const tool = ingestProviderEvent({ ...base, hookEventName: 'PostToolUse', turnId: 't1', toolName: 'Read', toolInput: { path: 'a.ts' }, toolResponse: { content: 'x' } });
  const stop = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 't1', lastAssistantMessage: 'I fixed it.' });
  for (const r of [user, tool, stop]) assert.equal(r.captureSessionId, start.captureSessionId, 'one providerSessionId -> one CaptureSession');
  const events = eventsOf(start.captureSessionId);
  assert.equal(events.filter((e) => e.eventType === 'session.started').length, 1);
  assert.equal(events.filter((e) => e.eventType === 'user.message').length, 1);
  assert.equal(events.find((e) => e.eventType === 'user.message')!.content, 'please fix the bug');
  assert.equal(events.filter((e) => e.eventType === 'tool.completed').length, 1);
  const assistant = events.find((e) => e.eventType === 'assistant.message')!;
  assert.equal(assistant.content, 'I fixed it.', 'Stop carries last_assistant_message');
});

await check('repeated Stop in one turn does not duplicate the assistant message', () => {
  const first = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 't2', lastAssistantMessage: 'done' });
  const retry = ingestProviderEvent({ ...base, hookEventName: 'Stop', turnId: 't2', lastAssistantMessage: 'done' });
  assert.equal(retry.duplicates.length, 1);
  const events = eventsOf(first.captureSessionId);
  assert.equal(events.filter((e) => e.eventType === 'assistant.message' && e.content === 'done').length, 1);
});

await check('two distinct tool calls in one turn stay distinct', () => {
  const a = ingestProviderEvent({ ...base, hookEventName: 'PostToolUse', turnId: 't3', toolName: 'Read', toolInput: { path: 'a.ts' }, toolResponse: {} });
  const b = ingestProviderEvent({ ...base, hookEventName: 'PostToolUse', turnId: 't3', toolName: 'Bash', toolInput: { command: 'ls' }, toolResponse: {} });
  assert.equal(a.accepted.length, 1);
  assert.equal(b.accepted.length, 1);
  const tools = eventsOf(a.captureSessionId).filter((e) => e.eventType === 'tool.completed');
  assert.ok(tools.length >= 2);
});

await check('ending the session materializes a transcript', async () => {
  const r = ingestProviderEvent({ ...base, hookEventName: 'UserPromptSubmit', turnId: 't4', prompt: 'final question' });
  await endProviderSession('trae', SID);
  const state = getCaptureSession(r.captureSessionId);
  assert.equal(state.status, 'ended');
  assert.ok(state.transcriptAssetId, 'transcript materialized');
  assert.equal(state.providerSessionId, SID);
});

setProjectRoot(original);
fs.rmSync(workspace, { recursive: true, force: true });
if (failures > 0) { console.error(`TRAE_CAPTURE_TEST FAIL (${failures})`); process.exit(1); }
console.log('TRAE_CAPTURE_TEST PASS');
