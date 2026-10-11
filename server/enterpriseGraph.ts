import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest } from './enterpriseImport.ts';

export interface MavenModule { repository: string; pom: string; groupId?: string; artifactId?: string; version?: string; dependencies: string[]; modules: string[]; }
export interface EnterpriseGraph {
  schemaVersion: 1; snapshotId: string; status: 'verified' | 'partial'; generatedAt: string;
  modules: MavenModule[]; edges: Array<{ from: string; to: string; type: 'maven-dependency' | 'maven-module' }>;
  missing: string[]; fingerprint: string;
}
const tag = (xml: string, name: string) => {
  const m = new RegExp('<(?:[\\w-]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?' + name + '\\s*>').exec(xml);
  return m?.[1]?.trim();
};
const blocks = (xml: string, name: string) => Array.from(xml.matchAll(new RegExp('<' + name + '\\s*>([\\s\\S]*?)<\\/' + name + '\\s*>', 'g')), m => m[1]);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const identity = (m: MavenModule) => [m.groupId ?? '?', m.artifactId ?? '?'].join(':');
/** Incremental deterministic Maven-level CodeGraph from pinned Raw files, not working tree. */
export function buildEnterpriseMavenGraph(root: string, snapshotId: string): EnterpriseGraph {
  const store = enterpriseStoreFor(root);
  if (!listEnterpriseSnapshots(root).some(x => x.snapshotId === snapshotId)) throw new Error('Unknown snapshot');
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'imports', snapshotId + '.json'), 'utf8')) as RawImportManifest;
  const modules: MavenModule[] = [];
  const missing: string[] = [];
  for (const entry of manifest.entries) {
    if (path.posix.basename(entry.path) !== 'pom.xml') continue;
    if (!entry.sha256) { missing.push(entry.repository + '/' + entry.path + ' missing RAW'); continue; }
    const file = path.join(store, 'raw', entry.sha256.slice(0,2), entry.sha256);
    try {
      const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      const project = source.match(/<project(?:\s[^>]*)?>([\s\S]*?)<\/project>/)?.[1] ?? source;
      const dependenciesSection = tag(project, 'dependencies') ?? '';
      const depend = blocks(dependenciesSection, 'dependency');
      const moduleSection = tag(project, 'modules') ?? '';
      const parent = tag(project, 'parent') ?? '';
      const noParent = project.replace(/<parent(?:\s[^>]*)?>[\s\S]*?<\/parent>/, '');
      modules.push({
        repository: entry.repository, pom: entry.path,
        groupId: tag(noParent, 'groupId') ?? tag(parent, 'groupId'),
        artifactId: tag(noParent, 'artifactId'),
        version: tag(noParent, 'version') ?? tag(parent, 'version'),
        dependencies: depend.map(d => [tag(d,'groupId'), tag(d,'artifactId')].join(':'))
          .filter(x => !x.includes('undefined')),
        modules: blocks(moduleSection, 'module').map(x => x.trim()),
      });
    } catch { missing.push(entry.repository + '/' + entry.path + ' could not parse'); }
  }
  const byCoordinates = new Map(modules.filter(m => m.groupId && m.artifactId).map(m => [identity(m), m]));
  const byLocation = new Map(modules.map(m => [m.repository + '/' + m.pom, m]));
  const edges: EnterpriseGraph['edges'] = [];
  for (const m of modules) {
    const from = m.repository + '/' + m.pom;
    for (const dep of m.dependencies) {
      const target = byCoordinates.get(dep);
      if (target) edges.push({ from, to: target.repository + '/' + target.pom, type:'maven-dependency' });
    }
    for (const child of m.modules) {
      const key = path.posix.normalize(path.posix.join(path.posix.dirname(m.pom), child, 'pom.xml'));
      const target = byLocation.get(m.repository + '/' + key);
      if (target) edges.push({ from, to: target.repository + '/' + target.pom, type:'maven-module' });
    }
  }
  modules.sort((a,b) => (a.repository + '/' + a.pom).localeCompare(b.repository + '/' + b.pom));
  edges.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const fingerprint = hash(JSON.stringify({ modules, edges, missing }));
  const result: EnterpriseGraph = { schemaVersion: 1, snapshotId, generatedAt: new Date().toISOString(),
    status: manifest.status === 'verified' && !missing.length ? 'verified' : 'partial',
    modules, edges, missing, fingerprint };
  const target = path.join(store, 'derived', snapshotId + '-maven.json');
  fs.mkdirSync(path.dirname(target), { recursive:true, mode:0o700 });
  fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { mode:0o600 });
  return result;
}
