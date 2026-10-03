/**
 * Integration tests for Managed Knowledge Asset persistence.
 *
 * Run with: node scripts/test-managed-assets.ts
 * (Node 22.6+ strips TS types natively; this project sets "type": "module".)
 *
 * The tests use an isolated temporary workspace so the real project tree is
 * never mutated. The workbench projectRoot is pointed at that temp dir for the
 * duration of the run, then restored.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import {
  isManagedWritableRelative,
  assertManagedWritable,
  WritePolicyError,
} from '../server/managedPathPolicy.ts';
import {
  createConversation,
  createDesign,
  createDecision,
  promoteConversationToDesign,
  promoteDesignToDecision,
  getManagedAssetByPath,
  slugifyTitle,
  ConflictError,
  InvalidInputError,
} from '../server/managedAssetService.ts';
import { detectManagedType } from '../server/assetClassifier.ts';

function tmpPrefix(): string {
  return path.join(os.tmpdir(), `aw3-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}

function makeWorkspace(): string {
  const root = tmpPrefix();
  fs.mkdirSync(root, { recursive: true });
  for (const d of [
    '04-conversations/chatgpt',
    '04-conversations/codex',
    '04-conversations/codex/manual', // ensure manual dir not auto-created by us
    '02-design/architecture',
    '02-design/product',
    '02-design/technical',
    '02-design/decisions',
  ]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  // Pre-existing decision to verify numbering continues from max+1.
  fs.writeFileSync(
    path.join(root, '02-design/decisions/0001-project-workspace.md'),
    '# Decision 0001\n\nStatus: accepted\n',
  );
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

// ---------------------------------------------------------------------------
// Path policy
// ---------------------------------------------------------------------------
test('managed path policy allows managed areas and rejects escapes', () => {
  assert.equal(isManagedWritableRelative('04-conversations/manual/x/conversation.md'), true);
  assert.equal(isManagedWritableRelative('02-design/architecture/x.md'), true);
  assert.equal(isManagedWritableRelative('02-design/decisions/x.md'), true);
  assert.equal(isManagedWritableRelative('03-docs/x.md'), true);
  assert.equal(isManagedWritableRelative('src/App.tsx'), false);
  assert.equal(isManagedWritableRelative('server/assetPlugin.ts'), false);
  assert.equal(isManagedWritableRelative('package.json'), false);
  assert.equal(isManagedWritableRelative('index.html'), false);
  assert.equal(isManagedWritableRelative('../foo'), false);
  assert.equal(isManagedWritableRelative('/etc/passwd'), false);
  assert.equal(isManagedWritableRelative('00-introduction/x.md'), false);
});

test('assertManagedWritable rejects src/ and escapes with proper error', () => {
  assert.throws(() => assertManagedWritable(workspace, 'src/App.tsx'), WritePolicyError);
  assert.throws(() => assertManagedWritable(workspace, '../../foo'), WritePolicyError);
  assert.throws(() => assertManagedWritable(workspace, 'package.json'), WritePolicyError);
  // valid path resolves inside root
  const abs = assertManagedWritable(workspace, '04-conversations/manual/a/conversation.md');
  assert.ok(abs.startsWith(workspace));
});

// ---------------------------------------------------------------------------
// Classifier priority
// ---------------------------------------------------------------------------
test('classifier prioritizes decision over design', () => {
  assert.equal(detectManagedType('02-design/decisions/0002-x.md'), 'decision');
  assert.equal(detectManagedType('02-design/architecture/x.md'), 'design');
  assert.equal(detectManagedType('04-conversations/manual/x/conversation.md'), 'conversation');
  assert.equal(detectManagedType('01-code/main.ts'), undefined);
});

// ---------------------------------------------------------------------------
// Slug sanitization
// ---------------------------------------------------------------------------
test('slugifyTitle produces safe ascii slugs', async () => {
  assert.equal(slugifyTitle('Asset Workbench Persistence'), 'asset-workbench-persistence');
  assert.equal(slugifyTitle('../../etc/passwd'), 'etc-passwd');
  assert.equal(slugifyTitle('中文标题 Test'), 'test');
  // A path-injection design area is neutralized into a single safe segment and
  // still lands under 02-design (no escape, no '..').
  const neutral = await createDesign({ title: 't', designArea: 'a/b', content: 'x' });
  assert.ok(neutral.path.startsWith('02-design/'), 'stays under 02-design');
  assert.ok(!neutral.path.includes('..'), 'no parent escape');
});

// ---------------------------------------------------------------------------
// Conversation create + persistence
// ---------------------------------------------------------------------------
test('createConversation writes real files on disk', async () => {
  const res = await createConversation({
    title: 'Asset Workbench Persistence Test',
    source: 'manual',
    content: 'This is a persistence test.',
    relatedAssetPaths: ['02-design/architecture/foo.md'],
  });
  assert.equal(res.type, 'agent-work-record');
  const convDir = path.join(workspace, path.dirname(res.path));
  assert.ok(fs.existsSync(path.join(convDir, 'conversation.md')), 'conversation.md exists');
  assert.ok(fs.existsSync(path.join(workspace, res.metadataPath)), 'metadata.json exists');
  const meta = getManagedAssetByPath(res.path);
  assert.ok(meta, 'metadata readable');
  assert.equal(meta!.type, 'agent-work-record');
  assert.equal(meta!.source, 'manual');
  assert.equal(meta!.title, 'Asset Workbench Persistence Test');
  assert.equal(meta!.relatedAssetPaths?.[0], '02-design/architecture/foo.md');
  // no half-written temp leftovers
  assert.equal(fs.readdirSync(convDir).filter((f) => f.startsWith('.awtmp-')).length, 0);
});

test('duplicate conversation path raises conflict', async () => {
  const a = await createConversation({ title: 'Dup Title', source: 'manual', content: 'x' });
  // Force an identical path by reusing the same date+slug directory.
  const dupDir = path.join(workspace, path.dirname(a.path));
  assert.ok(fs.existsSync(dupDir));
  await assert.rejects(() => createConversation({ title: 'Dup Title', source: 'manual', content: 'y' }), ConflictError);
});

test('invalid source rejected', async () => {
  await assert.rejects(
    () => createConversation({ title: 't', source: 'github' as never, content: 'x' }),
    InvalidInputError,
  );
});

// ---------------------------------------------------------------------------
// Promotion chain: conversation -> design -> decision
// ---------------------------------------------------------------------------
test('promote conversation -> design carries source relation', async () => {
  const conv = await createConversation({ title: 'Source Chat', source: 'chatgpt', content: 'discuss' });
  const design = await promoteConversationToDesign(conv.id, {
    title: 'Managed Knowledge Assets',
    designArea: 'architecture',
    content: 'formal design',
  });
  assert.equal(design.type, 'design');
  const dAbs = path.join(workspace, design.path);
  assert.ok(fs.existsSync(dAbs), 'design md exists');
  assert.ok(fs.existsSync(path.join(workspace, design.metadataPath)), 'design metadata exists');

  const dMeta = getManagedAssetByPath(design.path);
  assert.ok(dMeta!.sourceConversations?.includes(conv.id), 'design records source conversation');

  const cMeta = getManagedAssetByPath(conv.path);
  assert.ok(
    cMeta!.promotedTo?.some((p) => p.type === 'design' && p.id === design.id),
    'conversation records promotedTo design',
  );
  // markdown shows the source link
  const md = fs.readFileSync(dAbs, 'utf8');
  assert.ok(md.includes(conv.id), 'design markdown references source conversation id');
});

test('promote design -> decision carries decision number + relations', async () => {
  const conv = await createConversation({ title: 'Chain Chat', source: 'codex', content: 'c' });
  const design = await promoteConversationToDesign(conv.id, {
    title: 'Chain Design',
    designArea: 'product',
    content: 'd',
  });
  const decision = await promoteDesignToDecision(design.id, {
    title: 'Managed Knowledge Assets',
    status: 'Accepted',
    content: 'final ruling',
  });
  assert.equal(decision.type, 'decision');
  // numbering: pre-existing 0001 -> next is 0002
  assert.ok(decision.path.includes('02-design/decisions/0002-'), 'decision numbered 0002');
  const dMeta = getManagedAssetByPath(decision.path);
  assert.equal(dMeta!.status, 'Accepted');
  assert.ok(dMeta!.sourceDesigns?.includes(design.id), 'decision records source design');
  assert.ok(dMeta!.sourceConversations?.includes(conv.id), 'decision inherits source conversation via chain');

  const designMeta = getManagedAssetByPath(design.path);
  assert.ok(
    designMeta!.promotedToDecisions?.includes(decision.id),
    'design records promotedTo decision',
  );
  const md = fs.readFileSync(path.join(workspace, decision.path), 'utf8');
  assert.ok(md.includes(design.id), 'decision markdown references source design id');
});

test('createDecision directly from conversation carries source', async () => {
  const conv = await createConversation({ title: 'Direct Chat', source: 'manual', content: 'c' });
  const decision = await createDecision({
    title: 'Direct Decision',
    status: 'Accepted',
    content: 'ruling',
    sourceConversations: [conv.id],
  });
  const meta = getManagedAssetByPath(decision.path);
  assert.ok(meta!.sourceConversations?.includes(conv.id));
});

test('decision numbering is monotonic and collision-safe', async () => {
  const d1 = await createDecision({ title: 'Num A', content: 'a' });
  const d2 = await createDecision({ title: 'Num B', content: 'b' });
  const n1 = parseInt(path.basename(d1.path).split('-')[0], 10);
  const n2 = parseInt(path.basename(d2.path).split('-')[0], 10);
  assert.equal(n2, n1 + 1, 'sequential numbering');
  assert.ok(n1 >= 2, 'starts after existing 0001');
});

test('unknown promotion source raises not found', async () => {
  await assert.rejects(
    () => promoteConversationToDesign('conv_does_not_exist', { title: 'x', designArea: 'architecture', content: 'y' }),
    (e: Error) => e.message.includes('not found'),
  );
});

// ---------------------------------------------------------------------------
// Invalid design area (path injection attempt)
// ---------------------------------------------------------------------------
test('design area with slash is neutralized, not an escape', async () => {
  const res = await createDesign({ title: 't', designArea: '../../etc', content: 'x' });
  assert.ok(res.path.startsWith('02-design/'), 'resolved under managed area');
  assert.ok(!res.path.includes('..'), 'no parent-dir escape');
  assert.ok(fs.existsSync(path.join(workspace, res.path)), 'real file written');
});
