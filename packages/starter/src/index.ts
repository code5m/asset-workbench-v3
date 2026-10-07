import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ASSET_SKELETON } from '../../asset-core/src/index.ts';

export interface StarterOptions {
  target: string;
  name?: string;
}

export interface StarterResult {
  target: string;
  created: string[];
}

export type KnowledgeEntryKind = 'file' | 'directory';

export interface KnowledgeVerificationCheck {
  path: string;
  kind: KnowledgeEntryKind;
  ok: boolean;
  detail: string;
}

export interface KnowledgeVerificationResult {
  target: string;
  ok: boolean;
  checks: KnowledgeVerificationCheck[];
}

export interface KnowledgeCreateResult extends StarterResult {
  verification: KnowledgeVerificationResult;
}

function ensureEmptyOrMissing(target: string): void {
  if (!fs.existsSync(target)) return;
  const entries = fs.readdirSync(target);
  if (entries.length > 0) {
    throw new Error(`starter target must be empty: ${target}`);
  }
}

function write(target: string, rel: string, content: string, created: string[]): void {
  const abs = path.join(target, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  created.push(rel);
}

function expectedKnowledgeEntries(): Array<{ path: string; kind: KnowledgeEntryKind }> {
  return [
    { path: 'README.md', kind: 'file' },
    { path: 'AGENTS.md', kind: 'file' },
    ...DEFAULT_ASSET_SKELETON.flatMap((entry) => [
      { path: entry.path, kind: 'directory' as const },
      { path: `${entry.path}/README.md`, kind: 'file' as const },
    ]),
    { path: '04-conversations/transcripts', kind: 'directory' },
    { path: '04-conversations/transcripts/README.md', kind: 'file' },
    { path: '04-conversations/work-records', kind: 'directory' },
    { path: '04-conversations/work-records/README.md', kind: 'file' },
    { path: '02-design/decisions', kind: 'directory' },
    { path: '02-design/decisions/README.md', kind: 'file' },
  ];
}

export function createStarter(options: StarterOptions): StarterResult {
  const target = path.resolve(options.target);
  ensureEmptyOrMissing(target);
  fs.mkdirSync(target, { recursive: true });

  const name = options.name?.trim() || path.basename(target);
  const created: string[] = [];

  write(target, 'README.md', `# ${name}

This project uses the Asset Workbench starter skeleton.

- 00-introduction: project entry and context
- 01-code: source repositories and code assets
- 02-design: architecture, design, and decisions
- 03-docs: guides, reports, and project documents
- 04-conversations: original Transcripts and Agent Work Records
- 05-derived: generated indexes, CodeGraph, and analysis

Provider integrations are configured by Asset Workbench and remain separate from the asset skeleton.
`, created);

  write(target, 'AGENTS.md', `# Agent Rules

Preserve the 00–05 asset skeleton. Keep original Transcripts separate from Agent Work Records.
Do not fabricate provider evidence or verification status.
`, created);

  for (const entry of DEFAULT_ASSET_SKELETON) {
    write(
      target,
      `${entry.path}/README.md`,
      `# ${entry.path}

${entry.description}.
`,
      created,
    );
  }

  write(target, '04-conversations/transcripts/README.md', '# Original Transcripts\n\nStore real imported or captured conversation evidence here.\n', created);
  write(target, '04-conversations/work-records/README.md', '# Agent Work Records\n\nStore structured Agent task records here.\n', created);
  write(target, '02-design/decisions/README.md', '# Decisions\n\nAccepted or proposed project decisions live here.\n', created);

  return { target, created };
}

export function verifyKnowledge(targetInput: string): KnowledgeVerificationResult {
  const target = path.resolve(targetInput);
  const checks = expectedKnowledgeEntries().map((entry): KnowledgeVerificationCheck => {
    const absolute = path.join(target, ...entry.path.split('/'));
    let ok = false;
    try {
      const stat = fs.statSync(absolute);
      ok = entry.kind === 'directory' ? stat.isDirectory() : stat.isFile();
    } catch {
      ok = false;
    }
    return {
      path: entry.path,
      kind: entry.kind,
      ok,
      detail: ok ? `${entry.kind} exists` : `missing ${entry.kind}`,
    };
  });

  return {
    target,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export function createKnowledge(options: StarterOptions): KnowledgeCreateResult {
  const created = createStarter(options);
  const verification = verifyKnowledge(created.target);
  if (!verification.ok) {
    throw new Error(`knowledge verification failed: ${created.target}`);
  }
  return { ...created, verification };
}
