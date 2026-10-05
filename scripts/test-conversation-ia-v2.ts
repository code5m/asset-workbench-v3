import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateConversationIaV2 } from '../server/conversationIaMigration.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-conv-ia-v2-'));
try {
  fs.mkdirSync(path.join(root, '04-conversations/codex/2026-10-05-task'), { recursive: true });
  fs.writeFileSync(path.join(root, '04-conversations/codex/2026-10-05-task/conversation.md'), '# work\n', 'utf8');
  fs.writeFileSync(path.join(root, '04-conversations/codex/2026-10-05-task/metadata.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'conv_keep_me',
    type: 'agent-work-record',
    source: 'codex',
    relatedAssetPaths: ['04-conversations/codex/2026-10-05-task/conversation.md'],
  }, null, 2), 'utf8');

  fs.mkdirSync(path.join(root, '04-conversations/transcripts/other/2026-10-05-opencode'), { recursive: true });
  fs.writeFileSync(path.join(root, '04-conversations/transcripts/other/2026-10-05-opencode/transcript.md'), '# 原始中文\n', 'utf8');
  fs.writeFileSync(path.join(root, '04-conversations/transcripts/other/2026-10-05-opencode/metadata.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'transcript_keep_me',
    type: 'conversation-transcript',
    source: 'other',
    sourceMetadata: { provider: 'opencode' },
    relatedAssetPaths: [],
  }, null, 2), 'utf8');

  const first = migrateConversationIaV2(root);
  assert.equal(first.movedWorkRecordEntries, 1);
  assert.equal(first.movedTranscriptEntries, 1);
  assert.ok(fs.existsSync(path.join(root, '04-conversations/work-records/codex/2026-10-05-task/conversation.md')));
  assert.ok(fs.existsSync(path.join(root, '04-conversations/transcripts/opencode/2026-10-05-opencode/transcript.md')));

  const workMeta = JSON.parse(fs.readFileSync(path.join(root, '04-conversations/work-records/codex/2026-10-05-task/metadata.json'), 'utf8'));
  assert.equal(workMeta.id, 'conv_keep_me');
  assert.equal(workMeta.relatedAssetPaths[0], '04-conversations/work-records/codex/2026-10-05-task/conversation.md');

  const transcriptMeta = JSON.parse(fs.readFileSync(path.join(root, '04-conversations/transcripts/opencode/2026-10-05-opencode/metadata.json'), 'utf8'));
  assert.equal(transcriptMeta.id, 'transcript_keep_me');
  assert.equal(transcriptMeta.source, 'opencode');

  const second = migrateConversationIaV2(root);
  assert.equal(second.movedWorkRecordEntries, 0);
  assert.equal(second.movedTranscriptEntries, 0);
  console.log('CONVERSATION_IA_V2_MIGRATION_TEST PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
