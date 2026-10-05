import fs from 'node:fs';
import path from 'node:path';

const PROVIDERS = new Set(['chatgpt', 'codex', 'codebuddy', 'opencode', 'trae', 'codearts', 'workbuddy', 'manual', 'other']);

export interface ConversationIaMigrationResult {
  movedWorkRecordEntries: number;
  movedTranscriptEntries: number;
  rewrittenMetadataFiles: number;
  skipped: string[];
}

function replacePath(value: unknown, replacements: Array<[string, string]>): unknown {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of replacements) {
      if (out === from || out.startsWith(from + '/')) out = to + out.slice(from.length);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => replacePath(item, replacements));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = replacePath(item, replacements);
    return out;
  }
  return value;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function moveEntry(from: string, to: string, skipped: string[]): boolean {
  if (!fs.existsSync(from)) return false;
  if (fs.existsSync(to)) {
    skipped.push(`destination exists: ${to}`);
    return false;
  }
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  return true;
}

function walkMetadata(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile() && entry.name.endsWith('metadata.json')) out.push(abs);
    }
  };
  visit(path.join(root, '04-conversations'));
  visit(path.join(root, '02-design'));
  return out;
}

export function migrateConversationIaV2(root: string): ConversationIaMigrationResult {
  const conversations = path.join(root, '04-conversations');
  ensureDir(path.join(conversations, 'transcripts'));
  ensureDir(path.join(conversations, 'work-records'));

  const result: ConversationIaMigrationResult = {
    movedWorkRecordEntries: 0,
    movedTranscriptEntries: 0,
    rewrittenMetadataFiles: 0,
    skipped: [],
  };
  const replacements: Array<[string, string]> = [];

  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(conversations, { withFileTypes: true }); } catch { return result; }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'transcripts' || entry.name === 'work-records') continue;
    if (!PROVIDERS.has(entry.name)) continue;
    const fromRel = `04-conversations/${entry.name}`;
    const toRel = `04-conversations/work-records/${entry.name}`;
    const sourceDir = path.join(root, fromRel);
    const targetDir = path.join(root, toRel);
    ensureDir(targetDir);
    for (const child of fs.readdirSync(sourceDir)) {
      if (moveEntry(path.join(sourceDir, child), path.join(targetDir, child), result.skipped)) result.movedWorkRecordEntries += 1;
    }
    try { if (fs.readdirSync(sourceDir).length === 0) fs.rmdirSync(sourceDir); } catch { /* best effort */ }
    replacements.push([fromRel, toRel]);
  }

  const transcriptRoot = path.join(conversations, 'transcripts');
  const scanTranscriptProvider = (providerDir: string) => {
    let children: fs.Dirent[] = [];
    try { children = fs.readdirSync(providerDir, { withFileTypes: true }); } catch { return; }
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const dir = path.join(providerDir, child.name);
      const metaFile = path.join(dir, 'metadata.json');
      let meta: any;
      try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { continue; }
      const providerFromMeta = typeof meta?.sourceMetadata?.provider === 'string' ? meta.sourceMetadata.provider : undefined;
      const source = typeof meta?.source === 'string' ? meta.source : undefined;
      const desired = PROVIDERS.has(source) && source !== 'other'
        ? source
        : providerFromMeta && PROVIDERS.has(providerFromMeta) && providerFromMeta !== 'other'
          ? providerFromMeta
          : undefined;
      if (!desired) continue;
      const currentProvider = path.basename(providerDir);
      if (currentProvider === desired) continue;
      const target = path.join(transcriptRoot, desired, child.name);
      if (moveEntry(dir, target, result.skipped)) {
        result.movedTranscriptEntries += 1;
        const oldRel = `04-conversations/transcripts/${currentProvider}/${child.name}`;
        const newRel = `04-conversations/transcripts/${desired}/${child.name}`;
        replacements.push([oldRel, newRel]);
        const movedMeta = path.join(target, 'metadata.json');
        try {
          const next = JSON.parse(fs.readFileSync(movedMeta, 'utf8'));
          if (next.source === 'other') next.source = desired;
          fs.writeFileSync(movedMeta, JSON.stringify(next, null, 2) + '\n', 'utf8');
        } catch { /* leave original metadata if unreadable */ }
      }
    }
  };
  for (const entry of fs.readdirSync(transcriptRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) scanTranscriptProvider(path.join(transcriptRoot, entry.name));
  }

  for (const file of walkMetadata(root)) {
    try {
      const before = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(before);
      const next = replacePath(parsed, replacements);
      const after = JSON.stringify(next, null, 2) + '\n';
      if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        result.rewrittenMetadataFiles += 1;
      }
    } catch { /* legacy metadata can remain untouched */ }
  }

  return result;
}
