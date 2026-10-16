import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachEnterpriseWorkspaceReadOnly, detachEnterpriseWorkspaceReadOnly, enableEnterpriseWorkspaceManaged,
  auditEnterpriseWorkspaceManaged, rollbackEnterpriseWorkspaceManaged } from '../server/enterpriseAttachment.ts';
import { centralEnterpriseStore, enterpriseEntryForRoot, enableManagedEnterpriseStorage } from '../server/enterpriseStorage.ts';
import { enterpriseStoreFor, freezeEnterpriseWorkspace, listEnterpriseSnapshots } from '../server/enterpriseWorkspace.ts';
import { appendEnterpriseProviderEvent, listEnterpriseProviderSessions,
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
  assert.throws(() => appendEnterpriseProviderEvent({ ...original, cwd: b, observedCwd: b, eventId: 'cb:2' }),
    /repository changed|session identity/);
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
  assert.ok(!fs.readFileSync(path.join(root,'.asset-workbench-data','capture','sessions',ended.state.id,'events.jsonl'),'utf8')
    .includes('never-store-this'));
  assert.ok(listEnterpriseProviderSessions(root).some(s => s.id === ended.state.id && s.status === 'ended'));

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
  const imported = importEnterpriseCodexHistory(source);
  assert.equal(imported.imported,2);
  assert.equal(imported.workspaceId,workspaceId);
  assert.equal(importEnterpriseCodexHistory(source).duplicates,2);
  assert.throws(() => importEnterpriseCodexHistory(source, 'enterprise-' + '0'.repeat(24)), /不匹配/);
  assert.ok(listEnterpriseProviderSessions(root).some(s => s.provider === 'codex' && s.repository === 'phantom-operation'));

  const note = createEnterpriseKnowledgeNote(root,{title:'Payment decision',content:'Use exactly-once transfer semantics',repository:'phantom-payment',module:'phantom-payment/service'});
  assert.equal(listEnterpriseKnowledgeNotes(root)[0]?.id,note.id);
  assert.ok(fs.existsSync(path.join(root,'.asset-workbench-data','knowledge','notes',note.id+'.json')));
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
