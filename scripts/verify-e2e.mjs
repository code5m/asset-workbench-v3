const BASE = process.env.BASE || 'http://localhost:5174';
const ROOT = process.cwd();
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const log = (...a) => console.log(...a);
let failures = 0;
function check(cond, msg) {
  if (cond) log('  ✓', msg);
  else {
    failures += 1;
    log('  ✗', msg);
  }
}

async function jpost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* noop */
  }
  return { status: res.status, data };
}
async function jget(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* noop */
  }
  return { status: res.status, data };
}

async function run() {
  log('Scenario A: create conversation');
  const a = await jpost('/api/managed/conversation', {
    title: 'Asset Workbench Persistence Test',
    source: 'manual',
    content: 'This is a persistence test.',
    relatedAssetPaths: ['02-design/architecture/foo.md'],
  });
  check(a.status === 201, `create conversation -> 201 (got ${a.status})`);
  const convPath = a.data.path;
  const convAbs = resolve(ROOT, convPath);
  check(existsSync(convAbs), `conversation.md real on disk: ${convPath}`);

  log('Scenario A2: GET metadata');
  const ga = await jget('/api/managed/asset?path=' + encodeURIComponent(convPath));
  check(ga.status === 200 && ga.data.metadata.type === 'conversation', 'metadata type=conversation');
  check(ga.data.metadata.source === 'manual', 'source=manual');
  const convId = ga.data.metadata.id;

  log('Scenario E (runtime): invalid source rejected');
  const bad = await jpost('/api/managed/conversation', { title: 'x', source: 'evil', content: 'y' });
  check(bad.status === 400, `invalid source -> 400 (got ${bad.status})`);

  log('Scenario E (runtime): malicious title path neutralized');
  const neu = await jpost('/api/managed/design', {
    title: '../../escape/attempt',
    designArea: '../../etc',
    content: 'y',
  });
  check(neu.status === 201, 'design with injected area created (neutralized)');
  check(neu.data.path.startsWith('02-design/'), `path stays under 02-design: ${neu.data.path}`);
  check(!neu.data.path.includes('..'), 'no parent escape in path');

  log('Scenario B: promote conversation -> design');
  const b = await jpost(`/api/managed/conversation/${encodeURIComponent(convId)}/promote/design`, {
    title: 'Managed Knowledge Assets',
    designArea: 'architecture',
    content: 'formal design body',
  });
  check(b.status === 201, `promote to design -> 201 (got ${b.status})`);
  const designPath = b.data.path;
  check(existsSync(resolve(ROOT, designPath)), `design real on disk: ${designPath}`);
  const gb = await jget('/api/managed/asset?path=' + encodeURIComponent(designPath));
  check(
    gb.data.metadata.sourceConversations?.includes(convId),
    'design metadata records source conversation',
  );
  const designId = gb.data.metadata.id;

  log('Scenario C: promote design -> decision');
  const c = await jpost(`/api/managed/design/${encodeURIComponent(designId)}/promote/decision`, {
    title: 'Managed Knowledge Assets',
    status: 'Accepted',
    content: 'final ruling',
  });
  check(c.status === 201, `promote to decision -> 201 (got ${c.status})`);
  const decisionPath = c.data.path;
  check(decisionPath.includes('02-design/decisions/0002-'), `decision numbered 0002: ${decisionPath}`);
  check(existsSync(resolve(ROOT, decisionPath)), 'decision real on disk');
  // 0001 already exists; ensure 0002 is the new one and created now
  const gc = await jget('/api/managed/asset?path=' + encodeURIComponent(decisionPath));
  check(gc.data.metadata.sourceDesigns?.includes(designId), 'decision metadata records source design');
  check(gc.data.metadata.sourceConversations?.includes(convId), 'decision inherits source conversation');
  const decisionId = gc.data.metadata.id;

  log('Scenario: source conversation sees promotedTo decision (bidirectional)');
  const ga2 = await jget('/api/managed/asset?path=' + encodeURIComponent(convPath));
  check(
    ga2.data.metadata.promotedTo?.some((p) => p.type === 'design' && p.id === designId),
    'conversation promotedTo design',
  );
  const gb2 = await jget('/api/managed/asset?path=' + encodeURIComponent(designPath));
  check(gb2.data.metadata.promotedToDecisions?.includes(decisionId), 'design promotedTo decision');

  log('Scenario F: watcher / autoscan -> tree sees the new asset');
  const treeManual = await jget('/api/workspace/tree?path=' + encodeURIComponent('04-conversations/manual'));
  const dirName = convPath.split('/')[2];
  check(
    treeManual.data?.children?.some((n) => n.relativePath === `04-conversations/manual/${dirName}`),
    'tree contains new conversation directory (auto-discovered)',
  );
  const treeConv = await jget('/api/workspace/tree?path=' + encodeURIComponent(`04-conversations/manual/${dirName}`));
  const convFile = treeConv.data?.children?.find((n) => n.relativePath === convPath);
  check(convFile?.managedType === 'conversation', 'conversation.md classified managedType=conversation');
  const treeDec = await jget('/api/workspace/tree?path=' + encodeURIComponent('02-design/decisions'));
  const decFile = treeDec.data?.children?.find((n) => n.relativePath === decisionPath);
  check(decFile?.managedType === 'decision', 'decision classified managedType=decision (priority)');

  log('Scenario D / persistence: files on disk survive (source of truth)');
  check(
    existsSync(resolve(ROOT, convPath)) &&
      existsSync(resolve(ROOT, designPath)) &&
      existsSync(resolve(ROOT, decisionPath)),
    'all three assets persist on disk',
  );

  log('');
  if (failures === 0) log('E2E RESULT: PASS');
  else log(`E2E RESULT: FAIL (${failures} checks failed)`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
