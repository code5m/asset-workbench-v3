import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstance, frameworkIdentity } from '../packages/creator-core/src/index.ts';
import { publishFrameworkRelease } from '../server/frameworkRelease.ts';
import { loadConfig } from '../server/config.ts';
import { instanceRuntimeStatus, startInstanceRuntime, stopInstanceRuntime } from '../server/instanceRuntimeManager.ts';

test('separate process gets one pinned business project, shares V3 UI, then stops', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-independent-'));
  const root = path.join(parent, 'payment-business');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'pom.xml'), '<project/>\n');
  const cfg = loadConfig();
  const created = createInstance({
    projectRoot: root, frameworkRoot: cfg.appRoot,
    framework: frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision),
  });
  await publishFrameworkRelease();
  let started = false;
  try {
    const before = await instanceRuntimeStatus(root);
    assert.equal(before.status, 'stopped');
    const result = await startInstanceRuntime(root);
    started = true;
    assert.equal(result.status, 'running');
    assert.equal(result.instanceId, created.manifest.instanceId);
    assert.ok(result.url?.startsWith('http://127.0.0.1:'));
    const configResponse = await fetch(new URL('api/config', result.url!));
    assert.equal(configResponse.status, 200);
    const identity = await configResponse.json() as Record<string, unknown>;
    assert.equal(identity.projectRoot, root);
    assert.equal(identity.instanceId, created.manifest.instanceId);
    assert.equal(identity.lockedToInstance, true);
    assert.equal(identity.configurable, false);
    const html = await fetch(result.url!);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /<div id="root"><\/div>/);
    const forbidden = await fetch(new URL('api/workspace/root', result.url!), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath: parent }),
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await instanceRuntimeStatus(root)).status, 'running');
  } finally {
    if (started) await stopInstanceRuntime(root);
    assert.equal((await instanceRuntimeStatus(root)).status, 'stopped');
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('two running instances keep independent project identities and runtime health credentials', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-dual-runtime-'));
  const a = path.join(parent, 'project-a');
  const b = path.join(parent, 'project-b');
  const cfg = loadConfig();
  const identity = frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision);
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(a, 'pom.xml'), '<project>a</project>');
  fs.writeFileSync(path.join(b, 'package.json'), '{"name":"b"}');
  const originalA = fs.readFileSync(path.join(a, 'pom.xml'), 'utf8');
  const originalB = fs.readFileSync(path.join(b, 'package.json'), 'utf8');
  const first = createInstance({ projectRoot: a, framework: identity, frameworkRoot: cfg.appRoot });
  const second = createInstance({ projectRoot: b, framework: identity, frameworkRoot: cfg.appRoot });
  try {
    const runningA = await startInstanceRuntime(a);
    const runningB = await startInstanceRuntime(b);
    assert.equal(runningA.status, 'running');
    assert.equal(runningB.status, 'running');
    assert.notEqual(runningA.port, runningB.port);
    assert.notEqual(runningA.pid, runningB.pid);
    for (const [running, expected] of [[runningA, first.manifest], [runningB, second.manifest]] as const) {
      const res = await fetch(new URL('api/config', running.url!));
      assert.equal(res.status, 200);
      const info = await res.json() as { projectRoot: string; instanceId: string };
      assert.equal(info.projectRoot, expected.projectRoot);
      assert.equal(info.instanceId, expected.instanceId);
      const health = await fetch(new URL('_runtime/health', running.url!));
      assert.equal(health.status, 403);
      const blocked = await fetch(new URL('api/creator/instance/create', running.url!), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectRoot: parent }),
      });
      assert.equal(blocked.status, 403);
    }
    assert.equal(fs.readFileSync(path.join(a, 'pom.xml'), 'utf8'), originalA);
    assert.equal(fs.readFileSync(path.join(b, 'package.json'), 'utf8'), originalB);
  } finally {
    for (const root of [a,b]) {
      try { await stopInstanceRuntime(root); } catch { /* continue cleanup */ }
    }
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
