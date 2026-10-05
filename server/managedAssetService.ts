import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProjectRoot } from './config.ts';
import { assertManagedWritable } from './managedPathPolicy.ts';
import { assetService } from './assetService.ts';
import { writeDirDurableAtomic, writeFileDurableAtomic, writePairDurableAtomic } from './durableWrite.ts';
import type {
  CaptureMode,
  ConversationSource,
  DecisionStatus,
  ManagedAssetMetadata,
  ManagedAssetResult,
  ManagedAssetType,
  TranscriptCompleteness,
  TranscriptCaptureStatus,
} from '../src/domain/asset';

/**
 * Managed Knowledge Asset persistence.
 *
 * Conversation / Design / Decision are created as REAL files on disk
 * (Markdown content + a JSON sidecar holding the canonical machine relations).
 * After a write we trigger the AssetService re-scan so the single source of
 * truth (the filesystem) flows back into the asset tree — we never push a
 * second copy of the node into the React state.
 */

// ---------------------------------------------------------------------------
// Errors mapped to HTTP status codes by the API layer
// ---------------------------------------------------------------------------

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteError';
  }
}

// ---------------------------------------------------------------------------
// Input / result contracts
// ---------------------------------------------------------------------------

export interface CreateConversationInput {
  title: string;
  source: ConversationSource;
  content: string;
  relatedAssetPaths?: string[];
  captureMode?: CaptureMode;
  /** the AgentSession that produced this work record */
  agentSessionId?: string;
  /** id of the associated original Transcript, if one exists */
  sourceTranscriptId?: string;
  /** explicit status of original Transcript acquisition */
  transcriptCaptureStatus?: TranscriptCaptureStatus;
}
export interface CreateDesignInput {
  title: string;
  designArea: string;
  content: string;
  sourceConversations?: string[];
  relatedAssetPaths?: string[];
}
export interface CreateDecisionInput {
  title: string;
  status?: DecisionStatus;
  content: string;
  sourceConversations?: string[];
  sourceDesigns?: string[];
  relatedAssetPaths?: string[];
}
const SOURCE_DIR: Record<ConversationSource, string> = {
  chatgpt: 'chatgpt',
  codex: 'codex',
  codebuddy: 'codebuddy',
  opencode: 'opencode',
  trae: 'trae',
  codearts: 'codearts',
  workbuddy: 'workbuddy',
  manual: 'manual',
  other: 'other',
};

/** Sub-directory segment used for imported transcripts (transcripts/imported/...). */
export const IMPORTED_TRANSCRIPT_SEGMENT = 'imported';

const VALID_SOURCES = new Set(Object.keys(SOURCE_DIR));
const DECISION_STATUSES: DecisionStatus[] = ['Accepted', 'Proposed', 'Superseded', 'Deprecated'];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function dateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Safe ASCII slug; no path characters, no拼音 dependency. */
export function slugifyTitle(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (ascii) return ascii;
  const fingerprint = crypto.createHash('sha256').update(title.normalize('NFC')).digest('hex').slice(0, 10);
  return `asset-${fingerprint}`;
}

function relToAbs(root: string, rel: string): string {
  return path.join(root, ...rel.split('/').filter(Boolean));
}

/**
 * Sidecar metadata path for a given content relative path.
 * - conversation directory: sibling `metadata.json`
 * - design/decision file: `<stem>.metadata.json`
 */
export function metadataRelForContent(contentRel: string): string {
  const dir = path.posix.dirname(contentRel);
  const base = path.posix.basename(contentRel);
  // Both managed conversation assets keep their sidecar as `metadata.json`:
  //   conversation.md (Agent Work Record) and transcript.md (Transcript).
  if (base === 'conversation.md' || base === 'transcript.md') return path.posix.join(dir, 'metadata.json');
  const stem = base.replace(/\.md$/i, '');
  return path.posix.join(dir, `${stem}.metadata.json`);
}

function readMetadata(root: string, contentRel: string): ManagedAssetMetadata | null {
  const metaRel = metadataRelForContent(contentRel);
  try {
    return JSON.parse(fs.readFileSync(relToAbs(root, metaRel), 'utf8')) as ManagedAssetMetadata;
  } catch {
    return null;
  }
}

