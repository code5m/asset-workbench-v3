import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isLoopbackAddress, isLocalApiRequest, MAX_API_BODY_BYTES } from '../server/localApiSecurity.ts';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { getManagedAssetByPath } from '../server/managedAssetService.ts';

assert.equal(isLoopbackAddress('127.0.0.1'), true);
assert.equal(isLoopbackAddress('127.42.1.9'), true);
assert.equal(isLoopbackAddress('::1'), true);
assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
assert.equal(isLoopbackAddress('0.0.0.0'), false);
assert.equal(isLoopbackAddress('192.168.1.10'), false);
assert.equal(isLoopbackAddress('::ffff:192.168.1.10'), false);
assert.equal(MAX_API_BODY_BYTES, 1024 * 1024);

const original = getProjectRoot();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-root-security-'));
const file = path.join(temp, 'not-a-directory');
fs.writeFileSync(file, 'x', 'utf8');
try {
  assert.throws(() => setProjectRoot(file), /not a directory/);
} finally {
  setProjectRoot(original);
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('SECURITY_BOUNDARIES_TEST PASS');

assert.equal(isLocalApiRequest({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:5173' } }), true);
assert.equal(isLocalApiRequest({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'evil.example:5173' } }), false);
assert.equal(isLocalApiRequest({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:5173', origin: 'https://evil.example' } }), false);
assert.equal(isLocalApiRequest({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' } }), true);

const safeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-metadata-boundary-'));
try {
  setProjectRoot(safeRoot);
  assert.throws(() => getManagedAssetByPath('../secret.md'), /path escapes project root/);
  assert.throws(() => getManagedAssetByPath('README.md'), /path escapes project root/);
  assert.equal(getManagedAssetByPath('04-conversations/transcripts/missing/transcript.md'), null);
} finally {
  setProjectRoot(original);
  fs.rmSync(safeRoot, { recursive: true, force: true });
}
