import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canonicalEnterpriseRoot, enterpriseEntryForRoot } from './enterpriseStorage.ts';

type Candidate = { relative: string; files: Array<{ filename: string; sha256: string; bytes: number }> };
const sha = (content: Buffer | string) => createHash('sha256').update(content).digest('hex');
const ROOTS = ['04-conversations', '02-design', '03-docs', '05-derived'];
const TYPES = new Set(['agent-work-record', 'conversation-transcript', 'design', 'decision']);
const ALLOWED = new Set(['conversation.md', 'transcript.md', 'design.md', 'decision.md', 'metadata.json']);
const legacyDestination = (root: string) =>
  path.join(root, '.asset-workbench-data', 'knowledge', 'legacy-managed');
function examineDirectory(dir: string, relative: string): Candidate | null {
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
    const root = fs.realpathSync(relative.split('|')[0]);
    if (meta.projectRoot && fs.realpathSync(meta.projectRoot) !== root) return null;
    if (meta.sourceMetadata?.projectRoot && fs.realpathSync(meta.sourceMetadata.projectRoot) !== root) return null;
    const content = meta.type === 'conversation-transcript' ? 'transcript.md'
      : meta.type === 'agent-work-record' ? 'conversation.md'
      : meta.type === 'design' ? 'design.md' : 'decision.md';
    const contentPath = path.join(dir, content);
    if (!fs.existsSync(contentPath) || !fs.lstatSync(contentPath).isFile()
      || fs.lstatSync(contentPath).isSymbolicLink()) return null;
    return { relative: relative.split('|').slice(1).join('|'),
      files: [metaFile, contentPath].map(filename => ({
        filename, sha256: sha(fs.readFileSync(filename)), bytes: fs.statSync(filename).size,
      })) };
  } catch { return null; }
}
function discover(root: string): { candidates: Candidate[]; unverified: string[] } {
  const candidates: Candidate[] = [], unverified: string[] = [];
  const explore = (base: string, relative: string, depth: number) => {
    if (candidates.length > 30_000) throw new Error('Legacy capture migration file limit reached');
    if (depth > 7) { unverified.push(relative + ': directory depth cap'); return; }
    const dirname = path.join(root, ...relative.split('/'));
    if (!fs.existsSync(dirname)) return;
    if (fs.lstatSync(dirname).isSymbolicLink()) { unverified.push(relative + ': symlink'); return; }
    if (!fs.lstatSync(dirname).isDirectory()) return;
    if (fs.existsSync(path.join(dirname, '.git'))) { unverified.push(relative + ': independent repository boundary'); return; }
    const checked = examineDirectory(dirname, root + '|' + relative);
    if (checked) { candidates.push(checked); return; }
    if (fs.existsSync(path.join(dirname, 'metadata.json'))) {
      unverified.push(relative + ': unknown or unmatched legacy asset metadata');
      return;
    }
    for (const entry of fs.readdirSync(dirname, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name === '.git' || entry.name === '.asset-workbench-data') continue;
      explore(base, relative + '/' + entry.name, depth + 1);
    }
  };
  for (const entry of ROOTS) explore(root, entry, 0);
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
