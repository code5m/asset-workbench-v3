import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';

export type Stage = 'observed' | 'proposed' | 'experimented' | 'verified' | 'rejected' | 'promoted';
export interface EvolutionCase {
  schemaVersion: 1; id: string; snapshotId: string; scope: 'project' | 'framework-candidate';
  title: string; problem: string; evidence: Array<{ repository: string; path: string; commit: string }>;
  proposal?: string; experiment?: string; verification?: string; stage: Stage;
  history: Array<{ at: string; stage: Stage; note: string }>;
}
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const safe = (id: string) => { if (!/^evo-[a-f0-9]{24}$/.test(id)) throw new Error('Invalid evolution ID'); return id; };
const caseDir = (root: string) => path.join(enterpriseStoreFor(root), 'evolution');
function checkEvidence(root: string, snapshotId: string, evidence: EvolutionCase['evidence']) {
  const snap = listEnterpriseSnapshots(root).find(s=>s.snapshotId===snapshotId);
  if (!snap) throw new Error('Frozen snapshot is required');
  if (!evidence.length) throw new Error('At least one pinned source reference is required');
  for (const e of evidence) {
    const match = snap.repositories.find(r=>r.path===e.repository && r.commit===e.commit);
    if (!match || !e.path || e.path.startsWith('/') || e.path.includes('..') || e.path.includes('\\'))
      throw new Error('Evidence must reference a valid pinned repository commit and relative file');
    const repoDir = fs.realpathSync(path.join(root, e.repository));
    if (repoDir !== fs.realpathSync(root) && !repoDir.startsWith(fs.realpathSync(root) + path.sep))
      throw new Error('Evidence repository escaped source workspace');
    try {
      execFileSync('git', ['-C', repoDir, 'cat-file', '-e', e.commit + ':' + e.path], {
        timeout:5000, stdio:['ignore','ignore','ignore'],
        env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
      });
    } catch { throw new Error('Evidence source file does not exist in the pinned Git commit: '+e.repository+'/'+e.path); }
  }
}
export function listEvolutionCases(root: string): EvolutionCase[] {
  const dir = caseDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>/^evo-[a-f0-9]{24}\.json$/.test(f))
    .map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) as EvolutionCase)
    .sort((a,b)=>b.history[0].at.localeCompare(a.history[0].at));
}
export function createEvolutionCase(root: string, data: {
  snapshotId: string; title: string; problem: string; evidence: EvolutionCase['evidence'];
}): EvolutionCase {
  if (!data.title.trim() || !data.problem.trim()) throw new Error('Title and problem are required');
  checkEvidence(root,data.snapshotId,data.evidence);
  const now = new Date().toISOString();
  const id='evo-'+digest(JSON.stringify({ snapshotId:data.snapshotId, title:data.title, evidence:data.evidence })).slice(0,24);
  const file=path.join(caseDir(root),id+'.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file,'utf8')) as EvolutionCase;
  const item: EvolutionCase = {
    schemaVersion:1,id,snapshotId:data.snapshotId,title:data.title.trim(),problem:data.problem.trim(),
    evidence:data.evidence,scope:'project',stage:'observed',history:[{at:now,stage:'observed',note:'Evidence recorded'}],
  };
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  try {fs.writeFileSync(file,JSON.stringify(item,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  return JSON.parse(fs.readFileSync(file,'utf8')) as EvolutionCase;
}
export function advanceEvolutionCase(root: string, id: string, next: Stage, note: string): EvolutionCase {
  if(!note.trim())throw new Error('Verification or decision note required');
  const file=path.join(caseDir(root),safe(id));
  const filepath=file+'.json';
  const item=JSON.parse(fs.readFileSync(filepath,'utf8')) as EvolutionCase;
  const nextAllowed: Record<Stage,Stage[]> = {
    observed:['proposed','rejected'], proposed:['experimented','rejected'],
    experimented:['verified','rejected'], verified:['promoted','rejected'],
    rejected:[],promoted:[],
  };
  if(!nextAllowed[item.stage].includes(next))throw new Error('Invalid evolution transition: '+item.stage+' -> '+next);
  if(next==='promoted'){
    if(item.scope!=='framework-candidate')throw new Error('Only a reviewed Framework candidate can be promoted');
    if(!item.verification)throw new Error('Verified evidence is required before Framework promotion');
  }
  if(next==='verified')item.verification=note.trim();
  if(next==='proposed')item.proposal=note.trim();
  if(next==='experimented')item.experiment=note.trim();
  item.stage=next;
  item.history.push({at:new Date().toISOString(),stage:next,note:note.trim()});
  const tmp=filepath+'.tmp-'+randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(item,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,filepath);
  return item;
}
export function nominateFrameworkCandidate(root: string, id: string): EvolutionCase {
  const filepath=path.join(caseDir(root),safe(id)+'.json');
  const item=JSON.parse(fs.readFileSync(filepath,'utf8')) as EvolutionCase;
  if(item.stage!=='verified')throw new Error('Only verified project cases can be nominated');
  item.scope='framework-candidate';
  const tmp=filepath+'.tmp-'+randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(item,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,filepath);
  return item;
}
