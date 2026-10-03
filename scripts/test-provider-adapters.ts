import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { endProviderSession, importCodexHistory, ingestProviderEvent } from '../server/providerAdapterService.ts';
import { getCaptureSession, getCaptureStorePaths } from '../server/captureService.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-provider-test-'));
fs.mkdirSync(path.join(workspace, '04-conversations/transcripts'), { recursive: true });
setProjectRoot(workspace);
try {
  const start = ingestProviderEvent({ provider: 'codex', providerSessionId: 'codex-test-1', hookEventName: 'SessionStart', cwd: workspace });
  const user = ingestProviderEvent({ provider: 'codex', providerSessionId: 'codex-test-1', hookEventName: 'UserPromptSubmit', turnId: 'turn-1', prompt: 'hello capture' });
  const tool = ingestProviderEvent({ provider: 'codex', providerSessionId: 'codex-test-1', hookEventName: 'PostToolUse', turnId: 'turn-1', toolName: 'Bash', toolInput: { command: 'pwd' }, toolResponse: { output: workspace } });
  const assistant = ingestProviderEvent({ provider: 'codex', providerSessionId: 'codex-test-1', hookEventName: 'Stop', turnId: 'turn-1', lastAssistantMessage: 'captured reply' });
  assert.equal(start.captureSessionId, user.captureSessionId);
  assert.equal(user.captureSessionId, tool.captureSessionId);
  assert.deepEqual(ingestProviderEvent({ provider: 'codex', providerSessionId: 'codex-test-1', hookEventName: 'UserPromptSubmit', turnId: 'turn-1', prompt: 'hello capture' }).duplicates.length, 1);
  await endProviderSession('codex', 'codex-test-1');
  const state = getCaptureSession(assistant.captureSessionId);
  assert.equal(state.status, 'ended');
  assert.ok(state.transcriptAssetId);
  const store = getCaptureStorePaths(state.captureSessionId);
  assert.match(fs.readFileSync(store.events, 'utf8'), /user.message/);
  assert.match(fs.readFileSync(store.events, 'utf8'), /tool.completed/);
  assert.match(fs.readFileSync(store.events, 'utf8'), /assistant.message/);

  const codeBuddy = ingestProviderEvent({ provider: 'codebuddy', providerSessionId: 'codebuddy-contract-1', hookEventName: 'UserPromptSubmit', turnId: 'turn-1', prompt: 'provider-neutral contract' });
  const codeArts = ingestProviderEvent({ provider: 'codearts', providerSessionId: 'codearts-contract-1', hookEventName: 'PostToolUse', turnId: 'turn-1', toolName: 'Read', toolInput: { path: 'README.md' }, toolResponse: { output: 'ok' } });
  assert.ok(codeBuddy.accepted.length === 1);
  assert.ok(codeArts.accepted.length === 1);

  const originalHome = process.env.HOME;
  process.env.HOME = workspace;
  const historyDir = path.join(workspace, '.codex', 'sessions', '2026', '10', '03');
  fs.mkdirSync(historyDir, { recursive: true });
  const history = path.join(historyDir, 'rollout-test.jsonl');
  fs.writeFileSync(history, [
    JSON.stringify({ timestamp: '2026-10-03T00:00:00.000Z', type: 'session_meta', payload: { session_id: 'history-test-1' } }),
    JSON.stringify({ timestamp: '2026-10-03T00:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ text: 'historic user message' }] } }),
    JSON.stringify({ timestamp: '2026-10-03T00:00:02.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ text: 'historic assistant message' }] } }),
  ].join('\n'), 'utf8');
  const imported = await importCodexHistory(history);
  const duplicateImport = await importCodexHistory(history);
  assert.equal(imported.imported, 2);
  assert.equal(duplicateImport.imported, 0);
  process.env.HOME = originalHome;
  console.log('PROVIDER_ADAPTER_TEST PASS');
} finally {
  setProjectRoot(original);
  fs.rmSync(workspace, { recursive: true, force: true });
}
