import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  discoverEnterpriseWorkspace, freezeEnterpriseWorkspace, verifyEnterpriseSnapshot,
  compareEnterpriseSnapshots, enterpriseStoreFor, listEnterpriseSnapshots,
} from '../server/enterpriseWorkspace.ts';

const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-enterprise-test-'));
const roots = ['phantom-payment', 'phantom-operation', 'group/phantom-iot'];
function git(dir: string, ...args: string[]) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' },
    stdio: ['ignore','pipe','pipe'] }).trim();
}
try {
  for (const rel of roots) {
    const dir = path.join(parent, rel);
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    fs.writeFileSync(path.join(dir, 'module.txt'), rel);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'initial');
  }
  const discovery = discoverEnterpriseWorkspace(parent);
  assert.equal(discovery.repositories.length, 3, 'must include nested Git repos');
  assert.deepEqual(discovery.repositories.map((x) => x.path), [...roots].sort());
  const first = freezeEnterpriseWorkspace(parent);
  assert.equal(first.repositories.length, 3);
  assert.equal(first.snapshotId, freezeEnterpriseWorkspace(parent).snapshotId, 'same SHAs must be idempotent');
  assert.equal(listEnterpriseSnapshots(parent).length, 1);
  assert.equal(verifyEnterpriseSnapshot(parent, first.snapshotId).ok, true);
  const a = path.join(parent, 'phantom-payment');
  fs.writeFileSync(path.join(a, 'module.txt'), 'uncommitted change');
  const dirty = discoverEnterpriseWorkspace(parent).repositories.find((x) => x.path === 'phantom-payment');
  assert.equal(dirty?.dirty, true);
  assert.equal(freezeEnterpriseWorkspace(parent).snapshotId, first.snapshotId, 'dirty file must not change snapshot');
  git(a, 'add', '.');
  git(a, 'commit', '-qm', 'modified');
  const second = freezeEnterpriseWorkspace(parent);
  assert.notEqual(first.snapshotId, second.snapshotId);
  const compare = compareEnterpriseSnapshots(parent, first.snapshotId, second.snapshotId);
  assert.equal(compare.changedRepositories, 1, 'unchanged repositories must not be reanalyzed');
  assert.deepEqual(compare.rows.find((x) => x.path === 'phantom-payment')?.changedFiles, ['module.txt']);
  assert.equal(compare.rows.filter((x) => x.status === 'unchanged').length, 2);
  assert.equal(fs.existsSync(path.join(parent, '.asset-workbench-data')), false, 'business workspace must not receive side effects');
  assert.ok(enterpriseStoreFor(parent).includes('enterprise-workspaces'), 'metadata belongs under central storage');
  assert.throws(() => verifyEnterpriseSnapshot(parent, '../escape'), /Invalid workspace snapshot ID/);
  console.log('ENTERPRISE_WORKSPACE_TEST PASS');
} finally {
  fs.rmSync(parent, { recursive: true, force: true });
}
