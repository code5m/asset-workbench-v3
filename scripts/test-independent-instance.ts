import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstance, frameworkIdentity } from '../packages/creator-core/src/index.ts';
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
    assert.equal(forbidden.status, 400);
    assert.equal((await instanceRuntimeStatus(root)).status, 'running');
  } finally {
    if (started) await stopInstanceRuntime(root);
    assert.equal((await instanceRuntimeStatus(root)).status, 'stopped');
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
