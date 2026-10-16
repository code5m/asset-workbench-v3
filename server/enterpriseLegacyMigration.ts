import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertSafeEnterpriseManagedPath, canonicalEnterpriseRoot, enterpriseEntryForRoot } from './enterpriseStorage.ts';

type Candidate = { relative: string; files: Array<{ filename: string; sha256: string; bytes: number }> };
const sha = (content: Buffer | string) => createHash('sha256').update(content).digest('hex');
const ROOTS = ['04-conversations', '02-design', '03-docs', '05-derived'];
const TYPES = new Set(['agent-work-record', 'conversation-transcript', 'design', 'decision']);
const legacyDestination = (root: string) =>
  path.join(root, '.asset-workbench-data', 'knowledge', 'legacy-managed');
function examineDirectory(dir: string, root: string, relative: string): Candidate | null {
  const metaFile = path.join(dir, 'metadata.json');
  if (!fs.existsSync(metaFile)) return null;
  if (!fs.lstatSync(metaFile).isFile() || fs.lstatSync(metaFile).isSymbolicLink()) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as {
      schemaVersion?: number; type?: string; id?: string;
      projectRoot?: string; sourceMetadata?: { projectRoot?: string };
    };
    if (meta.schemaVersion !== 1 || !TYPES.has(meta.type || '') ||
      !/^(?:conv|transcript|design|decision)_[\w-]{8,90}$/.test(meta.id || '')) return null;
    // Never infer the project owner from a loose directory name. Historic
    // assets without a verifiable original project identity stay untouched and
    // appear in the migration review/skip report.
    const attestedRoot = meta.projectRoot ?? meta.sourceMetadata?.projectRoot;
    if (!attestedRoot || fs.realpathSync(attestedRoot) !== root) return null;
    if (meta.projectRoot && meta.sourceMetadata?.projectRoot
      && fs.realpathSync(meta.sourceMetadata.projectRoot) !== root) return null;
    const content = meta.type === 'conversation-transcript' ? 'transcript.md'
      : meta.type === 'agent-work-record' ? 'conversation.md'
      : meta.type === 'design' ? 'design.md' : 'decision.md';
    const contentPath = path.join(dir, content);
    if (!fs.existsSync(contentPath) || !fs.lstatSync(contentPath).isFile()
      || fs.lstatSync(contentPath).isSymbolicLink()) return null;
    return { relative,
      files: [metaFile, contentPath].map(filename => ({
        filename, sha256: sha(fs.readFileSync(filename)), bytes: fs.statSync(filename).size,
      })) };
  } catch { return null; }
}
function discover(root: string): { candidates: Candidate[]; unverified: string[] } {
  const candidates: Candidate[] = [], unverified: string[] = [];
  const explore = (relative: string, depth: number) => {
    if (candidates.length > 30_000) throw new Error('Legacy capture migration file limit reached');
    if (depth > 7) { unverified.push(relative + ': directory depth cap'); return; }
    const dirname = path.join(root, ...relative.split('/'));
    if (!fs.existsSync(dirname)) return;
    if (fs.lstatSync(dirname).isSymbolicLink()) { unverified.push(relative + ': symlink'); return; }
    if (!fs.lstatSync(dirname).isDirectory()) return;
    if (fs.existsSync(path.join(dirname, '.git'))) { unverified.push(relative + ': independent repository boundary'); return; }
    const checked = examineDirectory(dirname, root, relative);
    if (checked) { candidates.push(checked); return; }
    if (fs.existsSync(path.join(dirname, 'metadata.json'))) {
      unverified.push(relative + ': unknown or unmatched legacy asset metadata');
      return;
    }
    for (const entry of fs.readdirSync(dirname, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name === '.git' || entry.name === '.asset-workbench-data') continue;
      explore(relative + '/' + entry.name, depth + 1);
    }
  };
  for (const entry of ROOTS) explore(entry, 0);
  return { candidates: candidates.sort((a,b) => a.relative.localeCompare(b.relative)), unverified };
}
export interface LegacyAssetMigrationReport {
  copies: number; bytes: number; hash: string; sourcePreserved: true;
  skippedUnverified: string[]; destination: string; status: 'verified' | 'partial';
}
export function migrateEnterpriseLegacyKnowledge(rootInput: string): LegacyAssetMigrationReport {
  const root = canonicalEnterpriseRoot(rootInput);
  if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') throw new Error('Legacy migration requires managed enterprise mode');
  const store = path.join(root, '.asset-workbench-data');
  if (!fs.existsSync(store) || !fs.lstatSync(store).isDirectory() || fs.lstatSync(store).isSymbolicLink()) {
    throw new Error('Invalid managed data directory');
  }
  const { candidates, unverified } = discover(root);
  const bytes = candidates.reduce((n,c) => n + c.files.reduce((sum,f) => sum+f.bytes,0),0);
  if (bytes > 1024 * 1024 * 1024) throw new Error('Legacy knowledge migration exceeds 1 GiB safety budget');
  const hash = sha(JSON.stringify(candidates.map(c => ({
    relative:c.relative,files:c.files.map(f=>({ name:path.basename(f.filename), sha256:f.sha256 })),
  }))));
  const destination = legacyDestination(root);
  if (fs.existsSync(destination)) {
    if (!fs.lstatSync(destination).isDirectory() || fs.lstatSync(destination).isSymbolicLink()) {
      throw new Error('Existing legacy destination is not a safe directory');
    }
    for (const asset of candidates) for (const f of asset.files) {
      const target = path.join(destination, ...asset.relative.split('/'), path.basename(f.filename));
      if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()
        || sha(fs.readFileSync(target)) !== f.sha256) {
        throw new Error('Legacy knowledge destination conflict; no old data has been deleted');
      }
    }
  } else {
    const parent = path.dirname(destination);
    fs.mkdirSync(parent, { recursive:true,mode:0o700 });
    const stage = path.join(parent, '.legacy-stage-' + randomUUID());
    fs.mkdirSync(stage, { mode: 0o700 });
    try {
      for (const asset of candidates) for (const f of asset.files) {
        const target = path.join(stage, ...asset.relative.split('/'), path.basename(f.filename));
        fs.mkdirSync(path.dirname(target), { recursive:true,mode:0o700 });
        fs.copyFileSync(f.filename, target, fs.constants.COPYFILE_EXCL);
        if (sha(fs.readFileSync(target)) !== f.sha256) throw new Error('Legacy asset hash mismatch');
        fs.chmodSync(target, 0o600);
      }
      fs.renameSync(stage, destination);
    } finally { if (fs.existsSync(stage)) fs.rmSync(stage,{recursive:true,force:true}); }
  }
  const receipt = path.join(destination, 'migration-receipt.json');
  if (!fs.existsSync(receipt)) {
    fs.writeFileSync(receipt, JSON.stringify({
      schemaVersion:1,workspaceId:enterpriseEntryForRoot(root)!.workspaceId,
      sourcePreserved:true,hash,candidates,createdAt:new Date().toISOString(),
      skippedUnverified:unverified,
    }, null, 2)+'\n',{mode:0o600});
  }
  return {
    copies:candidates.length,bytes,hash,sourcePreserved:true,
    skippedUnverified:unverified.slice(0,100),destination,
    status:unverified.length?'partial':'verified',
  };
}

