import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest, RawEntry } from './enterpriseImport.ts';

const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const IMAGE = 'maven:3.9.11-eclipse-temurin-21';
const safePath = (value: string) => {
  if (!value || value.startsWith('/') || value.includes('\\') || value.includes('\0')
    || value.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Unsafe refactoring path');
  return value;
};
export interface AiRefactorProposal {
  id: string; snapshotId: string; repository: string; path: string; commit: string;
  status: 'proposal'; model: string; originalSha256: string; candidateSha256: string;
  oldText: string; newText: string; rationale: string; createdAt: string;
}
export interface AiRefactorValidation {
  proposalId: string; status: 'verified' | 'blocked' | 'rejected'; reason: string;
  baselineExit?: number; candidateExit?: number;
  baselineMs?: number; candidateMs?: number;
  originalSourceModified: false;
}
function snapshotAndManifest(root: string, snapshotId: string) {
  const snap = listEnterpriseSnapshots(root).find(v => v.snapshotId === snapshotId);
  if (!snap) throw new Error('Unknown immutable Snapshot');
  const store = enterpriseStoreFor(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'imports', snapshotId + '.json'), 'utf8')) as RawImportManifest;
  return { snap, store, manifest };
}
function proposalFile(store: string, id: string) {
  if (!/^refactor-[a-f0-9]{24}$/.test(id)) throw new Error('Invalid proposal ID');
  return path.join(store, 'refactors', id + '.json');
}
function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.tmp-' + randomUUID();
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
function findEntry(entries: RawEntry[], repo: string, relative: string) {
  const entry = entries.find(e => e.repository === repo && e.path === relative);
  if (!entry || !entry.sha256) throw new Error('Source file is not available in Git-pinned Raw');
  return entry;
}
function readRaw(store: string, entry: RawEntry): Buffer {
  if (!entry.sha256) throw new Error('Missing Raw SHA');
  const file = path.join(store, 'raw', entry.sha256.slice(0, 2), entry.sha256);
  const bytes = fs.readFileSync(file);
  if (sha(bytes) !== entry.sha256) throw new Error('Raw content checksum failed');
  return bytes;
}
export async function proposeEnterpriseAiRefactor(root: string, request: {
  snapshotId: string; repository: string; path: string; model?: string;
}): Promise<AiRefactorProposal> {
  const repo = safePath(request.repository), relative = safePath(request.path);
  if (!relative.endsWith('.java')) throw new Error('AI refactoring currently supports Java files only');
  const { snap, store, manifest } = snapshotAndManifest(root, request.snapshotId);
  const version = snap.repositories.find(v => v.path === repo);
  if (!version) throw new Error('Repository not part of selected Snapshot');
  const content = readRaw(store, findEntry(manifest.entries, repo, relative));
  if (content.byteLength > 20000) throw new Error('Source file exceeds AI privacy/context budget');
  const source = content.toString('utf8');
  if (!Buffer.from(source).equals(content)) throw new Error('Only UTF-8 source supported');
  const model = request.model?.trim() || 'qwen2.5-coder:7b';
  if (!/^[\w.:/-]{2,80}$/.test(model)) throw new Error('Invalid local model identifier');
  const prompt = [
    'You are a conservative Java refactoring assistant. Propose ONE local, semantics-preserving code improvement.',
    'Output ONLY JSON with oldText, newText, rationale; no Markdown.',
    'oldText MUST match exactly once in the supplied file. Never remove validation or authorization.',
    'Do not change public API signatures, SQL conditions, security logic or dependencies.',
    'The proposal will NEVER be directly applied to the original company checkout.',
    'REPOSITORY: ' + repo, 'PATH: ' + relative, 'GIT SHA: ' + version.commit, 'SOURCE:', source,
  ].join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let generated: { response?: string };
  try {
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json',
        options: { temperature: 0, num_predict: 1500 } }), signal: controller.signal,
    });
    if (!response.ok) throw new Error('Local AI model returned HTTP ' + response.status);
    generated = await response.json() as { response?: string };
  } catch {
    throw new Error('本地 Ollama 无法调用或超时。没有模型的实际输出，不能宣称 AI 自动重构成功。');
  } finally { clearTimeout(timer); }
  let decoded: { oldText?: unknown; newText?: unknown; rationale?: unknown };
  try { decoded = JSON.parse(generated.response || '') as typeof decoded; }
  catch { throw new Error('Local model did not return valid JSON'); }
  const oldText = decoded.oldText, newText = decoded.newText, rationale = decoded.rationale;
  if (typeof oldText !== 'string' || typeof newText !== 'string' || typeof rationale !== 'string'
    || !oldText.trim() || !newText.trim() || oldText === newText
    || oldText.length > 10000 || newText.length > 10000) throw new Error('AI patch failed schema/size validation');
  if (source.split(oldText).length !== 2) throw new Error('AI patch must match exactly one original location');
  const next = source.replace(oldText, newText);
  const originalSha256 = sha(content), candidateSha256 = sha(next);
  const id = 'refactor-' + sha(request.snapshotId + repo + relative + candidateSha256).slice(0, 24);
  const result: AiRefactorProposal = {
    id, snapshotId: request.snapshotId, repository: repo, path: relative,
    commit: version.commit, status: 'proposal', model, originalSha256, candidateSha256,
    oldText, newText, rationale: rationale.slice(0, 500), createdAt: new Date().toISOString(),
  };
  atomicJson(proposalFile(store, id), result);
  return result;
}
function sandboxedMaven(root: string, repo: string): { exit: number; ms: number; notes: string } {
  const start = Date.now();
  const run = spawnSync('docker', [
    'run', '--rm', '--pull=never', '--network=none', '--read-only',
    '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128',
    '--memory=3g', '--cpus=2', '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777',
    '-v', root + ':/workspace:rw', '-w', '/workspace/' + repo,
    '--entrypoint', 'mvn', IMAGE, '-B', '--offline', '-q', '-DskipITs', 'test',
  ], {
    encoding: 'utf8', timeout: 180_000, maxBuffer: 256 * 1024,
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '' },
  });
  return { exit: run.status ?? -1, ms: Date.now() - start,
    notes: (run.error?.message || run.stderr || run.stdout || '').slice(-350) };
}
export function validateEnterpriseAiRefactor(root: string, proposalId: string): AiRefactorValidation {
  const store = enterpriseStoreFor(root);
  const proposal = JSON.parse(fs.readFileSync(proposalFile(store, proposalId), 'utf8')) as AiRefactorProposal;
  const { snap, manifest } = snapshotAndManifest(root, proposal.snapshotId);
  const blocked = (reason: string): AiRefactorValidation =>
    ({ proposalId, status: 'blocked', reason, originalSourceModified: false });
  if (manifest.status !== 'verified') return blocked('Raw Manifest is incomplete; full offline tests would be invalid');
  if (manifest.entries.length > 30000) return blocked('Snapshot exceeds bounded test sandbox materialization');
  if (!snap.repositories.some(v => v.path === proposal.repository && v.commit === proposal.commit))
    return blocked('Pinned source commit does not match proposal');
  const image = spawnSync('docker', ['image', 'inspect', IMAGE], {
    encoding: 'utf8', timeout: 5000, stdio: 'ignore', env: { PATH: process.env.PATH || '' },
  });
  if (image.status !== 0) return blocked('Docker or the pinned cached Maven/JDK image is unavailable. No untrusted build was executed on host.');
  const location = path.join(store, 'refactors', proposalId + '-sandbox');
  const baseline = path.join(location, 'baseline'), candidate = path.join(location, 'candidate');
  let total = 0;
  for (const entry of manifest.entries) {
    if (!entry.sha256) return blocked('Manifest contains unmaterialized files');
    if (entry.mode === '120000' || entry.mode === '160000') return blocked('Symlinks/submodules need an explicit sandbox policy');
    try { safePath(entry.repository); safePath(entry.path); }
    catch { return blocked('Unsafe repository file path in snapshot'); }
    const bytes = readRaw(store, entry);
    total += bytes.length;
    if (total > 256 * 1024 * 1024) return blocked('Sandbox storage budget exceeded');
    for (const workspace of [baseline, candidate]) {
      const file = path.join(workspace, entry.repository, ...entry.path.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(file)) fs.writeFileSync(file, bytes, { mode: 0o600 });
    }
  }
  const target = path.join(candidate, proposal.repository, ...proposal.path.split('/'));
  const original = fs.readFileSync(target, 'utf8');
  if (sha(original) !== proposal.originalSha256 || original.split(proposal.oldText).length !== 2)
    return blocked('Proposal base bytes changed or original hunk is ambiguous');
  const updated = original.replace(proposal.oldText, proposal.newText);
  if (sha(updated) !== proposal.candidateSha256) return blocked('Candidate patch checksum mismatch');
  fs.writeFileSync(target, updated, { mode: 0o600 });
  // Baseline MUST pass before candidate is credited with a meaningful result.
  const before = sandboxedMaven(baseline, proposal.repository);
  if (before.exit !== 0) return { proposalId, status: 'blocked', reason: 'Baseline Maven test failed: ' + before.notes,
    baselineExit: before.exit, baselineMs: before.ms, originalSourceModified: false };
  const after = sandboxedMaven(candidate, proposal.repository);
  const result: AiRefactorValidation = {
    proposalId, status: after.exit === 0 ? 'verified' : 'rejected',
    reason: after.exit === 0
      ? 'Baseline and candidate Maven offline tests both passed inside network-isolated Docker; performance equivalence is NOT established.'
      : 'Candidate Maven tests failed: ' + after.notes,
    baselineExit: before.exit, candidateExit: after.exit,
    baselineMs: before.ms, candidateMs: after.ms, originalSourceModified: false,
  };
  atomicJson(path.join(store, 'refactors', proposalId + '-validation.json'), result);
  return result;
}