export const writeFileAtomic = writeFileDurableAtomic;
const writeDirAtomic = writeDirDurableAtomic;

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function afterWrite(): Promise<void> {
  // Refresh the single source of truth before returning. The watcher will also
  // fire (SSE -> UI), but awaiting the re-scan here guarantees the tree reflects
  // the new file immediately, with no second-truth copy in the React state.
  try {
    await assetService.scan();
  } catch {
    // best effort; the filesystem is still the source of truth
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertTitle(title: unknown): string {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new InvalidInputError('title is required');
  }
  if (title.length > 200) throw new InvalidInputError('title too long');
  return title.trim();
}

function assertContent(content: unknown): string {
  if (typeof content !== 'string') throw new InvalidInputError('content must be a string');
  if (content.length === 0) throw new InvalidInputError('content is required');
  return content;
}

function normalizeSource(source: unknown): ConversationSource {
  const s = typeof source === 'string' ? source : '';
  if (!VALID_SOURCES.has(s)) throw new InvalidInputError(`invalid source: ${s}`);
  return s as ConversationSource;
}

function sanitizeArea(area: unknown): string {
  const a = typeof area === 'string' ? area.trim() : '';
  if (a === '') return 'architecture';
  // single segment, safe slug, no path characters
  const slug = slugifyTitle(a) || 'architecture';
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new InvalidInputError('designArea must be a single safe segment');
  }
  return slug;
}

