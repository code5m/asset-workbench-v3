import { useEffect, useState } from 'react';
import { GitBranch, RefreshCw, ShieldCheck, GitCompareArrows } from 'lucide-react';
import { assetClient } from '../services/assetClient';

type Discovery = Awaited<ReturnType<typeof assetClient.enterpriseDiscovery>>;
type Snapshot = Awaited<ReturnType<typeof assetClient.enterpriseSnapshots>>['snapshots'][number];
type Comparison = Awaited<ReturnType<typeof assetClient.enterpriseCompare>>;

export function EnterpriseWorkspacePanel() {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedBefore, setSelectedBefore] = useState('');
  const [selectedAfter, setSelectedAfter] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [verification, setVerification] = useState('');
  const [error, setError] = useState('');
  const [pipeline, setPipeline] = useState('');
  const [evolution, setEvolution] = useState<Array<{ id: string; title: string; stage: string; scope: string }>>([]);
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [evidenceRepo, setEvidenceRepo] = useState('');
  const [evidencePath, setEvidencePath] = useState('');
  const [note, setNote] = useState('');

  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [result, versions] = await Promise.all([assetClient.enterpriseDiscovery(), assetClient.enterpriseSnapshots()]);
    setDiscovery(result);
    setSnapshots(versions.snapshots);
    setSelectedAfter((s) => s || versions.snapshots[0]?.snapshotId || '');
    setSelectedBefore((s) => s || versions.snapshots[1]?.snapshotId || versions.snapshots[0]?.snapshotId || '');
  };
  useEffect(() => { void refresh().catch((e: unknown) => setError(String(e))); }, []);
  const reloadEvolution = async () => {
    const answer = await assetClient.enterpriseGet<{ cases: Array<{ id: string; title: string; stage: string; scope: string }> }>('evolution');
    setEvolution(answer.cases);
  };
  useEffect(() => {void reloadEvolution().catch(() => undefined);}, []);

  const action = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <section className="panel" aria-label="企业多仓库工作区">
      <div className="section-heading"><div><p className="eyebrow">企业生产项目</p>
        <h2>多仓库版本与演进基线</h2></div>
        <GitBranch size={25} /></div>
      <p className="detail-summary">只读取本地 Git 对象，不执行 fetch、checkout 或修改业务代码。快照固定每个仓库的 commit 和 tree；元数据保存在中央管理目录。</p>
      <div className="topbar-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void action(refresh)}><RefreshCw size={16}/>重新发现仓库</button>
        <button type="button" className="secondary-button" disabled={busy || !discovery?.repositories.length} onClick={() => void action(async () => { await assetClient.freezeEnterprise('head'); await refresh(); })}><ShieldCheck size={16}/>冻结当前 HEAD</button>
        <button type="button" className="secondary-button" disabled={busy || !discovery?.repositories.length} onClick={() => void action(async () => { await assetClient.freezeEnterprise('origin-tracking'); await refresh(); })}>冻结本地 origin 跟踪分支</button>
      </div>
      <p className="detail-summary">发现 {discovery?.repositories.length ?? '—'} 个仓库；已冻结 {snapshots.length} 个不同版本。未执行远端刷新，不代表远端最新状态。</p>
      {discovery?.warnings.map((msg) => <p key={msg} role="status">{msg}</p>)}
      {error ? <p role="alert" className="detail-summary">{error}</p> : null}
      <div className="repository-list">
        {discovery?.repositories.map((repo) => (
          <div className="repository-row" key={repo.path}>
            <div className="repo-main"><GitBranch size={16}/><div><strong>{repo.path || '工作区根仓库'}</strong><small>{repo.remote || '未配置 origin'}</small></div></div>
            <div className="repo-ref"><span>{repo.branch || 'detached HEAD'}</span><code>{repo.headCommit.slice(0,12)}</code></div>
            <span>{repo.dirty ? '存在未提交更改（不会进入快照）' : '工作区干净'}</span>
          </div>
        ))}
      </div>
      {snapshots.length > 0 ? <section className="workspace-card">
        <h3>归档与 Maven 架构认知</h3>
        <p className="detail-summary">从固定的 Git commit 导入受管 Raw；大小超限或缺失会标为 partial，不会伪装完整。只有实际导入的数据才能进入 Maven 模块分析。</p>
        <div className="topbar-actions">
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const result = await assetClient.enterpriseCommand<{ results: Array<{status:string;reason?:string}> }>('mirrors/sync',{snapshotId:selectedAfter});
            const failed=result.results.filter(r=>r.status!=='verified');
            setPipeline('本地镜像归档：'+(result.results.length-failed.length)+'/'+result.results.length+' 已验证。'+(failed.length?'失败：'+failed.map(x=>x.reason).join('；'):''));
          })}>建立或更新本地受管 Git 镜像</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const result = await assetClient.enterpriseCommand<{ status: string; total: number; materialized: number; missing: number }>('raw/import', { snapshotId: selectedAfter });
            setPipeline('Raw '+result.status+'：'+result.materialized+'/'+result.total+' 文件；未物化 '+result.missing);
          })}>归档当前快照 Raw</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const graph = await assetClient.enterpriseCommand<{ status: string; modules: unknown[]; edges: unknown[] }>('graph/build',{snapshotId:selectedAfter});
            setPipeline('Maven '+graph.status+'：'+graph.modules.length+' 个 POM 模块，'+graph.edges.length+' 条可验证关系');
          })}>分析 Maven 模块关系</button>
        </div>
        {pipeline ? <p role="status">{pipeline}</p> : null}
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const result = await assetClient.enterpriseCommand<{ findings:Array<{summary:string;file:string;line:number}>;analyzed:number;status:string }>('quality/analyze',{snapshotId:selectedAfter});
          setPipeline('静态质量分析：'+result.analyzed+' 个已归档代码文件，'+result.findings.length+' 个候选问题，状态 '+result.status+'；首个发现：'+(result.findings[0] ? result.findings[0].file+':'+result.findings[0].line+' '+result.findings[0].summary : '无'));
        })}>扫描代码质量候选问题</button>
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const graph=await assetClient.enterpriseCommand<{nodes:unknown[];edges:unknown[];status:string}>('sourcegraph/build',{snapshotId:selectedAfter});
          setPipeline('源码关系候选：'+graph.nodes.length+' 节点、'+graph.edges.length+' 边；'+graph.status+'。复杂 Java/SQL 解析尚未完成。');
        })}>建立源码调用与 SQL 候选索引</button>
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const report=await assetClient.enterpriseCommand<{checked:number;changed:number;bytesRemoved:number;status:string}>('optimization/experiment',{snapshotId:selectedAfter});
          setPipeline('隔离优化实验：'+report.checked+' 个文件，候选优化 '+report.changed+' 个，节约空白字节 '+report.bytesRemoved+'；未改动业务源码。');
        })}>运行隔离优化实验</button>
        <h3>问题与 Framework 演进</h3>
        <p className="detail-summary">先绑定真实 Git 版本和文件证据。记录问题、实验、验证后才能提交通用能力候选。绝不自动修改业务代码。</p>
        <input aria-label="问题标题" value={title} placeholder="问题标题" onChange={e => setTitle(e.target.value)}/>
        <textarea aria-label="问题描述" value={problem} placeholder="描述问题以及判断依据" onChange={e => setProblem(e.target.value)}/>
        <select aria-label="证据来源仓库" value={evidenceRepo} onChange={e=>setEvidenceRepo(e.target.value)}>
          <option value="">选择证据仓库</option>
          {snapshots.find(s=>s.snapshotId===selectedAfter)?.repositories.map(r=><option key={r.path} value={r.path}>{r.path || '(根仓库)'}</option>)}
        </select>
        <input aria-label="证据文件路径" value={evidencePath} placeholder="Git 提交中真实存在的文件相对路径，如 pom.xml" onChange={e=>setEvidencePath(e.target.value)}/>
        <button className="secondary-button" disabled={busy || !selectedAfter || !title.trim() || !problem.trim() || !evidenceRepo || !evidencePath.trim()} onClick={() => void action(async () => {
          const snapshot = snapshots.find(s=>s.snapshotId===selectedAfter);
          const repo = snapshot?.repositories.find(r=>r.path===evidenceRepo);
          if (!repo) throw new Error('缺少快照仓库');
          await assetClient.enterpriseCommand('evolution/create', {snapshotId:selectedAfter,title,problem,
            evidence:[{repository:repo.path,path:evidencePath.trim(),commit:repo.commit}]});
          await reloadEvolution(); setTitle(''); setProblem(''); setEvidencePath('');
        })}>保存带版本来源的问题</button>
        <input aria-label="阶段依据" value={note} placeholder="记录实验、评估、验证依据" onChange={e=>setNote(e.target.value)}/>
        {evolution.map(item=><div className="repository-row" key={item.id}>
          <strong>{item.title}</strong><span>{item.stage} / {item.scope}</span>
          <button className="secondary-button" disabled={busy || !note.trim() || ['promoted','rejected'].includes(item.stage)} onClick={()=>void action(async ()=>{
            const transitions:Record<string,string>={observed:'proposed',proposed:'experimented',experimented:'verified',verified:'promoted'};
            if(item.stage==='verified' && item.scope!=='framework-candidate'){
              await assetClient.enterpriseCommand('evolution/nominate',{id:item.id});
            } else {
              await assetClient.enterpriseCommand('evolution/advance',{id:item.id,stage:transitions[item.stage],note});
            }
            await reloadEvolution();
          })}>{item.stage==='verified'&&item.scope!=='framework-candidate'?'提名 Framework 候选':'推进并保存证据'}</button>
        </div>)}
      </section> : null}
      {snapshots.length > 0 ? <div className="workspace-card">
        <h3>版本对比与验证</h3>
        <div className="topbar-actions">
          <select aria-label="对比起始版本" value={selectedBefore} onChange={(e) => setSelectedBefore(e.target.value)}>
            {snapshots.map((s) => <option key={s.snapshotId} value={s.snapshotId}>{s.snapshotId} · {s.createdAt.slice(0,10)}</option>)}
          </select>
          <select aria-label="对比目标版本" value={selectedAfter} onChange={(e) => setSelectedAfter(e.target.value)}>
            {snapshots.map((s) => <option key={s.snapshotId} value={s.snapshotId}>{s.snapshotId} · {s.createdAt.slice(0,10)}</option>)}
          </select>
          <button className="secondary-button" disabled={busy || !selectedBefore || !selectedAfter} onClick={() => void action(async () => {setComparison(await assetClient.enterpriseCompare(selectedBefore,selectedAfter));})}><GitCompareArrows size={16}/>比较</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {const r=await assetClient.enterpriseVerify(selectedAfter);setVerification(r.ok ? '已验证 '+r.checked+' 个仓库的本地 Git 对象' : '验证未通过：'+r.missing.join('；'));})}>验证快照</button>
        </div>
        {verification ? <p role="status">{verification}</p> : null}
        {comparison ? <div><p>有变化的仓库：{comparison.changedRepositories}</p>
          {comparison.rows.filter((r) => r.status !== 'unchanged').map((r) => <div className="repository-row" key={r.path}><strong>{r.path || '根仓库'}</strong><span>{r.status}</span><span>{r.changedFiles?.length ?? 0} 个已列出的变化文件</span>{!r.diffComplete ? <small>{r.note || '无法提供完整文件差异'}</small> : null}</div>)}
        </div> : null}
      </div> : null}
    </section>
  );
}
