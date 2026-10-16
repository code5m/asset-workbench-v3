import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runGuardedProcess } from './enterpriseSubprocess.ts';
import { APP_ROOT } from './config.ts';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest } from './enterpriseImport.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
interface RawEvent {
  kind: 'class' | 'method' | 'call' | 'unresolved-definition' | 'unresolved-call' | 'diagnostic' | 'status';
  file: string; line: number; symbol: string; label: string; caller?: string;
}
export interface SymbolCallEdge {
  from: string; to: string; crossRepository: boolean;
  evidence: { repository: string; path: string; commit: string; line: number };
}
export interface SymbolIndexResult {
  engine: 'jdk-compiler-attribution';
  snapshotId: string;
  status: 'verified' | 'partial' | 'blocked';
  indexedJavaFiles: number; excludedJavaFiles: number;
  declarations: number; resolvedCallEdges: number; crossRepositoryEdges: number;
  unresolvedCalls: number; externalCalls: number; diagnostics: string[];
  edges: SymbolCallEdge[];
  reason?: string;
}
function safeRelative(p: string) {
  if (!p || p.startsWith('/') || p.includes('\\') || p.includes('\0')
    || p.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Unsafe source path in Raw manifest');
}
export async function buildEnterpriseJavaSymbolGraph(root: string, snapshotId: string, maxFiles = 3500): Promise<SymbolIndexResult> {
  const snapshot = listEnterpriseSnapshots(root).find(x => x.snapshotId === snapshotId);
  if (!snapshot) throw new Error('Unknown frozen Snapshot');
  const store = enterpriseStoreFor(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'imports', snapshotId + '.json'), 'utf8')) as RawImportManifest;
  const countLimit = Math.min(5000, Math.max(1, maxFiles));
  const sourceRoot = path.join(store, 'semantic', snapshotId, 'java');
  fs.mkdirSync(sourceRoot, { recursive: true, mode: 0o700 });
  const byStagedPath = new Map<string, { repository: string; path: string; commit: string }>();
  const commits = new Map(snapshot.repositories.map(v => [v.path, v.commit]));
  const relevant = manifest.entries.filter(e => e.path.endsWith('.java'));
  let excludedJavaFiles = 0;
  let stagedBytes = 0;
  for (const item of relevant) {
    if (byStagedPath.size >= countLimit) { excludedJavaFiles++; continue; }
    if (!item.sha256 || !item.bytes || item.bytes > 1024 * 1024 || stagedBytes + item.bytes > 64 * 1024 * 1024) {
      excludedJavaFiles++; continue;
    }
    safeRelative(item.path);
    const commit = commits.get(item.repository);
    if (!commit) { excludedJavaFiles++; continue; }
    const prefix = 'repo-' + sha(item.repository || '.').slice(0, 16);
    const rel = prefix + '/' + item.path;
    const target = path.join(sourceRoot, ...rel.split('/'));
    const blob = path.join(store, 'raw', item.sha256.slice(0, 2), item.sha256);
    try {
      const source = fs.readFileSync(blob);
      if (createHash('sha256').update(source).digest('hex') !== item.sha256) throw new Error('Invalid Raw blob');
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      if (fs.existsSync(target)) {
        if (!fs.readFileSync(target).equals(source)) throw new Error('Staged source collision');
      } else fs.writeFileSync(target, source, { flag: 'wx', mode: 0o600 });
      byStagedPath.set(rel, { repository: item.repository, path: item.path, commit });
      stagedBytes += source.length;
    } catch { excludedJavaFiles++; }
  }
  const outputFile = path.join(store, 'semantic', snapshotId, 'java-events.jsonl');
  const base: SymbolIndexResult = {
    engine: 'jdk-compiler-attribution', snapshotId, status: 'blocked', indexedJavaFiles: byStagedPath.size,
    excludedJavaFiles, declarations: 0, resolvedCallEdges: 0, crossRepositoryEdges: 0,
    unresolvedCalls: 0, externalCalls: 0, diagnostics: [], edges: [],
  };
  if (!byStagedPath.size) return { ...base, reason: '没有可分析的 Java Raw 文件。请先完整归档快照。' };
  const javaFile = path.join(APP_ROOT, 'tools', 'semantic', 'SymbolIndexer.java');
  const run = await runGuardedProcess('java', ['-Xmx1024m', javaFile, sourceRoot, outputFile], {
    cwd: APP_ROOT, timeoutMs: 180_000, maxOutputBytes: 2 * 1024 * 1024,
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG: 'C.UTF-8' },
  });
  if (run.error || run.exit !== 0 || !fs.existsSync(outputFile)) {
    return { ...base, reason: 'JavaCompiler 语义解析不可用，请检查 JDK 17+ 和分析预算。',
      diagnostics: [(run.error || run.stderr || 'JavaCompiler failed').slice(0, 600)] };
  }
  const events = fs.readFileSync(outputFile, 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x) as RawEvent);
  const methods = new Map<string, Array<{ repository: string; path: string; commit: string; line: number }>>();
  for (const item of events.filter(v => v.kind === 'method' && v.symbol)) {
    const source = byStagedPath.get(item.file);
    if (!source) continue;
    const current = methods.get(item.symbol) ?? [];
    current.push({ ...source, line: item.line }); methods.set(item.symbol, current);
  }
  const edges: SymbolCallEdge[] = [], diagnostics: string[] = [];
  let unresolvedCalls = 0, externalCalls = 0;
  for (const item of events) {
    if (item.kind === 'diagnostic') {
      if (diagnostics.length < 100) diagnostics.push(item.label);
    }
    if (item.kind === 'unresolved-call') unresolvedCalls++;
    if (item.kind !== 'call') continue;
    const source = byStagedPath.get(item.file);
    const sources = methods.get(item.caller || '') ?? [];
    const targets = methods.get(item.symbol) ?? [];
    if (!source || !item.caller || sources.length !== 1 || targets.length !== 1) {
      if (!targets.length) externalCalls++; else unresolvedCalls++;
      continue;
    }
    const target = targets[0];
    const edge: SymbolCallEdge = {
      from: item.caller!, to: item.symbol, crossRepository: source.repository !== target.repository,
      evidence: { ...source, line: item.line },
    };
    edges.push(edge);
  }
  edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const result: SymbolIndexResult = {
    ...base, status: manifest.status === 'verified' && excludedJavaFiles === 0
      && unresolvedCalls === 0 && diagnostics.length === 0 ? 'verified' : 'partial',
    declarations: Array.from(methods.values()).reduce((n, methods) => n + methods.length, 0),
    resolvedCallEdges: edges.length, crossRepositoryEdges: edges.filter(x => x.crossRepository).length,
    unresolvedCalls, externalCalls, diagnostics, edges,
  };
  const target = path.join(store, 'derived', snapshotId + '-java-symbols.json');
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  return result;
}
