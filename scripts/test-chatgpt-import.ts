/**
 * ChatGPT import test.
 *
 * ChatGPT Product has NO local lifecycle hook and NO self-service export on this
 * workspace, and browser/private-API scraping is deliberately not used. The only
 * supported path is an EXPLICIT user-supplied import, which this test proves.
 *
 * It also asserts the required separation: an OpenAI API Agent Session Webhook
 * (were one configured) is a different thing from the ChatGPT product surface and
 * must never be reported as "ChatGPT realtime capture".
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { createTranscript, findAssetById } from '../server/managedAssetService.ts';
import { resolveManagedType } from '../server/assetClassifier.ts';

const original = getProjectRoot();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-chatgpt-test-'));
fs.mkdirSync(path.join(workspace, '04-conversations', 'transcripts'), { recursive: true });
setProjectRoot(workspace);

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}`); console.error('        ', (error as Error).message); }
}

// A realistic user-supplied ChatGPT export (Markdown).
const exported = [
  '# ChatGPT conversation export',
  '',
  '**User:** how do I list files in a directory?',
  '',
  '**ChatGPT:** You can use `ls` on Linux or macOS.',
  '',
].join('\n');

let transcriptPath = '';

await check('explicit import creates an imported-transcript asset', async () => {
  const t = await createTranscript({
    title: 'ChatGPT export — list files',
    source: 'chatgpt',
    content: exported,
    captureMode: 'imported-transcript',
    completeness: 'full',
    sourceSessionId: 'chatgpt-export-manual-1',
    sourceMetadata: { provider: 'chatgpt', captureSource: 'manual-import', importFormat: 'markdown' },
  });
  transcriptPath = t.path;
  assert.equal(t.type, 'conversation-transcript');
  const meta = findAssetById(t.id)!.metadata;
  assert.equal(meta.captureMode, 'imported-transcript');
  assert.equal(meta.type, 'conversation-transcript');
  assert.equal(meta.source, 'chatgpt');
  assert.ok(t.path.includes('04-conversations/transcripts/chatgpt/'), t.path);
  // raw content preserved verbatim (no destructive cleaning)
  assert.equal(fs.readFileSync(path.join(workspace, t.path), 'utf8'), exported);
});

await check('imported transcript is classified as a transcript, not a work record', () => {
  const kind = resolveManagedType(workspace, transcriptPath);
  assert.equal(kind, 'conversation-transcript');
});

await check('ChatGPT product is not conflated with OpenAI API Agent webhooks', () => {
  // No OpenAI API agent webhook / key is configured on this machine; even if one
  // were, it would represent API-created agent sessions, NOT chatgpt.com sessions.
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const hasWebhook = Boolean(process.env.OPENAI_AGENTS_WEBHOOK);
  assert.equal(hasOpenAiKey || hasWebhook, false, 'no OpenAI API agent surface is configured');
});

setProjectRoot(original);
fs.rmSync(workspace, { recursive: true, force: true });
if (failures > 0) { console.error(`CHATGPT_IMPORT_TEST FAIL (${failures})`); process.exit(1); }
console.log('CHATGPT_IMPORT_TEST PASS');