function normalizeRelated(related: unknown): string[] {
  if (!Array.isArray(related)) return [];
  return uniqueStrings(related.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Markdown renderers
// ---------------------------------------------------------------------------

function renderConversationMarkdown(
  title: string,
  source: ConversationSource,
  createdAt: string,
  id: string,
  content: string,
  related: string[],
  captureMode?: CaptureMode,
): string {
  const relatedBlock =
    related.length > 0
      ? `\n## Related Assets\n\n${related.map((p) => `- ${p}`).join('\n')}\n`
      : '';
  const captureLine = captureMode ? `\n- Capture Mode: ${captureMode}` : '';
  return `# ${title}

- Source: ${source}
- Captured: ${createdAt}
- ID: ${id}${captureLine}

## Content

${content}${relatedBlock}`;
}

function renderDesignMarkdown(
  title: string,
  createdAt: string,
  id: string,
  content: string,
  sourceConversations: string[],
  related: string[],
): string {
  const sourcesBlock =
    sourceConversations.length > 0
      ? `## Sources\n\n${sourceConversations.map((c) => `- Conversation: ${c}`).join('\n')}\n`
      : '';
  const relatedBlock =
    related.length > 0 ? `\n## Related Assets\n\n${related.map((p) => `- ${p}`).join('\n')}\n` : '';
  return `# ${title}

- Type: design
- Created: ${createdAt}
- ID: ${id}

## Context

## Goals

## Proposed Design

${content}

${sourcesBlock}${relatedBlock}`;
}

function renderDecisionMarkdown(
  title: string,
  status: DecisionStatus,
  createdAt: string,
  id: string,
  content: string,
  sourceConversations: string[],
  sourceDesigns: string[],
  related: string[],
): string {
  const sources: string[] = [];
  for (const c of sourceConversations) sources.push(`- Conversation: ${c}`);
  for (const d of sourceDesigns) sources.push(`- Design: ${d}`);
  const sourcesBlock = sources.length > 0 ? `## Sources\n\n${sources.join('\n')}\n` : '';
  const relatedBlock =
    related.length > 0 ? `\n## Related Assets\n\n${related.map((p) => `- ${p}`).join('\n')}\n` : '';
  return `# Decision: ${title}

Status: ${status.toLowerCase()}

## Decision

${content}

## Context

## Rationale

## Consequences

${sourcesBlock}${relatedBlock}`;
}

// ---------------------------------------------------------------------------
// Create operations
// ---------------------------------------------------------------------------

export async function createConversation(input: CreateConversationInput): Promise<ManagedAssetResult> {
  const title = assertTitle(input.title);
  const source = normalizeSource(input.source);
  const content = assertContent(input.content);
  const related = normalizeRelated(input.relatedAssetPaths);
  const root = getProjectRoot();
  const id = newId('conv');
  const dirRel = `04-conversations/${SOURCE_DIR[source]}/${dateStamp()}-${slugifyTitle(title)}`;
  const contentRel = `${dirRel}/conversation.md`;
  const absDir = assertManagedWritable(root, dirRel);
  if (fs.existsSync(absDir)) {
    throw new ConflictError(`conversation directory already exists: ${dirRel}`);
  }
  const createdAt = nowIso();
  const meta: ManagedAssetMetadata = {
    schemaVersion: 1,
    id,
    type: 'agent-work-record',
    title,
    source,
    createdAt,
    updatedAt: createdAt,
    captureMode: input.captureMode ?? 'agent-work-record',
    relatedAssetPaths: related,
    promotedTo: [],
    agentSessionId: input.agentSessionId,
    sourceTranscriptId: input.sourceTranscriptId,
    transcriptCaptureStatus: input.transcriptCaptureStatus,
  };
  try {
    writeDirAtomic(absDir, {
      'conversation.md': renderConversationMarkdown(title, source, createdAt, id, content, related, meta.captureMode),
      'metadata.json': JSON.stringify(meta, null, 2),
    });
  } catch (e) {
    throw new WriteError(`failed to write conversation: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id, type: 'agent-work-record', path: contentRel, metadataPath: `${dirRel}/metadata.json` };
}

export interface CreateTranscriptInput {
  title: string;
  /** provider the transcript came from (chatgpt/codex/codebuddy/other); for imports this is the original provider */
  source: ConversationSource;
  /** raw, original transcript text — preserved verbatim, no destructive cleaning */
  content: string;
  /** how it was obtained: full-transcript (real capture) | imported-transcript | manual */
  captureMode: Extract<CaptureMode, 'full-transcript' | 'imported-transcript' | 'manual'>;
  completeness?: TranscriptCompleteness;
  /** platform session id, if known */
  sourceSessionId?: string;
  /** the AgentSession that owns this transcript (if captured during a closure) */
  agentSessionId?: string;
  /** platform-specific, non-core fields */
  sourceMetadata?: Record<string, unknown>;
  relatedAssetPaths?: string[];
}

/**
 * Persist a raw original Transcript as a first-class asset. The raw content is
 * written verbatim to `transcript.md`; all relation/identity data lives in the
 * sibling `metadata.json`. This is a DISTINCT type from an Agent Work Record.
 */
export async function createTranscript(input: CreateTranscriptInput): Promise<ManagedAssetResult> {
  const title = assertTitle(input.title);
  const source = normalizeSource(input.source);
  const content = assertContent(input.content);
  const related = normalizeRelated(input.relatedAssetPaths);
  const root = getProjectRoot();
  const id = newId('transcript');
  const segment =
    input.captureMode === 'imported-transcript' ? IMPORTED_TRANSCRIPT_SEGMENT : SOURCE_DIR[source] ?? 'other';
  const dirRel = `04-conversations/transcripts/${segment}/${dateStamp()}-${slugifyTitle(title)}`;
  const contentRel = `${dirRel}/transcript.md`;
  const absDir = assertManagedWritable(root, dirRel);
  if (fs.existsSync(absDir)) {
    throw new ConflictError(`transcript directory already exists: ${dirRel}`);
  }
  const createdAt = nowIso();
  const meta: ManagedAssetMetadata = {
    schemaVersion: 1,
    id,
    type: 'conversation-transcript',
    title,
    source,
    createdAt,
    updatedAt: createdAt,
    captureMode: input.captureMode,
    completeness: input.completeness ?? 'full',
    capturedAt: createdAt,
    sourceSessionId: input.sourceSessionId,
    agentSessionId: input.agentSessionId,
    sourceMetadata: input.sourceMetadata,
    relatedAssetPaths: related,
  };
  try {
    // Raw transcript is preserved verbatim — no destructive reformatting.
    writeDirAtomic(absDir, {
      'transcript.md': content,
      'metadata.json': JSON.stringify(meta, null, 2),
    });
  } catch (e) {
    throw new WriteError(`failed to write transcript: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id, type: 'conversation-transcript', path: contentRel, metadataPath: `${dirRel}/metadata.json` };
}

/**
 * Patch an existing managed asset's metadata by id (used to wire bidirectional
 * Transcript <-> Work Record links after both are created).
 */
export async function patchAssetMetadataById(id: string, patch: Partial<ManagedAssetMetadata>): Promise<void> {
  const found = locateById(getProjectRoot(), id);
  if (!found) throw new NotFoundError(`asset not found: ${id}`);
  updateMetadata(getProjectRoot(), found.contentRel, (m) => {
    Object.assign(m, patch);
  });
  await afterWrite();
}

export async function createDesign(input: CreateDesignInput): Promise<ManagedAssetResult> {
  const title = assertTitle(input.title);
  const area = sanitizeArea(input.designArea);
  const content = assertContent(input.content);
  const sourceConversations = uniqueStrings(input.sourceConversations ?? []);
  const related = normalizeRelated(input.relatedAssetPaths);
  const root = getProjectRoot();
  const id = newId('design');
  const contentRel = `02-design/${area}/${slugifyTitle(title)}.md`;
  const abs = assertManagedWritable(root, contentRel);
  if (fs.existsSync(abs)) {
    throw new ConflictError(`design already exists: ${contentRel}`);
  }
  const createdAt = nowIso();
  const meta: ManagedAssetMetadata = {
    schemaVersion: 1,
    id,
    type: 'design',
    title,
    designArea: area,
    createdAt,
    updatedAt: createdAt,
    sourceConversations,
    relatedAssetPaths: related,
    promotedToDecisions: [],
  };
  try {
    writePairDurableAtomic(
      abs,
      renderDesignMarkdown(title, createdAt, id, content, sourceConversations, related),
      assertManagedWritable(root, metadataRelForContent(contentRel)),
      JSON.stringify(meta, null, 2),
    );
  } catch (e) {
    throw new WriteError(`failed to write design: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id, type: 'design', path: contentRel, metadataPath: metadataRelForContent(contentRel) };
}

/** Scan `02-design/decisions` for the max existing NNNN prefix; return max+1. */
function nextDecisionNumber(root: string): number {
  const dir = relToAbs(root, '02-design/decisions');
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      const m = /^(\d+)-/.exec(name);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return max + 1;
}

export async function createDecision(input: CreateDecisionInput): Promise<ManagedAssetResult> {
  const title = assertTitle(input.title);
  const content = assertContent(input.content);
  const status: DecisionStatus = DECISION_STATUSES.includes(input.status as DecisionStatus)
    ? (input.status as DecisionStatus)
    : 'Accepted';
  const sourceConversations = uniqueStrings(input.sourceConversations ?? []);
  const sourceDesigns = uniqueStrings(input.sourceDesigns ?? []);
  const related = normalizeRelated(input.relatedAssetPaths);
  const root = getProjectRoot();
  const id = newId('decision');
  let n = nextDecisionNumber(root);
  // Guard against residual collisions (deleted-then-recreated, rare races).
  let contentRel = `02-design/decisions/${String(n).padStart(4, '0')}-${slugifyTitle(title)}.md`;
  let attempts = 0;
  while (fs.existsSync(relToAbs(root, contentRel)) && attempts < 1000) {
    n += 1;
    attempts += 1;
    contentRel = `02-design/decisions/${String(n).padStart(4, '0')}-${slugifyTitle(title)}.md`;
  }
  const createdAt = nowIso();
  const meta: ManagedAssetMetadata = {
    schemaVersion: 1,
    id,
    type: 'decision',
    title,
    status,
    createdAt,
    updatedAt: createdAt,
    sourceConversations,
    sourceDesigns,
    relatedAssetPaths: related,
  };
  try {
    writePairDurableAtomic(
      assertManagedWritable(root, contentRel),
      renderDecisionMarkdown(title, status, createdAt, id, content, sourceConversations, sourceDesigns, related),
      assertManagedWritable(root, metadataRelForContent(contentRel)),
      JSON.stringify(meta, null, 2),
    );
  } catch (e) {
    throw new WriteError(`failed to write decision: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id, type: 'decision', path: contentRel, metadataPath: metadataRelForContent(contentRel) };
}

// ---------------------------------------------------------------------------
// Locate by id (for promotion relations)
// ---------------------------------------------------------------------------

interface LocatedAsset {
  contentRel: string;
  metadata: ManagedAssetMetadata;
}

function walkMetadata(root: string, dir: string, out: LocatedAsset[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === '.git' || e.name.startsWith('.awtmp-')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkMetadata(root, abs, out);
    } else if (e.name === 'metadata.json' || e.name.endsWith('.metadata.json')) {
      try {
        const meta = JSON.parse(fs.readFileSync(abs, 'utf8')) as ManagedAssetMetadata;
        if (meta && meta.id) {
          const contentName =
            e.name === 'metadata.json'
              ? (meta.type === 'conversation-transcript' ? 'transcript.md' : 'conversation.md')
              : e.name.replace(/\.metadata\.json$/, '.md');
          const contentRel = `${path.relative(root, dir).split(path.sep).join('/')}/${contentName}`;
          out.push({ contentRel, metadata: meta });
        }
      } catch {
        // not a valid metadata file; skip
      }
    }
  }
}

function locateById(root: string, id: string): LocatedAsset | null {
  const out: LocatedAsset[] = [];
  for (const top of ['04-conversations', '02-design']) {
    const dir = relToAbs(root, top);
    if (fs.existsSync(dir)) walkMetadata(root, dir, out);
  }
  return out.find((a) => a.metadata.id === id) ?? null;
}

/** Public locator used by the Knowledge Capture closure to resolve an existing asset by id. */
export function findAssetById(id: string): LocatedAsset | null {
  return locateById(getProjectRoot(), id);
}

function updateMetadata(root: string, contentRel: string, patch: (m: ManagedAssetMetadata) => void): void {
  const metaRel = metadataRelForContent(contentRel);
  const abs = assertManagedWritable(root, metaRel);
  let meta: ManagedAssetMetadata;
  try {
    meta = JSON.parse(fs.readFileSync(abs, 'utf8')) as ManagedAssetMetadata;
  } catch {
    throw new WriteError(`metadata missing for ${contentRel}`);
  }
  patch(meta);
  meta.updatedAt = nowIso();
  writeFileAtomic(abs, JSON.stringify(meta, null, 2));
}

// ---------------------------------------------------------------------------
// Promotion chain
// ---------------------------------------------------------------------------

export async function promoteConversationToDesign(
  convId: string,
  input: CreateDesignInput,
): Promise<ManagedAssetResult> {
  const root = getProjectRoot();
  const found = locateById(root, convId);
  if (!found || (found.metadata.type !== 'conversation' && found.metadata.type !== 'agent-work-record')) {
    throw new NotFoundError(`conversation not found: ${convId}`);
  }
  const sourceConversations = uniqueStrings([...(input.sourceConversations ?? []), convId]);
  const design = await createDesign({ ...input, sourceConversations });
  updateMetadata(root, found.contentRel, (m) => {
    m.promotedTo = [...(m.promotedTo ?? []), { type: 'design', id: design.id }];
  });
  await afterWrite();
  return design;
}

export async function promoteDesignToDecision(designId: string, input: CreateDecisionInput): Promise<ManagedAssetResult> {
  const root = getProjectRoot();
  const found = locateById(root, designId);
  if (!found || found.metadata.type !== 'design') {
    throw new NotFoundError(`design not found: ${designId}`);
  }
  const sourceConversations = uniqueStrings([...(input.sourceConversations ?? []), ...(found.metadata.sourceConversations ?? [])]);
  const decision = await createDecision({
    ...input,
    sourceConversations,
    sourceDesigns: uniqueStrings([...(input.sourceDesigns ?? []), designId]),
  });
  updateMetadata(root, found.contentRel, (m) => {
    m.promotedToDecisions = [...(m.promotedToDecisions ?? []), decision.id];
  });
  await afterWrite();
  return decision;
}

// ---------------------------------------------------------------------------
// In-place update (Knowledge Capture closure "update" action)
// ---------------------------------------------------------------------------

function locateByContentRel(root: string, contentRel: string): LocatedAsset | null {
  const meta = readMetadata(root, contentRel);
  if (!meta) return null;
  return { contentRel, metadata: meta };
}

export interface UpdateDesignInput {
  id?: string;
  /** relative content path, e.g. 02-design/architecture/foo.md */
  path?: string;
  title?: string;
  content: string;
  relatedAssetPaths?: string[];
}
export interface UpdateDecisionInput {
  id?: string;
  path?: string;
  title?: string;
  status?: DecisionStatus;
  content: string;
  relatedAssetPaths?: string[];
}

export async function updateDesign(input: UpdateDesignInput): Promise<ManagedAssetResult> {
  const root = getProjectRoot();
  const found = input.id
    ? locateById(root, input.id)
    : input.path
      ? locateByContentRel(root, input.path)
      : null;
  if (!found || found.metadata.type !== 'design') {
    throw new NotFoundError(`design not found: ${input.id ?? input.path ?? '(none)'}`);
  }
  const m = found.metadata;
  const title = (input.title ?? '').trim() || m.title;
  const related = normalizeRelated(input.relatedAssetPaths);
  const contentRel = found.contentRel;
  const newMeta: ManagedAssetMetadata = {
    ...m,
    title,
    relatedAssetPaths: related.length > 0 ? related : m.relatedAssetPaths,
    updatedAt: nowIso(),
  };
  try {
    writePairDurableAtomic(
      assertManagedWritable(root, contentRel),
      renderDesignMarkdown(title, m.createdAt, m.id, input.content, m.sourceConversations ?? [], newMeta.relatedAssetPaths ?? []),
      assertManagedWritable(root, metadataRelForContent(contentRel)),
      JSON.stringify(newMeta, null, 2),
    );
  } catch (e) {
    throw new WriteError(`failed to update design: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id: m.id, type: 'design', path: contentRel, metadataPath: metadataRelForContent(contentRel) };
}

export async function updateDecision(input: UpdateDecisionInput): Promise<ManagedAssetResult> {
  const root = getProjectRoot();
  const found = input.id
    ? locateById(root, input.id)
    : input.path
      ? locateByContentRel(root, input.path)
      : null;
  if (!found || found.metadata.type !== 'decision') {
    throw new NotFoundError(`decision not found: ${input.id ?? input.path ?? '(none)'}`);
  }
  const m = found.metadata;
  const title = (input.title ?? '').trim() || m.title;
  const status: DecisionStatus = input.status ?? m.status ?? 'Accepted';
  const related = normalizeRelated(input.relatedAssetPaths);
  const contentRel = found.contentRel;
  const newMeta: ManagedAssetMetadata = {
    ...m,
    title,
    status,
    relatedAssetPaths: related.length > 0 ? related : m.relatedAssetPaths,
    updatedAt: nowIso(),
  };
  try {
    writePairDurableAtomic(
      assertManagedWritable(root, contentRel),
      renderDecisionMarkdown(title, status, m.createdAt, m.id, input.content, m.sourceConversations ?? [], m.sourceDesigns ?? [], newMeta.relatedAssetPaths ?? []),
      assertManagedWritable(root, metadataRelForContent(contentRel)),
      JSON.stringify(newMeta, null, 2),
    );
  } catch (e) {
    throw new WriteError(`failed to update decision: ${(e as Error).message}`);
  }
  await afterWrite();
  return { id: m.id, type: 'decision', path: contentRel, metadataPath: metadataRelForContent(contentRel) };
}

// ---------------------------------------------------------------------------
// Read (for the detail panel)
// ---------------------------------------------------------------------------

export function getManagedAssetByPath(contentRel: string): ManagedAssetMetadata | null {
  const root = getProjectRoot();
  return readMetadata(root, contentRel);
}