export interface MigratedLegacyKnowledgeAsset {
  id: string; relative: string; title: string; type: string; source: string;
  contentFile: string; capturedAt?: string;
}
export function listMigratedEnterpriseLegacyAssets(rootInput: string): MigratedLegacyKnowledgeAsset[] {
  const root = canonicalEnterpriseRoot(rootInput);
  if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') return [];
  const folder = assertSafeEnterpriseManagedPath(root, 'knowledge/legacy-managed');
  const receipt = path.join(folder, 'migration-receipt.json');
  if (!fs.existsSync(receipt)) return [];
  const body = JSON.parse(fs.readFileSync(receipt, 'utf8')) as {
    workspaceId: string; candidates: Candidate[];
  };
  if (body.workspaceId !== enterpriseEntryForRoot(root)?.workspaceId || !Array.isArray(body.candidates)) {
    throw new Error('Migrated legacy asset receipt has a wrong workspace identity');
  }
  return body.candidates.flatMap(candidate => {
    if (!candidate.relative.startsWith('04-conversations/') && !candidate.relative.startsWith('02-design/')
      && !candidate.relative.startsWith('03-docs/') && !candidate.relative.startsWith('05-derived/')) return [];
    if (candidate.relative.split('/').some(part => part === '..' || !part)) return [];
    const metaPath = assertSafeEnterpriseManagedPath(root, 'knowledge/legacy-managed/' + candidate.relative + '/metadata.json');
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        id?: string; title?: string; type?: string; source?: string; createdAt?: string;
      };
      const contentFile = meta.type === 'conversation-transcript' ? 'transcript.md'
        : meta.type === 'agent-work-record' ? 'conversation.md'
        : meta.type === 'design' ? 'design.md' : 'decision.md';
      const expected = candidate.files.find(f => path.basename(f.filename) === contentFile);
      if (!expected) return [];
      const content = assertSafeEnterpriseManagedPath(root, 'knowledge/legacy-managed/' + candidate.relative + '/' + contentFile);
      if (sha(fs.readFileSync(content)) !== expected.sha256) throw new Error('Legacy content changed');
      return [{ id: meta.id || candidate.relative, relative: candidate.relative,
        title: meta.title || candidate.relative, type: meta.type || 'unknown',
        source: meta.source || 'legacy', contentFile, capturedAt: meta.createdAt }];
    } catch { return []; }
  });
}
export function readMigratedEnterpriseLegacyAsset(rootInput: string, relative: string): {
  relative: string; content: string;
} {
  const root = canonicalEnterpriseRoot(rootInput);
  const asset = listMigratedEnterpriseLegacyAssets(root).find(x => x.relative === relative);
  if (!asset) throw new Error('Legacy asset was not verified or does not belong to selected workspace');
  const file = assertSafeEnterpriseManagedPath(root, 'knowledge/legacy-managed/' + asset.relative + '/' + asset.contentFile);
  if (fs.statSync(file).size > 1024 * 1024) throw new Error('Legacy asset exceeds display budget');
  return { relative, content: fs.readFileSync(file, 'utf8') };
}
