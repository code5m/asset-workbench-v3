import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {enterpriseStoreFor,listEnterpriseSnapshots} from './enterpriseWorkspace.ts';
import type {RawImportManifest} from './enterpriseImport.ts';

/** Narrow semantic-preserving experiment only; never edits enterprise business checkout. */
export function runEnterpriseOptimizationExperiment(root:string,snapshotId:string,limit=100){
 const snap=listEnterpriseSnapshots(root).find(x=>x.snapshotId===snapshotId);
 if(!snap)throw new Error('Unknown snapshot');
 const store=enterpriseStoreFor(root);
 const manifest=JSON.parse(fs.readFileSync(path.join(store,'imports',snapshotId+'.json'),'utf8')) as RawImportManifest;
 const files:Array<{repository:string;path:string;commit:string;originalSha:string;optimizedSha:string;removedWhitespaceBytes:number}>=[];
 const commits=new Map(snap.repositories.map(r=>[r.path,r.commit]));
 const scope=manifest.entries.filter(x=>x.sha256&&/\.(?:java|sql|xml|ts|tsx|js)$/i.test(x.path)).slice(0,Math.min(1000,Math.max(1,limit)));
 let checked=0,changed=0,bytesRemoved=0;
 for(const item of scope){
  if(!item.sha256||((item.bytes??0)>1024*1024))continue;
  let original:Buffer;
  try{original=fs.readFileSync(path.join(store,'raw',item.sha256.slice(0,2),item.sha256));}catch{continue;}
  checked++;
  // Byte preserving except trailing spaces/tabs on lines; no executable code rewrite.
  const content=original.toString('utf8');
  if(Buffer.from(content).compare(original)!==0)continue;
  const next=content.replace(/[ \t]+(?=\r?\n|$)/g,'');
  if(next===content)continue;
  const optimized=Buffer.from(next);
  const originalSha=createHash('sha256').update(original).digest('hex');
  const optimizedSha=createHash('sha256').update(optimized).digest('hex');
  const repoCommit=commits.get(item.repository)??'';
  files.push({repository:item.repository,path:item.path,commit:repoCommit,originalSha,optimizedSha,
    removedWhitespaceBytes:original.length-optimized.length});
  changed++;bytesRemoved+=original.length-optimized.length;
  const out=path.join(store,'experiments',snapshotId,optimizedSha.slice(0,2),optimizedSha);
  fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});
  if(!fs.existsSync(out))fs.writeFileSync(out,optimized,{flag:'wx',mode:0o600});
  if(createHash('sha256').update(fs.readFileSync(out)).digest('hex')!==optimizedSha)
   throw new Error('Experiment content integrity failed');
 }
 const report={snapshotId,mode:'isolated-whitespace-only',checked,changed,bytesRemoved,files,
   status:manifest.status==='verified'?'verified-preview':'partial-preview',
   testEvidence:'byte-accurate content addressing and deterministic whitespace normalization',
   limitations:['未在业务仓库运行 Maven/Gradle/集成测试；不允许自动宣称行为等价。','不修改原始文件；只有经验候选，必须经业务测试和审查才能被采用。']};
 const dir=path.join(store,'experiments');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 fs.writeFileSync(path.join(dir,snapshotId+'-whitespace.json'),JSON.stringify(report,null,2),{mode:0o600});
 return report;
}
