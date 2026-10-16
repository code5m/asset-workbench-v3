import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { APP_ROOT } from './config.ts';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest } from './enterpriseImport.ts';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
export interface DynamicSqlStatement {
  file: string; statement: string; conditions: string[];
  reads: string[]; writes: string[]; columns: string[];
  dynamicIdentifiers: string[]; parseError: string | null; complete: boolean;
  provenance?: { repository: string; path: string; commit: string };
}
export interface DynamicSqlReport {
  engine: 'sqlglot-mybatis-symbolic'; status: 'verified' | 'partial' | 'blocked';
  analyzedFiles: number; statements: DynamicSqlStatement[]; errors: string[];
  limitations: string[]; excludedFiles?: number; reason?: string;
}

function checkedRelative(value: string) {
  if (!value || value.startsWith('/') || value.includes('\\') || value.includes('\0')
    || value.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Unsafe source path');
}
export function buildEnterpriseDynamicSqlLineage(root: string, snapshotId: string, maxFiles = 2000): DynamicSqlReport {
  const snapshot = listEnterpriseSnapshots(root).find(v => v.snapshotId === snapshotId);
  if (!snapshot) throw new Error('Unknown immutable workspace snapshot');
  const store = enterpriseStoreFor(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'imports', snapshotId + '.json'), 'utf8')) as RawImportManifest;
  const stage = path.join(store, 'semantic', snapshotId, 'sql');
  fs.mkdirSync(stage, { recursive: true, mode: 0o700 });
  const reverse = new Map<string, { repository: string; path: string; commit: string }>();
  const commits = new Map(snapshot.repositories.map(r => [r.path, r.commit]));
  const all = manifest.entries.filter(v => /\.(?:sql|xml)$/i.test(v.path));
  let excludedFiles = 0;
  const cap = Math.min(3000, Math.max(1, maxFiles));
  for (const entry of all) {
    if (reverse.size >= cap || !entry.sha256 || !entry.bytes || entry.bytes > 2 * 1024 * 1024) { excludedFiles++; continue; }
    checkedRelative(entry.path);
    const commit = commits.get(entry.repository);
    if (!commit) { excludedFiles++; continue; }
    const relative = 'repo-' + sha(entry.repository || '.').slice(0, 16) + '/' + entry.path;
    const target = path.join(stage, ...relative.split('/'));
    try {
      const content = fs.readFileSync(path.join(store, 'raw', entry.sha256.slice(0, 2), entry.sha256));
      if (createHash('sha256').update(content).digest('hex') !== entry.sha256) throw new Error('Invalid Raw content checksum');
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(target)) fs.writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
      else if (!fs.readFileSync(target).equals(content)) throw new Error('Existing staged SQL file mismatch');
      reverse.set(relative, { repository: entry.repository, path: entry.path, commit });
    } catch { excludedFiles++; }
  }
  const base: DynamicSqlReport = { engine: 'sqlglot-mybatis-symbolic', status: 'blocked',
    analyzedFiles: 0, statements: [], errors: [], limitations: [], excludedFiles };
  if (!reverse.size) return { ...base, reason: '没有可解析的 XML/SQL Raw 文件。请先归档。' };
  const output = path.join(store, 'semantic', snapshotId, 'dynamic-sql.json');
  const venvPython = path.join(APP_ROOT, '.asset-workbench-data', 'toolchains', 'sql-python', 'bin', 'python3');
  const python = fs.existsSync(venvPython) ? venvPython : 'python3';
  const run = spawnSync(python,
    [path.join(APP_ROOT, 'tools', 'semantic', 'mybatis_lineage.py'), stage, output], {
    cwd: APP_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 150_000,
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG: 'C.UTF-8', PYTHONNOUSERSITE: '0' },
  });
  if (run.error || run.status !== 0 || !fs.existsSync(output)) {
    return { ...base, reason: 'MyBatis / SQLGlot 解析引擎不可用。请安装 Python3 和 tools/semantic/requirements.txt。',
      errors: [(run.error?.message || run.stderr || 'SQL parser failed').slice(0, 600)] };
  }
  const report = JSON.parse(fs.readFileSync(output, 'utf8')) as DynamicSqlReport;
  for (const statement of report.statements) {
    const source = reverse.get(statement.file);
    if (source) statement.provenance = source;
    else { report.errors.push('SQL source provenance missing: ' + statement.file); report.status = 'partial'; }
  }
  report.excludedFiles = excludedFiles;
  if (manifest.status !== 'verified' || excludedFiles) report.status = 'partial';
  const dest = path.join(store, 'derived', snapshotId + '-dynamic-sql.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  fs.writeFileSync(dest, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  return report;
}
