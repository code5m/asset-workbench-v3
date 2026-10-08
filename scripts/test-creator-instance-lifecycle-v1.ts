import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  applyInstanceUpgrade,
  createInstance,
  frameworkIdentity,
  instanceStatus,
  planInstanceUpgrade,
  readInstanceManifest,
  rollbackInstance,
  verifyInstance,
  type FrameworkIdentity,
} from '../packages/creator-core/src/index.ts';

function tempProject(prefix: string): { parent: string; project: string; frameworkRoot: string } {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const project = path.join(parent, 'business-project');
  const frameworkRoot = path.join(parent, 'framework-self');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(frameworkRoot, { recursive: true });
  fs.writeFileSync(path.join(project, 'pom.xml'), '<project/>\n', 'utf8');
  return { parent, project, frameworkRoot };
}

test('Instance Creator writes a versioned manifest without rewriting business code', () => {
  const { parent, project, frameworkRoot } = tempProject('awb-instance-create-');
  try {
    const before = fs.readFileSync(path.join(project, 'pom.xml'), 'utf8');
    const result = createInstance({
      projectRoot: project,
      name: 'payment-service',
      framework: frameworkIdentity('0.1.0', 'abc1234'),
      frameworkRoot,
    });

    assert.equal(result.manifest.projectName, 'payment-service');
    assert.equal(result.manifest.framework.version, '0.1.0');
    assert.equal(result.manifest.framework.revision, 'abc1234');
    assert.equal(result.manifest.generation, 1);
    assert.equal(result.manifest.state, 'ready');
    assert.equal(result.manifest.knowledge.verified, false);
    assert.ok(fs.existsSync(path.join(project, '.asset-workbench-data', 'instance', 'manifest.json')));
    assert.equal(fs.readFileSync(path.join(project, 'pom.xml'), 'utf8'), before);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('Instance Creator refuses Framework Self as an Instance target', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-instance-self-'));
  try {
    assert.throws(() => createInstance({
      projectRoot: parent,
      frameworkRoot: parent,
      framework: frameworkIdentity('0.1.0', 'abc1234'),
    }), /external business project/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('Instance lifecycle plans, applies, verifies, records evidence, and rolls back', () => {
  const { parent, project, frameworkRoot } = tempProject('awb-instance-life-');
  try {
    const current = frameworkIdentity('0.1.0', 'rev-a');
    const created = createInstance({ projectRoot: project, framework: current, frameworkRoot });
    assert.equal(verifyInstance(project, current).upToDate, true);

    const target: FrameworkIdentity = {
      version: '0.2.0',
      revision: 'rev-b',
      capabilities: {
        knowledge: '1.0.0',
        instance: '1.0.0',
        upgrade: '1.1.0',
        migration: '1.0.0',
      },
    };

    const plan = planInstanceUpgrade(project, target);
    assert.equal(plan.status, 'ready');
    assert.ok(plan.actions.some((action) => action.kind === 'framework-version'));
    assert.ok(plan.actions.some((action) => action.kind === 'framework-revision'));
    assert.ok(plan.actions.some((action) => action.capability === 'upgrade'));

    const applied = applyInstanceUpgrade(project, plan.planId);
    assert.equal(applied.applied, true);
    assert.equal(applied.manifest.generation, 2);
    assert.equal(applied.manifest.framework.version, '0.2.0');
    assert.equal(applied.migration?.status, 'applied');
    assert.ok(applied.migration && fs.existsSync(applied.migration.backupPath));

    const verified = verifyInstance(project, target);
    assert.equal(verified.ok, true);
    assert.equal(verified.upToDate, true);

    const status = instanceStatus(project, target);
    assert.equal(status.latestMigration?.status, 'applied');

    const rolledBack = rollbackInstance(project, applied.migration?.migrationId);
    assert.equal(rolledBack.status, 'rolled-back');
    const restored = readInstanceManifest(project);
    assert.equal(restored?.generation, created.manifest.generation);
    assert.equal(restored?.framework.version, '0.1.0');
    assert.equal(fs.readFileSync(path.join(project, 'pom.xml'), 'utf8'), '<project/>\n');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('Upgrade plan detects no-op when Instance already matches Framework', () => {
  const { parent, project, frameworkRoot } = tempProject('awb-instance-noop-');
  try {
    const current = frameworkIdentity('0.1.0', 'same-rev');
    createInstance({ projectRoot: project, framework: current, frameworkRoot });
    const plan = planInstanceUpgrade(project, current);
    assert.equal(plan.status, 'noop');
    assert.equal(plan.actions.length, 0);
    const result = applyInstanceUpgrade(project, plan.planId);
    assert.equal(result.applied, false);
    assert.equal(result.migration, null);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('Creator CLI performs Instance create, plan, apply, verify and rollback E2E', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-instance-cli-'));
  const project = path.join(parent, 'business-project');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"business"}\n', 'utf8');

  const run = (args: string[]) => execFileSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/creator-cli.ts',
    ...args,
  ], { cwd: process.cwd(), encoding: 'utf8' });

  try {
    const created = JSON.parse(run([
      'instance', 'create',
      '--project', project,
      '--name', 'business',
      '--framework-version', '0.1.0',
      '--framework-revision', 'rev-a',
    ])) as { command: string; manifest: { generation: number } };
    assert.equal(created.command, 'creator instance create');
    assert.equal(created.manifest.generation, 1);

    const planned = JSON.parse(run([
      'instance', 'upgrade-plan',
      '--project', project,
      '--framework-version', '0.2.0',
      '--framework-revision', 'rev-b',
    ])) as { planId: string; actions: unknown[] };
    assert.ok(planned.planId);
    assert.ok(planned.actions.length >= 2);

    const applied = JSON.parse(run([
      'instance', 'upgrade-apply',
      '--project', project,
      '--plan', planned.planId,
    ])) as { applied: boolean; migration: { migrationId: string } };
    assert.equal(applied.applied, true);
    assert.ok(applied.migration.migrationId);

    const verified = JSON.parse(run([
      'instance', 'verify',
      '--project', project,
      '--framework-version', '0.2.0',
      '--framework-revision', 'rev-b',
    ])) as { ok: boolean; upToDate: boolean };
    assert.equal(verified.ok, true);
    assert.equal(verified.upToDate, true);

    const rolledBack = JSON.parse(run([
      'instance', 'rollback',
      '--project', project,
      '--migration', applied.migration.migrationId,
    ])) as { status: string };
    assert.equal(rolledBack.status, 'rolled-back');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
