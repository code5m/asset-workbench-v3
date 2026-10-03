/**
 * Transcript vs Agent Work Record — dual-evidence model test.
 *
 * Exercises the five required scenarios:
 *   A: full transcript available (test adapter) -> both assets + session links
 *   B: no transcript (unavailable)             -> work record only, verify PASS
 *   C: imported transcript                     -> imported-transcript asset
 *   D: fake full-transcript (work record mislabeled) -> verify FAIL
 *   E: old data (legacy type='conversation')   -> classified as agent-work-record
 *
 * Runs against a temporary copy of the project root so it never pollutes real
 * managed assets.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { createSession, readSession, updateSession } from '../server/agentSessionService.ts';
import { runClosure, verifyKnowledgeCapture } from '../server/knowledgeCaptureService.ts';
import { createTranscript, findAssetById, patchAssetMetadataById } from '../server/managedAssetService.ts';
import { resolveManagedType } from '../server/assetClassifier.ts';

const ROOT = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-transcript-test-'));

function copyRecursive(src: string, dest: string) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    if (entry.name === '.asset-workbench-data') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

try {
  copyRecursive(ROOT, workspace);
} catch (e) {
  console.error('workspace copy failed', e);
  process.exit(1);
}

// Point the engine at the temp workspace (mirrors scripts/test-agent-knowledge-capture.ts).
setProjectRoot(workspace);

function relToAbs(rel: string): string {
  return path.join(workspace, rel);
}

function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(relToAbs(rel), 'utf8'));
}

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}`);
    console.error('        ', (e as Error).message);
    process.exitCode = 1;
  }
}

function openSession(agentType: string): string {
  return createSession({ agentType, title: 'transcript-test' }).session.id;
}

async function closeSession(sessionId: string, input: any): Promise<any> {
  return runClosure(sessionId, input);
}

async function main() {
  // -------------------------------------------------------------------------
  console.log('\n[scenario A] full transcript available -> both assets + links');
  await check('A: closure with transcript override creates Transcript + Work Record', async () => {
    const sid = openSession('codebuddy');
    const res = await closeSession(sid, {
      taskTitle: 'A-full-transcript',
      summary: 's',
      investigation: 'i',
      findings: 'f',
      changes: ['c'],
      verification: ['v'],
      outcome: 'o',
      captureConversation: true,
      transcript: {
        content: 'User: hello\nAssistant: hi there, how can I help?',
        completeness: 'full',
      },
    });
    assert.ok(res.transcript, 'transcript asset produced');
    assert.ok(res.conversation, 'work record produced');
    assert.equal(res.session.transcriptAssetId, res.transcript!.id);
    assert.equal(res.session.workRecordAssetId, res.conversation!.id);
    assert.equal(res.session.transcriptCaptureStatus, 'available');
    // transcript file on disk
    assert.ok(fs.existsSync(relToAbs(res.transcript!.path)), 'transcript.md on disk');
    assert.ok(fs.existsSync(relToAbs(res.transcript!.metadataPath)), 'transcript metadata on disk');
    const tmeta = readJson(res.transcript!.metadataPath);
    assert.equal(tmeta.type, 'conversation-transcript');
    assert.equal(tmeta.captureMode, 'full-transcript');
    assert.equal(tmeta.workRecordId, res.conversation!.id, 'transcript links back to work record');
    const wmeta = readJson(res.conversation!.metadataPath);
    assert.equal(wmeta.type, 'agent-work-record');
    assert.equal(wmeta.captureMode, 'agent-work-record');
    assert.equal(wmeta.sourceTranscriptId, res.transcript!.id, 'work record links to transcript');
    // both linked by the same session -> consistent
    const issues = verifyKnowledgeCapture(sid);
    assert.equal(issues.ok, true, `verify should pass, got: ${JSON.stringify(issues.issues)}`);
  });

  // -------------------------------------------------------------------------
  console.log('\n[scenario B] no transcript (unavailable) -> work record only, verify PASS');
  await check('B: closure without transcript override still passes the gate', async () => {
    const sid = openSession('codebuddy');
    const res = await closeSession(sid, {
      taskTitle: 'B-no-transcript',
      summary: 's',
      investigation: 'i',
      findings: 'f',
      changes: ['c'],
      verification: ['v'],
      outcome: 'o',
      captureConversation: true,
    });
    assert.equal(res.transcript, undefined, 'no transcript asset');
    assert.ok(res.conversation, 'work record still produced');
    assert.equal(res.session.transcriptCaptureStatus, 'unavailable', 'honest unavailable state');
    assert.equal(res.session.transcriptAssetId, undefined);
    const issues = verifyKnowledgeCapture(sid);
    assert.equal(issues.ok, true, `verify should pass, got: ${JSON.stringify(issues.issues)}`);
  });

  // -------------------------------------------------------------------------
  console.log('\n[scenario C] imported transcript -> imported-transcript asset');
  await check('C: imported transcript carries captureMode=imported-transcript and links session', async () => {
    const sid = openSession('chatgpt');
    // Produce the structured Work Record first (always required).
    const res = await closeSession(sid, {
      taskTitle: 'C-imported-host',
      summary: 's',
      investigation: 'i',
      captureConversation: true,
    });
    assert.ok(res.conversation, 'host work record produced');
    const t = await createTranscript({
      title: 'C-imported',
      source: 'chatgpt',
      content: 'User: export please\nAssistant: here is your chat export.',
      captureMode: 'imported-transcript',
      sourceSessionId: 'imported-session-xyz',
      agentSessionId: sid,
    });
    patchAssetMetadataById(res.conversation!.id, { sourceTranscriptId: t.id });
    patchAssetMetadataById(t.id, { workRecordId: res.conversation!.id });
    const meta = readJson(t.metadataPath);
    assert.equal(meta.type, 'conversation-transcript');
    assert.equal(meta.captureMode, 'imported-transcript');
    assert.equal(meta.source, 'chatgpt');
    assert.equal(meta.completeness, 'full');
    assert.equal(meta.agentSessionId, sid);
    // imported transcripts live under transcripts/imported/
    assert.ok(t.path.includes('/transcripts/imported/'), `expected imported path, got ${t.path}`);
    assert.ok(fs.existsSync(relToAbs(t.path)), 'imported transcript on disk');
    // Wire the session and verify the gate accepts the imported transcript.
    updateSession(sid, {
      captureStatus: 'captured',
      closureStatus: 'closed',
      completedAt: new Date().toISOString(),
      workRecordAssetId: res.conversation!.id,
      transcriptAssetId: t.id,
      transcriptCaptureStatus: 'imported',
    });
    const issues = verifyKnowledgeCapture(sid);
    assert.equal(issues.ok, true, `imported transcript should pass the gate: ${JSON.stringify(issues.issues)}`);
    assert.ok(
      !issues.issues.some((i) => i.includes('transcript') && i.includes('not found')),
      'imported transcript should be found',
    );
  });

  // -------------------------------------------------------------------------
  console.log('\n[scenario D] fake full-transcript (work record mislabeled) -> verify FAIL');
  await check('D: work record labeled full-transcript fails the gate', async () => {
    const sid = openSession('codebuddy');
    const res = await closeSession(sid, {
      taskTitle: 'D-fake',
      summary: 's',
      investigation: 'i',
      findings: 'f',
      changes: ['c'],
      verification: ['v'],
      outcome: 'o',
      captureConversation: true,
    });
    // Corrupt: relabel the work record as a full transcript (forbidden).
    patchAssetMetadataById(res.conversation!.id, { captureMode: 'full-transcript' } as any);
    updateSession(sid, {
      captureStatus: 'captured',
      closureStatus: 'closed',
      completedAt: new Date().toISOString(),
      workRecordAssetId: res.conversation!.id,
      transcriptCaptureStatus: 'unavailable',
    });
    const issues = verifyKnowledgeCapture(sid);
    assert.equal(issues.ok, false, 'gate must reject a work record mislabeled as full-transcript');
    assert.ok(
      issues.issues.some((i) => i.includes('mislabeled as full-transcript')),
      `expected mislabel issue, got: ${JSON.stringify(issues.issues)}`,
    );
  });

  // -------------------------------------------------------------------------
  console.log('\n[scenario E] old data (legacy type=conversation) -> agent-work-record');
  await check('E: legacy conversation.md classified as Agent Work Record, not full chat', () => {
    // Write a legacy asset exactly like the pre-dual-model format.
    const dir = '04-conversations/codebuddy/2026-09-29-legacy-verify';
    fs.mkdirSync(relToAbs(dir), { recursive: true });
    fs.writeFileSync(relToAbs(`${dir}/conversation.md`), '# Task\nold work record\n');
    fs.writeFileSync(
      relToAbs(`${dir}/metadata.json`),
      JSON.stringify({
        schemaVersion: 1,
        id: 'conv_legacy_001',
        type: 'conversation',
        title: 'legacy verify',
        source: 'codebuddy',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        captureMode: 'agent-work-record',
        relatedAssetPaths: [],
        promotedTo: [],
      }),
    );
    const mt = resolveManagedType(workspace, `${dir}/conversation.md`);
    assert.equal(mt, 'agent-work-record', 'legacy asset must classify as agent-work-record');
    const found = findAssetById('conv_legacy_001');
    assert.ok(found, 'legacy asset discoverable by engine');
    assert.equal(found!.metadata.type, 'conversation');
  });

  // -------------------------------------------------------------------------
  console.log(`\nTranscript model tests: ${passed} checks executed.`);
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    // ignore
  }
  if (process.exitCode === 1) {
    console.error('TRANSCRIPT_MODEL: FAIL');
  } else {
    console.log('TRANSCRIPT_MODEL: PASS');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
