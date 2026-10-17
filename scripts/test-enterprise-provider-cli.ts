import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { APP_ROOT } from '../server/config.ts';
import { attachEnterpriseWorkspaceReadOnly, detachEnterpriseWorkspaceReadOnly } from '../server/enterpriseAttachment.ts';
import { centralEnterpriseStore, assertSafeEnterpriseManagedPath, enableManagedEnterpriseStorage } from '../server/enterpriseStorage.ts';
import { listEnterpriseProviderSessions, readEnterpriseCaptureEvents } from '../server/enterpriseProviderCapture.ts';
import { enterpriseProviderStatuses } from '../server/enterpriseProviderSetup.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-provider-cli-'));
const workspace = path.join(root, 'backV8');
const payment = path.join(workspace, 'phantom-payment');
const module = path.join(payment, 'payment-service');
const operation = path.join(workspace, 'phantom-operation');
const external = path.join(root, 'unregistered');
const bridge = path.join(APP_ROOT, 'scripts', 'capture-enterprise-provider-event.ts');
let workspaceId = '';
function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'CI', GIT_COMMITTER_NAME: 'CI',
      GIT_AUTHOR_EMAIL: 'ci@example.com', GIT_COMMITTER_EMAIL: 'ci@example.com' },
  }).trim();
}
function runHook(provider: string, cwd: string, event: Record<string, unknown>) {
  const result = spawnSync(process.execPath,
    ['--experimental-strip-types', bridge, '--provider=' + provider],
    { cwd, encoding: 'utf8', input: JSON.stringify(event), timeout: 15_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Hook subprocess failed');
}
function runStream(provider: string, cwd: string, events: Array<Record<string, unknown>>) {
  const result = spawnSync(process.execPath,
    ['--experimental-strip-types', bridge, '--provider=' + provider, '--stream'],
    { cwd, encoding: 'utf8', input: events.map(e => JSON.stringify(e)).join('\n') + '\n',
      timeout: 15_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Stream subprocess failed');
}
try {
  for (const dir of [workspace, payment, operation]) {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
  }
  fs.mkdirSync(module, { recursive: true });
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'README.md'), '# backV8 parent repository\n');
  git(workspace, 'add', 'README.md');
  git(workspace, 'commit', '-qm', 'init parent');
  fs.writeFileSync(path.join(module, 'pom.xml'), '<project/>\n');
  git(payment, 'add', '.');
  git(payment, 'commit', '-qm', 'init payment');
  fs.writeFileSync(path.join(operation, 'pom.xml'), '<project/>\n');
  git(operation, 'add', '.');
  git(operation, 'commit', '-qm', 'init operation');
  const initial = [payment, operation].map(dir => git(dir, 'status', '--porcelain'));
  const priorRoot = git(workspace, 'status', '--porcelain');

  const attached = attachEnterpriseWorkspaceReadOnly(workspace, 'backV8 Hook E2E');
  workspaceId = attached.workspace.workspaceId;
  const migration = enableManagedEnterpriseStorage(workspace);
  assert.equal(migration.mode, 'managed');

  // The same Provider Session spans two independent child Git repositories.
  const cid = 'codex-hook-cli-2026';
  const start = { session_id: cid, hook_event_name: 'SessionStart', cwd: module,
    timestamp: '2026-10-16T00:00:00Z', eventId: 'start' };
  runHook('codex', module, start);
  const message = { session_id: cid, hook_event_name: 'UserPromptSubmit', cwd: module,
    timestamp: '2026-10-16T00:01:00Z', eventId: 'prompt',
    prompt: 'Please inspect payment module (synthetic CI fixture)' };
  runHook('codex', module, message);
  runHook('codex', module, message); // stable event ID -> duplicate, not extra text
  runHook('codex', operation, { session_id: cid, hook_event_name: 'PostToolUse', cwd: operation,
    timestamp: '2026-10-16T00:02:00Z', eventId: 'tool', tool_name: 'Read',
    tool_response: 'Reviewed operation module' });
  runHook('codex', operation, { session_id: cid, hook_event_name: 'Stop', cwd: operation,
    timestamp: '2026-10-16T00:03:00Z', eventId: 'assistant',
    last_assistant_message: 'Cross-module references found.' });

  // A forged reported cwd cannot redirect events from another checkout,
  // even when the session ID matches an existing approved session.
  runHook('codex', module, { session_id: cid, hook_event_name: 'Notification',
    cwd: operation, eventId: 'bad-mismatched-cwd', message: 'SHOULD NOT APPEAR' });
  runHook('codex', external, { session_id: cid, hook_event_name: 'Notification',
    cwd: external, eventId: 'bad-external-cwd', message: 'SHOULD NOT APPEAR' });

  runHook('codex', module, { session_id: cid, hook_event_name: 'SessionEnd',
    cwd: module, eventId: 'end', timestamp: '2026-10-16T00:04:00Z' });

  const codex = listEnterpriseProviderSessions(workspace).find(s => s.provider === 'codex'
    && s.providerSessionId === cid);
  assert.ok(codex, 'Actual Hook child process should materialize a Codex session');
  assert.equal(codex.status, 'ended');
  assert.equal(codex.endedBy, 'native-hook');
  assert.equal(codex.captureSource, 'native-hook');
  assert.equal(codex.attribution, 'observed-process-cwd');
  assert.deepEqual(codex.repositories, ['phantom-operation', 'phantom-payment']);
  assert.ok(codex.modules?.includes('phantom-payment/payment-service'));
  assert.equal(codex.acceptedEvents, 5);
  assert.ok(codex.duplicates >= 1);
  const events = readEnterpriseCaptureEvents(workspace, codex.id) as Array<{
    eventId: string; repository: string | null; module: string | null; content: string;
  }>;
  assert.ok(events.some(e => e.repository === 'phantom-operation'));
  assert.ok(events.some(e => e.module === 'phantom-payment/payment-service'));
  assert.ok(!events.some(e => e.content.includes('SHOULD NOT APPEAR')));
  const transcript = path.join(workspace, '.asset-workbench-data', codex.transcriptPath!);
  const markdown = fs.readFileSync(transcript, 'utf8');
  assert.match(markdown, /Please inspect payment module/);
  assert.match(markdown, /Cross-module references found/);

  // OpenCode user-level plugin uses JSONL --stream rather than one process per event.
  const oid = 'opencode-stream-ci-session';
  runStream('opencode', module, [
    { type: 'session.started', sessionID: oid, projectDirectory: module,
      eventId: 'opencode-start', receivedAt: '2026-10-16T00:05:00Z' },
    { type: 'session.ended', sessionID: oid, projectDirectory: module,
      eventId: 'opencode-end', receivedAt: '2026-10-16T00:06:00Z' },
  ]);
  const opencode = listEnterpriseProviderSessions(workspace).find(s => s.provider === 'opencode');
  assert.equal(opencode?.status, 'ended', 'OpenCode streaming bridge should end the same session');
  assert.equal(opencode?.repository, 'phantom-payment');
  assert.ok(enterpriseProviderStatuses(workspace).find(s => s.provider === 'codex')?.captureVerified);
  assert.ok(enterpriseProviderStatuses(workspace).find(s => s.provider === 'opencode')?.captureVerified);

  // A dangling link must be rejected before the first write under the private root.
  const knowledge = path.join(workspace, '.asset-workbench-data', 'knowledge');
  assert.equal(fs.existsSync(knowledge), false);
  fs.symlinkSync(path.join(root, 'nonexistent-company-target'), knowledge);
  assert.throws(() => assertSafeEnterpriseManagedPath(workspace, 'knowledge/notes'), /symlink|链接/i);
  fs.unlinkSync(knowledge);

  for (const [i, dir] of [payment, operation].entries()) {
    assert.equal(git(dir, 'status', '--porcelain'), initial[i], 'Nested business repository is unchanged');
    for (const filename of ['.asset-workbench-data', '.codex', '.codebuddy', '.opencode', '.trae']) {
      assert.equal(fs.existsSync(path.join(dir, filename)), false,
        filename + ' must never be installed into nested company repository');
    }
  }
  assert.equal(git(workspace, 'status', '--porcelain'), priorRoot,
    'Root-only data must not change business Git status');
  console.log('ENTERPRISE_PROVIDER_REAL_CLI_E2E PASS (synthetic Provider payloads)');
} finally {
  if (workspaceId) {
    try { detachEnterpriseWorkspaceReadOnly(workspaceId); } catch { /* cleanup only */ }
  }
  fs.rmSync(centralEnterpriseStore(workspace), { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
}
