import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { attachEnterpriseWorkspaceReadOnly, detachEnterpriseWorkspaceReadOnly, enableEnterpriseWorkspaceManaged,
  auditEnterpriseWorkspaceManaged, rollbackEnterpriseWorkspaceManaged } from '../server/enterpriseAttachment.ts';
import { centralEnterpriseStore, enterpriseEntryForRoot, enableManagedEnterpriseStorage } from '../server/enterpriseStorage.ts';
import { enterpriseStoreFor, freezeEnterpriseWorkspace, listEnterpriseSnapshots } from '../server/enterpriseWorkspace.ts';
import { appendEnterpriseProviderEvent, listEnterpriseProviderSessions, readEnterpriseCaptureEvents,
  resolveEnterpriseProviderOrigin } from '../server/enterpriseProviderCapture.ts';
import { setupEnterpriseUserProviderHooks, enterpriseProviderStatuses } from '../server/enterpriseProviderSetup.ts';
import { importEnterpriseCodexHistory } from '../server/enterpriseProviderHistory.ts';
import { createEnterpriseKnowledgeNote, listEnterpriseKnowledgeNotes } from '../server/enterpriseKnowledge.ts';
import { isIgnoredRelativePath, shouldIgnoreEntry } from '../server/ignorePolicy.ts';
import { listMigratedEnterpriseLegacyAssets, readMigratedEnterpriseLegacyAsset } from '../server/enterpriseLegacyMigration.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-enterprise-managed-'));
const oldHome = process.env.HOME;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-provider-home-'));
let workspaceId = '';
function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME:'Test', GIT_COMMITTER_NAME:'Test',
      GIT_AUTHOR_EMAIL:'test@localhost', GIT_COMMITTER_EMAIL:'test@localhost' },
    stdio: ['ignore','pipe','pipe'],
  }).trim();
}
try {
  process.env.HOME = home;
  const a = path.join(root, 'phantom-payment');
  const b = path.join(root, 'phantom-operation');
  const module = path.join(a, 'service');
  fs.mkdirSync(module, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  // Enterprise roots can themselves be Git repositories, independent of children.
  for (const dir of [root, a, b]) git(dir, 'init', '-q');
  fs.writeFileSync(path.join(root, 'README.md'), '# backV8 root\n');
  git(root, 'add', 'README.md'); git(root, 'commit', '-qm', 'root init');
  fs.writeFileSync(path.join(module, 'pom.xml'), '<project/>');
  git(a, 'add', '.');git(a,'commit','-qm','payment init');
  fs.writeFileSync(path.join(b, 'pom.xml'), '<project/>');
  git(b, 'add', '.');git(b, 'commit','-qm','operation init');
  // Legacy V3 transcript under the project root is copied only with valid
  // managed-asset metadata; the original is kept as a recovery source.
  const oldTranscript = path.join(root, '04-conversations', 'transcripts', 'codex', 'history');
  fs.mkdirSync(oldTranscript, { recursive: true });
  fs.writeFileSync(path.join(oldTranscript, 'metadata.json'),
    JSON.stringify({ schemaVersion: 1, id: 'transcript_1234567890abcd', type: 'conversation-transcript',
      title: 'Old session', source: 'codex', projectRoot: root }));
  fs.writeFileSync(path.join(oldTranscript, 'transcript.md'), '# Previous work record\n');
  const paymentBefore = git(a, 'status', '--porcelain');
  const operationBefore = git(b, 'status', '--porcelain');
  const rootBefore = git(root,'status','--porcelain');

  // Start with central-only, frozen evidence and a pre-existing user data file.
  const legacy = enterpriseStoreFor(root);
  assert.equal(legacy, centralEnterpriseStore(root));
  const snapshot = freezeEnterpriseWorkspace(root);
  assert.equal(snapshot.repositories.length, 3);
  assert.equal(fs.existsSync(path.join(root, '.asset-workbench-data')), false);
  const attached = attachEnterpriseWorkspaceReadOnly(root, 'backV8');
  workspaceId = attached.workspace.workspaceId;
  assert.equal(attached.repositoryCount, 3);
  assert.equal(enterpriseEntryForRoot(root)?.sourcePolicy, 'read-only');
  assert.throws(() => resolveEnterpriseProviderOrigin(module), /No registered managed/);
  assert.equal(fs.existsSync(path.join(root, '.asset-workbench-data')), false);

  const migration = enableEnterpriseWorkspaceManaged(workspaceId);
  assert.equal(migration.legacy?.copies, 1);
  assert.equal(fs.existsSync(path.join(oldTranscript, 'transcript.md')), true);
  assert.ok(fs.existsSync(path.join(root, '.asset-workbench-data', 'knowledge', 'legacy-managed',
    '04-conversations', 'transcripts', 'codex', 'history', 'transcript.md')));
  const legacyAssets = listMigratedEnterpriseLegacyAssets(root);
  assert.equal(legacyAssets.length, 1);
  assert.equal(legacyAssets[0].title, 'Old session');
  assert.match(readMigratedEnterpriseLegacyAsset(root, legacyAssets[0].relative).content, /Previous work record/);
  assert.throws(() => readMigratedEnterpriseLegacyAsset(root, '../phantom-payment'), /not verified/);

  assert.equal(migration.mode, 'managed');
  assert.equal(migration.sourcePreserved, true);
  assert.ok(migration.files >= 1);
  assert.equal(migration.gitExclude, 'added');
  assert.equal(enterpriseEntryForRoot(root)?.sourcePolicy, 'managed');
  assert.equal(enterpriseStoreFor(root), path.join(root, '.asset-workbench-data', 'enterprise'));
  const rawRoot = path.join(root, '.asset-workbench-data', 'enterprise', 'raw');
  fs.mkdirSync(rawRoot, { recursive: true });
  fs.symlinkSync(a, path.join(rawRoot, 'ab'), 'dir');
  assert.throws(() => enterpriseStoreFor(root), /符号链接/);
  fs.unlinkSync(path.join(rawRoot, 'ab'));
  const mirrorsRoot = path.join(root, '.asset-workbench-data', 'enterprise', 'mirrors');
  fs.mkdirSync(mirrorsRoot, { recursive: true });
  fs.symlinkSync(b, path.join(mirrorsRoot, 'spoofed.git'), 'dir');
  assert.throws(() => enterpriseStoreFor(root), /符号链接/);
  fs.unlinkSync(path.join(mirrorsRoot, 'spoofed.git'));

  assert.equal(fs.existsSync(path.join(legacy, 'snapshots', snapshot.snapshotId + '.json')), true,
    'Legacy central evidence must survive migration');
  assert.deepEqual(listEnterpriseSnapshots(root).map(x => x.snapshotId), [snapshot.snapshotId]);
  assert.equal(enableManagedEnterpriseStorage(root).digest, migration.digest, 'Migration must be idempotent');
  // A corrupt receipt must never cause silent adoption of an existing directory.
  const receiptFile = path.join(root, '.asset-workbench-data', 'enterprise', 'managed-migration.json');
  const originalReceipt = fs.readFileSync(receiptFile, 'utf8');
  try {
    const forged = { ...JSON.parse(originalReceipt) as Record<string, unknown>, digest: '0'.repeat(64) };
    fs.writeFileSync(receiptFile, JSON.stringify(forged), 'utf8');
    assert.throws(() => enableManagedEnterpriseStorage(root), /迁移回执|校验不一致/);
  } finally { fs.writeFileSync(receiptFile, originalReceipt, 'utf8'); }
  const auditBeforeCapture = auditEnterpriseWorkspaceManaged(workspaceId);
  assert.equal(auditBeforeCapture.expectedFiles, auditBeforeCapture.verifiedFiles);
  assert.equal(auditBeforeCapture.rollbackSafe, true);

  assert.ok(fs.readFileSync(path.join(root, '.git', 'info', 'exclude'), 'utf8')
    .includes('/.asset-workbench-data/'));
  assert.equal(git(root, 'check-ignore', '-q', '.asset-workbench-data') || '', '');
  assert.equal(git(root, 'status','--porcelain'), rootBefore, 'Root Git worktree content must remain unchanged');

  const context = resolveEnterpriseProviderOrigin(module, module);
  assert.equal(context.workspaceId, workspaceId);
  assert.equal(context.repository, 'phantom-payment');
  assert.equal(context.module, 'phantom-payment/service');
  assert.equal(context.attribution, 'observed-process-cwd');

  const original = {
    provider: 'codebuddy', providerSessionId: 'cb-real-session-id-1',
    hookEventName: 'UserPromptSubmit', cwd: module, observedCwd: module,
    eventId: 'cb:1', content: 'How does payment work?', rawPayload: { password: 'never-store-this', prompt: 'How does payment work?' },
  };
  const first = appendEnterpriseProviderEvent(original);
  assert.equal(first.state.repository, 'phantom-payment');
  assert.equal(first.state.module, 'phantom-payment/service');
  assert.equal(first.state.acceptedEvents, 1);
  assert.equal(appendEnterpriseProviderEvent(original).duplicate, true);
  const switched = appendEnterpriseProviderEvent({ ...original, cwd: b, observedCwd: b,
    eventId: 'cb:2', content: 'Check operation contracts too' });
  assert.equal(switched.state.repository, 'phantom-payment', 'primary source remains stable');
  assert.deepEqual(switched.state.repositories, ['phantom-operation','phantom-payment'],
    'one Provider session must span different Git repositories inside the same Workspace');
  assert.ok(switched.state.modules?.includes('phantom-operation'));
  assert.equal(switched.state.workdirTransitions, 1);
  const returned = appendEnterpriseProviderEvent({ ...original,
    eventId: 'cb:3', content: 'Back to the payment service' });
  assert.equal(returned.state.workdirTransitions, 2);
  assert.equal(returned.state.acceptedEvents, 3);
  assert.throws(() => appendEnterpriseProviderEvent({ ...original, cwd: home, eventId: 'cb:outside', observedCwd: home }),
    /No registered managed/);
  assert.throws(() => appendEnterpriseProviderEvent({ ...original, cwd: module, observedCwd: b, eventId: 'cb:bad' }),
    /disagree/);
  assert.throws(() => appendEnterpriseProviderEvent({ ...original, cwd: module, observedCwd: home,
    eventId: 'cb:spoofed-reported-cwd' }), /process cwd outside/);

  const ended = appendEnterpriseProviderEvent({ ...original, hookEventName:'SessionEnd', eventId:'cb:end', content:'' });
  assert.equal(ended.state.status, 'ended');
  assert.equal(auditEnterpriseWorkspaceManaged(workspaceId).rollbackSafe, false);
  assert.throws(() => rollbackEnterpriseWorkspaceManaged(workspaceId, 'ROLLBACK_MANAGED_ROUTING'),
    /拒绝自动回滚/);

  const transcript = path.join(root, '.asset-workbench-data', ended.state.transcriptPath!);
  assert.ok(fs.readFileSync(transcript, 'utf8').includes('How does payment work?'));
  assert.match(fs.readFileSync(transcript, 'utf8'), /Touched repositories: phantom-operation, phantom-payment/);
  assert.match(fs.readFileSync(transcript, 'utf8'), /Completed by: native-hook/);
  assert.ok(!fs.readFileSync(path.join(root,'.asset-workbench-data','capture','sessions',ended.state.id,'events.jsonl'),'utf8')
    .includes('never-store-this'));
  assert.ok(listEnterpriseProviderSessions(root).some(s => s.id === ended.state.id && s.status === 'ended'));
  // Adversarial file-level boundaries: directory checks must also protect
  // individual events.jsonl, state.json, transcripts and knowledge files.
  const originalPom = fs.readFileSync(path.join(module, 'pom.xml'));
  const captureId = (provider: string, sid: string) =>
    'enterprise_capture_' + createHash('sha256')
      .update(workspaceId + ':' + provider + ':' + sid).digest('hex').slice(0, 48);
  const privateSessions = path.join(root, '.asset-workbench-data', 'capture', 'sessions');
  const eventSymlinkId = captureId('codebuddy', 'symlink-event-test');
  const eventSymlinkDir = path.join(privateSessions, eventSymlinkId);
  fs.mkdirSync(eventSymlinkDir, { recursive: true });
  const eventSymlink = path.join(eventSymlinkDir, 'events.jsonl');
  fs.symlinkSync(path.join(module, 'pom.xml'), eventSymlink);
  assert.throws(() => appendEnterpriseProviderEvent({
    ...original, providerSessionId: 'symlink-event-test', eventId: 'symlink:event',
  }), /ELOOP|symbolic|symlink|linked|file/i);
  fs.unlinkSync(eventSymlink);
  assert.ok(fs.readFileSync(path.join(module, 'pom.xml')).equals(originalPom),
    'A symlinked enterprise event log must NEVER write the Maven source file');
  // A hard link is equally dangerous even though it is not a symlink.
  fs.linkSync(path.join(module, 'pom.xml'), eventSymlink);
  assert.throws(() => appendEnterpriseProviderEvent({
    ...original, providerSessionId: 'symlink-event-test', eventId: 'hardlink:event',
  }), /linked|non-regular/i);
  fs.unlinkSync(eventSymlink);
  assert.ok(fs.readFileSync(path.join(module, 'pom.xml')).equals(originalPom));
  // Transcript replacement uses an atomic rename, never overwrites its target.
  const transcriptId = 'symlink-transcript-test';
  appendEnterpriseProviderEvent({ ...original, providerSessionId: transcriptId,
    hookEventName: 'SessionStart', eventId: 'link:start' });
  const transcriptFile = path.join(root, '.asset-workbench-data', 'conversations', 'transcripts',
    captureId('codebuddy', transcriptId) + '.md');
  fs.mkdirSync(path.dirname(transcriptFile), { recursive: true });
  fs.symlinkSync(path.join(module, 'pom.xml'), transcriptFile);
  const safeEnd = appendEnterpriseProviderEvent({ ...original, providerSessionId: transcriptId,
    hookEventName: 'SessionEnd', eventId: 'link:end' });
  assert.equal(safeEnd.state.status, 'ended');
  assert.equal(fs.lstatSync(transcriptFile).isSymbolicLink(), false);
  assert.ok(fs.readFileSync(path.join(module, 'pom.xml')).equals(originalPom));
  // Retry an End event interrupted between durable log append and state update.
  const recoverySession = 'recover-ended-session';
  const recoveryStart = appendEnterpriseProviderEvent({ ...original,
    providerSessionId: recoverySession, hookEventName: 'SessionStart', eventId: 'recovery:start' });
  fs.appendFileSync(path.join(privateSessions, recoveryStart.state.id, 'events.jsonl'),
    JSON.stringify({ eventId: 'recovery:end', kind: 'session.ended',
      timestamp: new Date().toISOString(), content: '' }) + '\n');
  const retry = appendEnterpriseProviderEvent({ ...original, providerSessionId: recoverySession,
    hookEventName: 'SessionEnd', eventId: 'recovery:end', content: '' });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state.status, 'ended');
  assert.ok(fs.existsSync(path.join(root, '.asset-workbench-data', retry.state.transcriptPath!)));
  // A long-running Hook helper caches IDs but must observe events produced by
  // a different process and reject partial/corrupt external appends.
  const incrementalSession = 'incremental-multi-process';
  const incremental = appendEnterpriseProviderEvent({ ...original,
    provider: 'opencode', providerSessionId: incrementalSession,
    cwd: b, observedCwd: b, hookEventName: 'SessionStart', eventId: 'incremental:start' });
  const externalWorker = path.join(process.cwd(), 'scripts', 'capture-enterprise-provider-event.ts');
  const externalEvent = { type: 'message.part.updated', sessionID: incrementalSession,
    projectDirectory: b, eventId: 'incremental:remote',
    properties: { sessionID: incrementalSession, part: { text: 'A second process added this event' } } };
  execFileSync('node', ['--experimental-strip-types', externalWorker, '--provider=opencode', '--stream'], {
    cwd: b, timeout: 20_000, encoding: 'utf8',
    input: JSON.stringify(externalEvent) + '\n', env: process.env,
  });
  const duplicateRemote = appendEnterpriseProviderEvent({ ...original, provider: 'opencode',
    providerSessionId: incrementalSession, cwd: b, observedCwd: b,
    hookEventName: 'Notification', eventId: 'incremental:remote' });
  assert.equal(duplicateRemote.duplicate, true, 'cached indexes must see remote process writes');
  assert.equal(duplicateRemote.state.acceptedEvents, 2);
  const incrementalLog = path.join(privateSessions, incremental.state.id, 'events.jsonl');
  const lengthBeforeCorruption = fs.statSync(incrementalLog).size;
  fs.appendFileSync(incrementalLog, '{"eventId":"broken-event"');
  assert.throws(() => appendEnterpriseProviderEvent({ ...original, provider: 'opencode',
    providerSessionId: incrementalSession, cwd: b, observedCwd: b,
    eventId: 'incremental:after-broken' }), /incomplete JSONL/);
  fs.truncateSync(incrementalLog, lengthBeforeCorruption);
  assert.equal(appendEnterpriseProviderEvent({ ...original, provider: 'opencode',
    providerSessionId: incrementalSession, cwd: b, observedCwd: b,
    eventId: 'incremental:after-recovery' }).state.acceptedEvents, 3);

  // The UI endpoint may expose conversational content but must NEVER expose
  // complete raw provider payloads containing unrecognized secret fields.
  const visible = readEnterpriseCaptureEvents(root, ended.state.id) as Array<Record<string, unknown>>;
  assert.ok(visible.length >= 2);
  assert.ok(visible.every(row => !Object.hasOwn(row, 'rawPayload')));
  assert.ok(!JSON.stringify(visible).includes('never-store-this'));


  // User-level global hooks: existing personal settings preserved, no child repository configuration.
  const settings = path.join(home, '.codebuddy', 'settings.json');
  fs.mkdirSync(path.dirname(settings),{recursive:true});
  fs.writeFileSync(settings, JSON.stringify({ theme:'user-custom', hooks: {
    Stop:[{ hooks:[{type:'command',command:'echo custom'}] }],
  }}));
  assert.throws(() => setupEnterpriseUserProviderHooks(''), /明确授权/);
  const installed = setupEnterpriseUserProviderHooks('INSTALL_USER_LEVEL_PROVIDER_HOOKS');
  assert.equal(installed.length, 7);
  assert.equal(installed.filter(x => x.status === 'installed').length, 4);
  assert.ok(setupEnterpriseUserProviderHooks('INSTALL_USER_LEVEL_PROVIDER_HOOKS')
    .filter(x => x.status === 'already-configured').length >= 4);
  const codebuddy = JSON.parse(fs.readFileSync(settings, 'utf8')) as { theme:string;hooks:{Stop:Array<{hooks:Array<{command:string}>}>}};
  assert.equal(codebuddy.theme,'user-custom');
  assert.equal(codebuddy.hooks.Stop[0].hooks[0].command,'echo custom');
  assert.equal(enterpriseProviderStatuses(root).find(x=>x.provider==='codebuddy')?.captureVerified,true);
  // The installed OpenCode observer MUST NOT synchronously spawn a fresh
  // subprocess on every streaming token (that used to freeze the IDE).
  const opencodePlugin = path.join(home, '.config', 'opencode', 'plugins', 'awb-enterprise-capture.js');
  const pluginCode = fs.readFileSync(opencodePlugin, 'utf8');
  assert.match(pluginCode, /spawn\\?\('node'/);
  assert.match(pluginCode, /--stream/);
  assert.doesNotMatch(pluginCode, /spawnSync\(/);
  execFileSync('node', ['--check', opencodePlugin], { encoding: 'utf8', timeout: 10_000 });
  const workerSource = path.join(process.cwd(), 'scripts', 'capture-enterprise-provider-event.ts');
  const streamEvents = [
    { type:'session.started', sessionID:'opencode-worker-session', eventId:'oc:1',
      projectDirectory:b, timestamp:new Date().toISOString() },
    { type:'message.part.updated', sessionID:'opencode-worker-session', eventId:'oc:2',
      projectDirectory:b, properties:{ sessionID:'opencode-worker-session', part:{
        id:'oc:part:1', text:'Hello from a live async capture stream' } } },
    { type:'session.ended', sessionID:'opencode-worker-session', eventId:'oc:3',
      projectDirectory:b, timestamp:new Date().toISOString() },
  ];
  execFileSync('node', ['--experimental-strip-types', workerSource, '--provider=opencode', '--stream'], {
    cwd:b, timeout:20_000, encoding:'utf8', input:streamEvents.map(e=>JSON.stringify(e)).join('\n')+'\n',
    env:process.env,
  });
  const opencodeSaved = listEnterpriseProviderSessions(root).find(s => s.provider === 'opencode'
    && s.providerSessionId === 'opencode-worker-session');
  assert.equal(opencodeSaved?.status, 'ended');
  assert.equal(opencodeSaved?.acceptedEvents, 3);
  assert.equal(opencodeSaved?.repository, 'phantom-operation');
  assert.ok(fs.readFileSync(path.join(root,'.asset-workbench-data',opencodeSaved!.transcriptPath!), 'utf8')
    .includes('Hello from a live async capture stream'));
  // Never overwrite an existing user-customized plugin on the next setup run.
  fs.writeFileSync(opencodePlugin, '/* user-modified OpenCode plugin */\n');
  try {
    const retry = setupEnterpriseUserProviderHooks('INSTALL_USER_LEVEL_PROVIDER_HOOKS');
    assert.equal(retry.find(x => x.provider === 'opencode')?.status, 'blocked');
    assert.equal(fs.readFileSync(opencodePlugin,'utf8'), '/* user-modified OpenCode plugin */\n');
  } finally { fs.writeFileSync(opencodePlugin, pluginCode); }
  for (const dir of [a,b]) {
    assert.equal(fs.existsSync(path.join(dir, '.asset-workbench-data')), false);
    assert.equal(fs.existsSync(path.join(dir, '.codebuddy')), false);
    assert.equal(fs.existsSync(path.join(dir, '.opencode')), false);
  }

  // Official history with cwd proof is imported into the correct managed workbench.
  const historyRoot = path.join(home, '.codex', 'sessions', '2026','10');
  fs.mkdirSync(historyRoot, { recursive:true });
  const source = path.join(historyRoot, 'rollout.jsonl');
  const rows = [
    { type:'session_meta', payload:{session_id:'codex-official-001',cwd:b} },
    { type:'response_item',timestamp:new Date().toISOString(),payload:{item:{role:'user',text:'Review operation'}} },
    { type:'response_item',timestamp:new Date().toISOString(),payload:{item:{role:'assistant',text:'Found a dependency'}} },
  ];
  fs.writeFileSync(source, rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  const imported = importEnterpriseCodexHistory(source, workspaceId, { finalize: true });
  assert.equal(imported.imported, 2);
  assert.equal(imported.workspaceId, workspaceId);
  assert.equal(imported.finalized, true, 'an explicit official history import must produce a readable transcript');
  const importedAgain = importEnterpriseCodexHistory(source, workspaceId, { finalize: true });
  assert.equal(importedAgain.duplicates, 2);
  assert.equal(importedAgain.finalized, true);
  assert.throws(() => importEnterpriseCodexHistory(source, 'enterprise-' + '0'.repeat(24), { finalize: true }), /不匹配/);
  const archived = listEnterpriseProviderSessions(root).find(s => s.provider === 'codex'
    && s.providerSessionId === 'codex-official-001');
  assert.equal(archived?.repository, 'phantom-operation');
  assert.equal(archived?.status, 'ended');
  assert.equal(archived?.endedBy, 'official-import');
  assert.equal(archived?.captureSource, 'official-import');
  assert.ok(archived?.transcriptPath);
  assert.match(fs.readFileSync(path.join(root, '.asset-workbench-data', archived!.transcriptPath!), 'utf8'),
    /Found a dependency/);
  assert.match(fs.readFileSync(path.join(root, '.asset-workbench-data', archived!.transcriptPath!), 'utf8'),
    /Completed by: official-import/);
  const codexStatus = enterpriseProviderStatuses(root).find(p => p.provider === 'codex');
  assert.equal(codexStatus?.captureVerified, false,
    'an imported historical record must not falsely certify live Provider Hook operation');
  assert.equal(codexStatus?.importedSessions, 1);
  const corrupted = path.join(historyRoot, 'corrupted.jsonl');
  fs.writeFileSync(corrupted, fs.readFileSync(source, 'utf8') + '{broken-jsonl\\n');
  assert.throws(() => importEnterpriseCodexHistory(corrupted, workspaceId, { finalize: true }),
    /invalid\/truncated/);
  // A deliberate historical import must never close a concurrently active
  // native Codex Hook session before its real SessionEnd arrives.
  const liveSource = path.join(historyRoot, 'live-in-progress.jsonl');
  const liveSessionId = 'codex-live-in-progress';
  fs.writeFileSync(liveSource, [
    { type: 'session_meta', payload: { session_id: liveSessionId, cwd: b } },
    { type: 'response_item', payload: { item: { role: 'user', text: 'Native hook still running' } } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  appendEnterpriseProviderEvent({
    provider: 'codex', providerSessionId: liveSessionId, hookEventName: 'SessionStart',
    cwd: b, observedCwd: b, eventId: 'codex-native:start',
  });
  const liveImported = importEnterpriseCodexHistory(liveSource, workspaceId, { finalize: true });
  assert.equal(liveImported.imported, 1);
  assert.equal(liveImported.finalized, false);
  assert.equal(listEnterpriseProviderSessions(root).find(s => s.providerSessionId === liveSessionId)?.status, 'active');
  const liveEnded = appendEnterpriseProviderEvent({
    provider: 'codex', providerSessionId: liveSessionId, hookEventName: 'SessionEnd',
    cwd: b, observedCwd: b, eventId: 'codex-native:end',
  });
  assert.equal(liveEnded.state.status, 'ended');
  assert.equal(liveEnded.state.endedBy, 'native-hook');
  assert.equal(liveEnded.state.captureSource, 'native-hook');
  assert.match(fs.readFileSync(path.join(root,'.asset-workbench-data', liveEnded.state.transcriptPath!), 'utf8'),
    /Native hook still running/);


  const note = createEnterpriseKnowledgeNote(root,{title:'Payment decision',content:'Use exactly-once transfer semantics',repository:'phantom-payment',module:'phantom-payment/service'});
  assert.equal(listEnterpriseKnowledgeNotes(root)[0]?.id,note.id);
  assert.ok(fs.existsSync(path.join(root,'.asset-workbench-data','knowledge','notes',note.id+'.json')));
  const linkedKnowledgeId = 'knowledge_' + randomUUID();
  const linkedKnowledge = path.join(root, '.asset-workbench-data', 'knowledge', 'notes',
    linkedKnowledgeId + '.json');
  fs.symlinkSync(path.join(module, 'pom.xml'), linkedKnowledge);
  assert.equal(listEnterpriseKnowledgeNotes(root).some(item => item.id === linkedKnowledgeId), false);
  fs.unlinkSync(linkedKnowledge);

  // Even after initial approval, a forced Git index addition must STOP the
  // Provider observer instead of mutating now-tracked company files.
  const trackedPath = '.asset-workbench-data/knowledge/notes/' + note.id + '.json';
  git(root, 'add', '-f', '--', trackedPath);
  assert.throws(() => appendEnterpriseProviderEvent({ ...original,
    providerSessionId: 'after-forced-tracking', eventId: 'after-tracking:1' }),
    /Git already tracks/);
  git(root, 'reset', '-q', '--', trackedPath);
  assert.equal(git(root, 'status', '--porcelain'), rootBefore);
  assert.equal(git(a,'status','--porcelain'),paymentBefore);
  assert.equal(git(b,'status','--porcelain'),operationBefore);
  assert.equal(isIgnoredRelativePath('.asset-workbench-data/provider/events'),true);
  assert.equal(shouldIgnoreEntry('', '.asset-workbench-data', true),true);
  // Never overwrite a business directory that already has tracked V3 data.
  const trackedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-tracked-managed-'));
  let trackedWorkspace = '';
  try {
    git(trackedRoot, 'init', '-q');
    const trackedData = path.join(trackedRoot, '.asset-workbench-data');
    fs.mkdirSync(trackedData, { recursive: true });
    fs.writeFileSync(path.join(trackedData, 'tracked.json'), '{"keep":true}\n');
    git(trackedRoot, 'add', '.asset-workbench-data/tracked.json');
    git(trackedRoot, 'commit', '-qm', 'existing tracked company state');
    trackedWorkspace = attachEnterpriseWorkspaceReadOnly(trackedRoot).workspace.workspaceId;
    const before = git(trackedRoot, 'status', '--porcelain');
    assert.throws(() => enableManagedEnterpriseStorage(trackedRoot), /Git already tracks/);
    assert.equal(git(trackedRoot, 'status', '--porcelain'), before);
    assert.equal(fs.readFileSync(path.join(trackedData, 'tracked.json'), 'utf8'), '{"keep":true}\n');
  } finally {
    if (trackedWorkspace) detachEnterpriseWorkspaceReadOnly(trackedWorkspace);
    fs.rmSync(centralEnterpriseStore(trackedRoot), { recursive: true, force: true });
    fs.rmSync(trackedRoot, { recursive: true, force: true });
  }
  // Never adopt a pre-existing enterprise/ directory without an owner receipt.
  const foreignRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-foreign-managed-'));
  let foreignWorkspace = '';
  try {
    git(foreignRoot, 'init', '-q');
    fs.writeFileSync(path.join(foreignRoot, 'README.md'), 'unrelated project\n');
    git(foreignRoot, 'add', 'README.md'); git(foreignRoot, 'commit', '-qm', 'initial');
    foreignWorkspace = attachEnterpriseWorkspaceReadOnly(foreignRoot).workspace.workspaceId;
    const target = path.join(foreignRoot, '.asset-workbench-data', 'enterprise');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'existing.txt'), 'not ours\n');
    assert.throws(() => enableManagedEnterpriseStorage(foreignRoot), /没有可信迁移回执/);
    assert.equal(fs.readFileSync(path.join(target, 'existing.txt'), 'utf8'), 'not ours\n');
  } finally {
    if (foreignWorkspace) detachEnterpriseWorkspaceReadOnly(foreignWorkspace);
    fs.rmSync(centralEnterpriseStore(foreignRoot), { recursive: true, force: true });
    fs.rmSync(foreignRoot, { recursive: true, force: true });
  }
  console.log('ENTERPRISE_MANAGED_PROVIDER_E2E PASS');
} finally {
  if (workspaceId) {
    try { detachEnterpriseWorkspaceReadOnly(workspaceId); } catch { /* cleanup only */ }
  }
  const legacy = centralEnterpriseStore(root);
  fs.rmSync(legacy, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
}
