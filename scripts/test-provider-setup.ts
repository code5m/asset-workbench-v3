import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setupProjectProviders } from '../server/providerSetup.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-provider-setup-'));
try {
  const custom = path.join(root, '.codebuddy', 'settings.json');
  fs.mkdirSync(path.dirname(custom), { recursive: true });
  fs.writeFileSync(custom, JSON.stringify({ theme: 'personal', hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'echo user-custom-hook' }] }],
  } }));
  const first = setupProjectProviders(root);
  assert.equal(first.length, 4);
  assert.ok(first.every((entry) => entry.status === 'installed'));
  const codebuddy = JSON.parse(fs.readFileSync(custom, 'utf8')) as {
    theme: string; hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
  };
  assert.equal(codebuddy.theme, 'personal');
  assert.equal(codebuddy.hooks.Stop[0].hooks[0].command, 'echo user-custom-hook');
  assert.equal(codebuddy.hooks.Stop.length, 2);
  assert.ok(codebuddy.hooks.SessionEnd[0].hooks[0].command.includes('capture-provider-event.ts'));
  const second = setupProjectProviders(root);
  assert.ok(second.every((entry) => entry.status === 'already-configured'));
  assert.ok(fs.existsSync(path.join(root, '.opencode/plugins/awb-capture.js')));
  // Do not overwrite a user-owned plugin even if the name is identical.
  fs.writeFileSync(path.join(root, '.opencode/plugins/awb-capture.js'), '// user plugin');
  const third = setupProjectProviders(root);
  assert.equal(third.find((row) => row.provider === 'opencode')?.status, 'blocked-existing-config');
  assert.equal(fs.readFileSync(path.join(root, '.opencode/plugins/awb-capture.js'), 'utf8'), '// user plugin');
  console.log('PROVIDER_SETUP_TEST PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
