import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { enterpriseStoreFor, listEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import type { RawImportManifest } from './enterpriseImport.ts';

export interface QualityFinding {
  id: string; repository: string; file: string; commit: string; line: number;
  rule: string; severity: 'warning' | 'review'; summary: string; recommendation: string;
  source: 'deterministic'; evidence: string;
}
export interface QualityReport {
  snapshotId: string; status: 'verified' | 'partial'; analyzed: number;
  findings: QualityFinding[]; limitations: string[];
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const rules: Array<{id:string; pattern:RegExp; summary:string; recommendation:string}> = [
  {id:'JAVA_PRINT_STACKTRACE',pattern:/\.printStackTrace\s*\(/,summary:'生产代码直接打印异常堆栈',recommendation:'确认是否应使用统一结构化日志与异常处理'},
  {id:'JAVA_SYSTEM_OUT',pattern:/System\.(?:out|err)\.print(?:ln)?\s*\(/,summary:'生产代码直接输出到控制台',recommendation:'考虑使用带上下文字段的统一日志框架'},
  {id:'JAVA_THREAD_SLEEP',pattern:/Thread\.sleep\s*\(/,summary:'发现同步线程休眠',recommendation:'检查是否阻塞服务线程，并评估异步任务或超时机制'},
  {id:'SQL_SELECT_STAR',pattern:/\bSELECT\s+\*\s+FROM\b/i,summary:'SQL 使用 SELECT *',recommendation:'确认字段兼容、数据规模后按需显式选列'},
  {id:'SQL_DELETE_WITHOUT_WHERE',pattern:/^\s*DELETE\s+FROM\s+[\w.]+ *;?\s*$/i,summary:'可能存在无 WHERE 的 DELETE',recommendation:'人工确认是否为明确预期的全表删除；禁止自动修改'},
];
export function analyzeEnterpriseQuality(root: string,snapshotId:string,limit=2000):QualityReport {
  const snapshot=listEnterpriseSnapshots(root).find(x=>x.snapshotId===snapshotId);
  if(!snapshot)throw new Error('Unknown workspace snapshot');
  const home=enterpriseStoreFor(root);
  const manifest=JSON.parse(fs.readFileSync(path.join(home,'imports',snapshotId+'.json'),'utf8')) as RawImportManifest;
  const commits=new Map(snapshot.repositories.map(r=>[r.path,r.commit]));
  const findings:QualityFinding[]=[];let analyzed=0;
  const max=Math.max(1,Math.min(limit,10000));
  for(const entry of manifest.entries) {
    if(findings.length>=max)break;
    if(!entry.sha256|| !/\.(?:java|sql|xml)$/i.test(entry.path))continue;
    if(entry.bytes!==undefined&&entry.bytes>1024*1024)continue;
    const source=path.join(home,'raw',entry.sha256.slice(0,2),entry.sha256);
    let content:string;
    try{content=fs.readFileSync(source,'utf8');}catch{continue;}
    analyzed++;
    for(const [i,line] of content.split(/\r?\n/).entries()) {
      if(line.length>3000)continue;
      for(const rule of rules){
        if(!rule.pattern.test(line))continue;
        const commit=commits.get(entry.repository);
        if(!commit)continue;
        const finding:QualityFinding={
          id:sha([snapshotId,entry.repository,entry.path,i+1,rule.id].join(':')).slice(0,20),
          repository:entry.repository,file:entry.path,commit,line:i+1,rule:rule.id,
          severity:rule.id==='SQL_DELETE_WITHOUT_WHERE'?'review':'warning',
          summary:rule.summary,recommendation:rule.recommendation,
          source:'deterministic',evidence:line.trim().slice(0,320),
        };
        findings.push(finding);
        if(findings.length>=max)break;
      }
      if(findings.length>=max)break;
    }
  }
  const report:QualityReport={snapshotId,status:manifest.status==='verified'?'verified':'partial',
    analyzed,findings,limitations:[
      '静态启发式检查仅报告候选问题，不代表 AI 理解全部业务语义。',
      '仅检查已物化的 Raw 文件；缺失或超出预算的内容不被假定为无问题。',
      'SQL 动态拼接、跨方法调用、别名解析与运行时行为尚未覆盖。',
    ]};
  fs.mkdirSync(path.join(home,'derived'),{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(home,'derived',snapshotId+'-quality.json'),JSON.stringify(report,null,2),{mode:0o600});
  return report;
}
