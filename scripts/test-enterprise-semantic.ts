import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachEnterpriseWorkspaceReadOnly, detachEnterpriseWorkspaceReadOnly,
  enterpriseApiRoot, listAttachedEnterpriseWorkspaces } from '../server/enterpriseAttachment.ts';
import { freezeEnterpriseWorkspace } from '../server/enterpriseWorkspace.ts';
import { importEnterpriseRaw } from '../server/enterpriseImport.ts';
import { buildEnterpriseJavaSymbolGraph } from '../server/enterpriseSemanticJava.ts';
import { buildEnterpriseDynamicSqlLineage } from '../server/enterpriseSqlLineage.ts';
import { proposeEnterpriseAiRefactor, validateEnterpriseAiRefactor } from '../server/enterpriseAiRefactor.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-enterprise-semantic-'));
let attached = '';
function git(dir: string, ...args: string[]) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_COMMITTER_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_EMAIL: 'test@example.com' },
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
try {
  const payment = path.join(root, 'phantom-payment');
  const operation = path.join(root, 'phantom-operation');
  for (const dir of [payment, operation]) { fs.mkdirSync(dir, { recursive: true }); git(dir, 'init', '-q'); }
  fs.mkdirSync(path.join(payment, 'src/main/java/example'), { recursive: true });
  fs.mkdirSync(path.join(operation, 'src/main/java/example'), { recursive: true });
  fs.mkdirSync(path.join(operation, 'src/main/resources/mappers'), { recursive: true });
  fs.writeFileSync(path.join(payment, 'src/main/java/example/Pay.java'),
    'package example; public class Pay { public String pay() { return "ok"; } }\n');
  fs.writeFileSync(path.join(operation, 'src/main/java/example/Operation.java'),
    'package example; public class Operation { public String run() { return new Pay().pay(); } }\n');
  fs.writeFileSync(path.join(operation, 'src/main/resources/mappers/Orders.xml'), `<?xml version="1.0"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="example.Orders">
  <sql id="cols">id, status</sql>
  <select id="list">
    SELECT <include refid="cols"/> FROM orders
    <where><if test="status != null">AND status = #{status}</if></where>
  </select>
  <update id="update">UPDATE orders SET status = #{status} WHERE id = #{id}</update>
</mapper>`);
  for (const dir of [payment, operation]) { git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'initial'); }
  const first = attachEnterpriseWorkspaceReadOnly(root, 'Enterprise Demo');
  attached = first.workspace.workspaceId;
  assert.equal(first.repositoryCount, 2);
  assert.equal(first.sourceFilesModified, false);
  assert.equal(attachEnterpriseWorkspaceReadOnly(root).workspace.workspaceId, attached, 'idempotent attachment');
  assert.equal(enterpriseApiRoot(attached, process.cwd()), fs.realpathSync(root));
  assert.ok(listAttachedEnterpriseWorkspaces().some(w => w.workspaceId === attached));
  assert.throws(() => enterpriseApiRoot('enterprise-' + '0'.repeat(24), process.cwd()), /Unknown/);
  assert.equal(fs.existsSync(path.join(root, '.asset-workbench-data')), false, 'business root must remain untouched');
  for (const dir of [payment, operation]) assert.equal(git(dir, 'status', '--porcelain'), '');

  const snap = freezeEnterpriseWorkspace(root);
  const manifest = importEnterpriseRaw(root, snap.snapshotId, { maxBytes: 1_000_000 });
  assert.equal(manifest.status, 'verified');
  const java = await buildEnterpriseJavaSymbolGraph(root, snap.snapshotId);
  assert.equal(java.engine, 'jdk-compiler-attribution');
  assert.equal(java.indexedJavaFiles, 2);
  assert.ok(java.crossRepositoryEdges >= 1, JSON.stringify(java));
  assert.ok(java.edges.some(e => e.from.includes('example.Operation#run') && e.to.includes('example.Pay#pay')));
  const sql = await buildEnterpriseDynamicSqlLineage(root, snap.snapshotId);
  assert.equal(sql.engine, 'sqlglot-mybatis-symbolic');
  assert.ok(sql.statements.some(s => s.statement.includes('example.Orders.list')
    && s.reads.some(t => t.toLowerCase().includes('orders'))), JSON.stringify(sql.errors));
  assert.ok(sql.statements.some(s => s.writes.some(t => t.toLowerCase().includes('orders'))));
  assert.ok(sql.statements.some(s => s.conditions.some(x => x.includes('status != null'))));
  assert.ok(sql.statements.every(s => s.provenance?.commit));
  await assert.rejects(() => validateEnterpriseAiRefactor(root, '../wrong'), /Invalid proposal ID/);
  // CI does not need production Ollama credentials: stub the *local-only* model
  // response while exercising the real exact-hunk patch and SHA gates.
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify({
    oldText: 'return "ok";', newText: 'return "ok".trim();',
    rationale: 'Test-only benign candidate',
  }) }), { status: 200, headers: { 'content-type': 'application/json' } });
  let proposalId = '';
  try {
    const proposed = await proposeEnterpriseAiRefactor(root, {
      snapshotId: snap.snapshotId, repository: 'phantom-payment',
      path: 'src/main/java/example/Pay.java', model: 'mock-model:1',
    });
    proposalId = proposed.id;
    assert.notEqual(proposed.candidateSha256, proposed.originalSha256);
    assert.equal(proposed.commit, snap.repositories.find(v => v.path === 'phantom-payment')?.commit);
  } finally { globalThis.fetch = savedFetch; }
  const validation = await validateEnterpriseAiRefactor(root, proposalId);
  assert.equal(validation.originalSourceModified, false);
  assert.ok(['blocked', 'rejected', 'verified'].includes(validation.status));
  assert.ok(validation.reason.length > 10);

  for (const dir of [payment, operation]) assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(fs.existsSync(path.join(root, '.asset-workbench-data')), false);
  console.log('ENTERPRISE_SEMANTIC_INTEGRATION PASS');
} finally {
  if (attached) detachEnterpriseWorkspaceReadOnly(attached);
  fs.rmSync(root, { recursive: true, force: true });
}
