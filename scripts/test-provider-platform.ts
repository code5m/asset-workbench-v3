import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { credentialStore } from '../server/credentialStore.ts';
import { deleteCustomDefinition, getProviderDetail, listProviderDefinitions, saveCustomDefinition, setProviderEnabled } from '../server/providerPlatformService.ts';

assert.ok(listProviderDefinitions().some((item) => item.id === 'codex'));
assert.equal(setProviderEnabled('codex', false).status.enabled, false);
assert.equal(setProviderEnabled('codex', true).status.enabled, true);
const fixtureId = `fixture-agent-${process.pid}`;
const credentialProvider = `fixture-secure-${process.pid}`;
try {
  saveCustomDefinition({ schemaVersion: 1, version: '1.0.0', id: fixtureId, displayName: 'Fixture Agent', description: 'test', providerType: 'custom', discovery: {}, auth: { type: 'manual' }, eventSource: { type: 'custom' }, events: {}, finalization: { strategy: 'manual' }, verification: { required: [], requireTranscript: false } });
  assert.equal(getProviderDetail(fixtureId).definition.displayName, 'Fixture Agent');
  saveCustomDefinition({ schemaVersion: 1, version: '1.0.1', id: fixtureId, displayName: 'Updated Fixture Agent', description: 'test', providerType: 'custom', discovery: {}, auth: { type: 'manual' }, eventSource: { type: 'custom' }, events: {}, finalization: { strategy: 'manual' }, verification: { required: [], requireTranscript: false } });
  assert.equal(getProviderDetail(fixtureId).definition.displayName, 'Updated Fixture Agent');
  assert.throws(() => saveCustomDefinition({
    schemaVersion: 1,
    version: '1.0.0',
    id: `fixture-command-${process.pid}`,
    displayName: 'Command Fixture',
    description: 'must be rejected',
    providerType: 'custom',
    discovery: {},
    auth: { type: 'ak-sk', fields: ['A', 'B'], verifyCommand: ['sh', '-c', 'echo unsafe'] },
    eventSource: { type: 'custom' },
    events: {},
    finalization: { strategy: 'manual' },
    verification: { required: [], requireTranscript: false },
  }), /cannot contain executable commands/);
  credentialStore.save(credentialProvider, 'TEST_SECRET', `runtime-${process.pid}-${Date.now()}`);
  assert.equal(credentialStore.has(credentialProvider, 'TEST_SECRET'), true);
  assert.equal(execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/credential-store-probe.ts', credentialProvider, 'TEST_SECRET'], { encoding: 'utf8' }).trim(), 'configured');
  assert.ok(!JSON.stringify(getProviderDetail('codearts')).includes('runtime-'));
  credentialStore.delete(credentialProvider, 'TEST_SECRET');
  assert.equal(credentialStore.has(credentialProvider, 'TEST_SECRET'), false);
} finally {
  credentialStore.delete(credentialProvider, 'TEST_SECRET');
  try { deleteCustomDefinition(fixtureId); } catch { /* fixture was never created */ }
}
console.log('PROVIDER_PLATFORM_TEST PASS');
