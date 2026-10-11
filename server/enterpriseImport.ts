import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { enterpriseStoreFor, listEnterpriseSnapshots, verifyEnterpriseSnapshot } from './enterpriseWorkspace.ts';

const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const command = (root: string, args: string[], limit = 32 * 1024 * 1024): Buffer =>
  execFileSync('git', ['-C', root, ...args], {
    maxBuffer: limit, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
const safeRepository = (root: string, relative: string): string => {
  const candidate = fs.realpathSync(path.join(root, relative));
  if (candidate !== root && !candidate.startsWith(root + path.sep)) throw new Error('Repository escaped workspace root');
  return candidate;
};
const commitJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp-' + randomUUID();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
};
export interface RawEntry {
  repository: string; path: string; oid: string; mode: string; bytes?: number; sha256?: string;
  status: 'materialized' | 'oversize' | 'unavailable' | 'symlink' | 'gitlink';
}
export interface RawImportManifest {
  schemaVersion: 1; snapshotId: string; generatedAt: string;
  status: 'verified' | 'partial'; total: number; materialized: number; missing: number;
  entries: RawEntry[]; manifestHash: string;
}
/**
 * Import exact Git objects, not potentially dirty working-tree files.
 * A bounded content-addressed blob store can deduplicate across 35+ repos.
 * Never writes inside the source checkout. Fail closed on corrupt/absent objects.
 */
export function importEnterpriseRaw(rootInput: string, snapshotId: string, options: { maxBytes?: number; maxFiles?: number } = {}): RawImportManifest {
  const root = fs.realpathSync(rootInput);
  const snap = listEnterpriseSnapshots(root).find((v) => v.snapshotId === snapshotId);
  if (!snap) throw new Error('Unknown frozen enterprise snapshot');
  const check = verifyEnterpriseSnapshot(root, snapshotId);
  if (!check.ok) throw new Error('Snapshot Git objects are not available: ' + check.missing.join('; '));
  const store = enterpriseStoreFor(root);
  const maxBytes = Math.max(0, Math.min(options.maxBytes ?? 16 * 1024 * 1024, 512 * 1024 * 1024));
  const maxFiles = Math.max(1, Math.min(options.maxFiles ?? 50000, 500000));
  const folder = path.join(store, 'imports');
  const manifestFile = path.join(folder, snapshotId + '.json');
  if (fs.existsSync(manifestFile)) {
    const existing = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as RawImportManifest;
    if (existing.manifestHash !== hash(JSON.stringify(existing.entries))) throw new Error('Stored Raw manifest failed checksum');
    if (existing.status === 'verified') return existing;
  }
  const entries: RawEntry[] = [];
  let materialized = 0, missing = 0, totalBytes = 0;
  for (const repo of snap.repositories) {
    const dir = safeRepository(root, repo.path);
    const listing = command(dir, ['ls-tree', '-rz', '--full-tree', repo.commit], 128 * 1024 * 1024);
    const rows = listing.toString('utf8').split('\0').filter(Boolean);
    for (const item of rows) {
      const tab = item.indexOf('\t');
      if (tab < 0) continue;
      const [mode, type, oid] = item.slice(0, tab).split(' ');
      const name = item.slice(tab + 1);
      if (type === 'tree') continue;
      if (entries.length >= maxFiles) throw new Error('Raw import file cap reached; no partial manifest was published');
      const row: RawEntry = { repository: repo.path, path: name, oid, mode, status: 'unavailable' };
      entries.push(row);
      if (mode === '120000') { row.status = 'symlink'; missing++; continue; }
      if (type === 'commit') { row.status = 'gitlink'; missing++; continue; }
      if (type !== 'blob' || !/^[a-f0-9]{40,64}$/.test(oid)) { missing++; continue; }
      try {
        const size = Number(command(dir, ['cat-file', '-s', oid]).toString('utf8').trim());
        row.bytes = size;
        if (!Number.isSafeInteger(size) || size > maxBytes || totalBytes + size > maxBytes) {
          row.status = 'oversize'; missing++; continue;
        }
        const blob = command(dir, ['cat-file', 'blob', oid], size + 1024);
        if (blob.byteLength !== size) throw new Error('Git size mismatch');
        const digest = hash(blob);
        const dest = path.join(store, 'raw', digest.slice(0, 2), digest);
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
          const tmp = dest + '.tmp-' + randomUUID();
          fs.writeFileSync(tmp, blob, { mode: 0o600 });
          try { fs.linkSync(tmp, dest); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
          finally { fs.unlinkSync(tmp); }
        }
        if (hash(fs.readFileSync(dest)) !== digest) throw new Error('Raw blob checksum mismatch');
        row.sha256 = digest; row.status = 'materialized'; materialized++; totalBytes += size;
      } catch { missing++; }
    }
  }
  const result: RawImportManifest = {
    schemaVersion: 1, snapshotId, generatedAt: new Date().toISOString(),
    status: missing ? 'partial' : 'verified', total: entries.length,
    materialized, missing, entries, manifestHash: hash(JSON.stringify(entries)),
  };
  commitJson(manifestFile, result);
  return result;
}
export function verifyEnterpriseRaw(root: string, snapshotId: string): { ok: boolean; verified: number; failed: string[] } {
  const store = enterpriseStoreFor(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'imports', snapshotId + '.json'), 'utf8')) as RawImportManifest;
  if (manifest.manifestHash !== hash(JSON.stringify(manifest.entries))) throw new Error('Raw manifest corrupted');
  const failed: string[] = []; let verified = 0;
  for (const entry of manifest.entries) {
    if (!entry.sha256) { failed.push(entry.repository + '/' + entry.path + ': ' + entry.status); continue; }
    const file = path.join(store, 'raw', entry.sha256.slice(0, 2), entry.sha256);
    try { if (hash(fs.readFileSync(file)) !== entry.sha256) throw new Error('corrupt'); verified++; }
    catch { failed.push(entry.repository + '/' + entry.path + ': missing/corrupt blob'); }
  }
  return { ok: failed.length === 0, verified, failed };
}
