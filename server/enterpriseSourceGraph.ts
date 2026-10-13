import fs from 'node:fs';
import path from 'node:path';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest } from './enterpriseImport.ts';
type Provenance={repository:string;path:string;commit:string;line:number};
type Node={id:string;kind:'java-class'|'java-method'|'sql-table';name:string;source:Provenance};
type Edge={from:string;to:string;kind:'declares'|'same-class-call'|'sql-read'|'sql-write';evidence:Provenance};
export interface SourceGraph{snapshotId:string;status:'partial'|'verified';nodes:Node[];edges:Edge[];limitations:string[];analyzedFiles:number;}
/** Evidence-first source index: no claim of resolved polymorphism, bindings or dynamic SQL. */
export function buildEnterpriseSourceGraph(root:string,snapshotId:string,maxFiles=4000):SourceGraph{
 const snapshot=listEnterpriseSnapshots(root).find(x=>x.snapshotId===snapshotId);
 if(!snapshot)throw new Error('Snapshot missing');
 const store=enterpriseStoreFor(root);
 const manifest=JSON.parse(fs.readFileSync(path.join(store,'imports',snapshotId+'.json'),'utf8')) as RawImportManifest;
 const commits=new Map(snapshot.repositories.map(x=>[x.path,x.commit]));
 const nodes:Node[]=[],edges:Edge[]=[];let analyzedFiles=0;
 for(const item of manifest.entries){
  if(analyzedFiles>=maxFiles)break;
  if(!item.sha256||!/\.(?:java|sql|xml)$/i.test(item.path)||((item.bytes??0)>2*1024*1024))continue;
  let code='';
  try{code=fs.readFileSync(path.join(store,'raw',item.sha256.slice(0,2),item.sha256),'utf8');}catch{continue;}
  analyzedFiles++;
  const source=(line:number):Provenance=>({repository:item.repository,path:item.path,commit:commits.get(item.repository)??'',line});
  const lines=code.split(/\r?\n/);
  const classes: Array<{id:string;name:string;line:number}>=[];
  const methods: Array<{id:string;name:string;classId:string;line:number;end:number}>=[];
  if(item.path.endsWith('.java')){
   for(let i=0;i<lines.length;i++){
    const line=lines[i].replace(/\/\/.*$/,'');
    const cls=/\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if(cls){const id=item.repository+':'+item.path+'#'+cls[1];classes.push({id,name:cls[1],line:i+1});nodes.push({id,kind:'java-class',name:cls[1],source:source(i+1)});}
    // Conservative declaration candidate, exclude flow-control and constructors.
    const m=/\b(?:public|private|protected)\s+(?:(?:static|final|synchronized|abstract|native|default)\s+)*(?:[\w<>\[\],.?]+)\s+([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?:throws\s+[\w,.\s]+)?\s*\{?/.exec(line);
    const clsLast=classes[classes.length-1];
    if(m&&clsLast&&!['if','for','while','switch','catch'].includes(m[1])){
     const id=clsLast.id+'#'+m[1]+'@'+(i+1);
     methods.push({id,name:m[1],classId:clsLast.id,line:i+1,end:lines.length});
     nodes.push({id,kind:'java-method',name:m[1],source:source(i+1)});
     edges.push({from:clsLast.id,to:id,kind:'declares',evidence:source(i+1)});
    }
   }
   for(let k=0;k<methods.length;k++){
    const method=methods[k];method.end=(methods[k+1]?.line ?? (lines.length+1))-1;
    for(let i=method.line;i<Math.min(method.end,lines.length);i++){
     const line=lines[i].replace(/\/\/.*$/,'');
     for(const target of methods){
      if(target.id===method.id)continue;
      if(new RegExp('(?:\\bthis\\.|(?<![\\w$])\\b)'+target.name+'\\s*\\(').test(line)){
       edges.push({from:method.id,to:target.id,kind:'same-class-call',evidence:source(i+1)});
      }
     }
    }
   }
  }
  if(/\.(?:sql|xml)$/i.test(item.path)){
   for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    for(const match of line.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([\w.]+)/gi)){
     const table=match[1],keyword=match[0].split(/\s+/)[0].toUpperCase();
     const id='table:'+table.toLowerCase();
     if(!nodes.some(n=>n.id===id))nodes.push({id,kind:'sql-table',name:table,source:source(i+1)});
     edges.push({from:item.repository+':'+item.path,to:id,kind:keyword==='FROM'||keyword==='JOIN'?'sql-read':'sql-write',evidence:source(i+1)});
    }
   }
  }
 }
 const result:SourceGraph={snapshotId,status:manifest.status==='verified'&&analyzedFiles<maxFiles?'verified':'partial',nodes,edges,analyzedFiles,
  limitations:['启发式 Java 源码分析：方法调用只提供候选线索，未解析重载、作用域、多态、跨仓符号、注解与生成代码。','SQL 仅提取显式表名候选，复杂 SQL、MyBatis 动态语句与数据血缘尚不可证明。','只基于已归档 Raw 文件；缺失对象不算通过。']};
 const target=path.join(store,'derived',snapshotId+'-sourcegraph.json');fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,JSON.stringify(result,null,2));
 return result;
}
