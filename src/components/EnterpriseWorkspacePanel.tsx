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
  const [model, setModel] = useState('qwen2.5-coder:7b');
  const [rawBudgetMiB, setRawBudgetMiB] = useState(64);
  const [refactorProposalId, setRefactorProposalId] = useState('');
  const [semanticEvidence, setSemanticEvidence] = useState('');

  const [busy, setBusy] = useState(false);
  const [centralMode, setCentralMode] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const [attachedWorkspaces, setAttachedWorkspaces] = useState<Array<{ workspaceId: string; projectRoot: string; label: string }>>([]);
  const scope = centralMode ? workspaceId : undefined;
  const refresh = async (activeId: string | undefined = scope) => {
    if (centralMode && !activeId) return;
    const [result, versions] = await Promise.all([assetClient.enterpriseDiscovery(activeId), assetClient.enterpriseSnapshots(activeId)]);
    setDiscovery(result);
    setSnapshots(versions.snapshots);
    setSelectedAfter((s) => s || versions.snapshots[0]?.snapshotId || '');
    setSelectedBefore((s) => s || versions.snapshots[1]?.snapshotId || versions.snapshots[0]?.snapshotId || '');
  };
  useEffect(() => {
    void assetClient.config().then(async config => {
      if (!config.lockedToInstance) {
        setCentralMode(true);
        const response = await assetClient.listAttachedEnterprise();
        setAttachedWorkspaces(response.workspaces);
        setWorkspaceId(response.workspaces[0]?.workspaceId || '');
      } else { await refresh(undefined); }
    }).catch((e: unknown) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (centralMode && workspaceId) { void refresh(workspaceId).then(() => reloadEvolution(workspaceId)).catch((e: unknown) => setError(String(e))); }
  }, [centralMode, workspaceId]);
  const reloadEvolution = async (activeId: string | undefined = scope) => {
    const answer = await assetClient.enterpriseGet<{ cases: Array<{ id: string; title: string; stage: string; scope: string }> }>('evolution', activeId);
    setEvolution(answer.cases);
  };
  useEffect(() => { if (!centralMode) void reloadEvolution().catch(() => undefined); }, []);

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
      {centralMode ? <div className="workspace-card">
        <h3>接入现有企业项目 · 只读</h3>
        <p className="detail-summary">这里只读取业务目录并在中央登记，不会创建 Instance、修改项目源码或写入 Provider Hooks。新建项目请使用独立工作台创建入口。</p>
        <select aria-label="选择已接入企业工作区" value={workspaceId} onChange={e => {setWorkspaceId(e.target.value); setDiscovery(null);setSnapshots([]);setSelectedBefore('');setSelectedAfter('');setEvolution([]);setPipeline('');setSemanticEvidence('');}}>
          <option value="">请选择业务工作区</option>
          {attachedWorkspaces.map(w => <option key={w.workspaceId} value={w.workspaceId}>{w.label} · {w.projectRoot}</option>)}
        </select>
        {attachedWorkspaces.length === 0 ? <p role="status">尚未接入企业项目。请到中央「独立工作台」选择只读接入已有目录。</p> : null}
        {workspaceId ? <button type="button" className="secondary-button" disabled={busy}
          onClick={() => void action(async () => {
            if (!window.confirm('只移除此工作区的中央登记吗？原始业务代码和已生成分析资产都会保留。')) return;
            await assetClient.enterpriseCommand('projects/detach', { workspaceId });
            const response = await assetClient.listAttachedEnterprise();
            setAttachedWorkspaces(response.workspaces);
            setWorkspaceId(response.workspaces[0]?.workspaceId || '');
            setSelectedBefore('');setSelectedAfter('');setDiscovery(null);setSnapshots([]);
          })}>移除只读登记（保留代码及分析数据）</button> : null}
      </div> : null}
      <p className="detail-summary">只读取本地 Git 对象，不执行 fetch、checkout 或修改业务代码。快照固定每个仓库的 commit 和 tree；元数据保存在中央管理目录。</p>
      <div className="topbar-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void action(refresh)}><RefreshCw size={16}/>重新发现仓库</button>
        <button type="button" className="secondary-button" disabled={busy || !discovery?.repositories.length} onClick={() => void action(async () => { await assetClient.freezeEnterprise('head', scope); await refresh(); })}><ShieldCheck size={16}/>冻结当前 HEAD</button>
        <button type="button" className="secondary-button" disabled={busy || !discovery?.repositories.length} onClick={() => void action(async () => { await assetClient.freezeEnterprise('origin-tracking', scope); await refresh(); })}>冻结本地 origin 跟踪分支</button>
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
        <label>单次 Raw 归档容量上限（实际导入超过限制时报告 PARTIAL，不是导入成功）
          <select aria-label="Raw 归档容量上限" value={rawBudgetMiB} onChange={e => setRawBudgetMiB(Number(e.target.value))}>
            <option value={16}>16 MiB（快速试验）</option>
            <option value={64}>64 MiB</option>
            <option value={128}>128 MiB</option>
            <option value={256}>256 MiB</option>
            <option value={512}>512 MiB（较大企业项目）</option>
          </select>
        </label>
        <div className="topbar-actions">
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const result = await assetClient.enterpriseCommand<{ results: Array<{status:string;reason?:string}> }>('mirrors/sync',{snapshotId:selectedAfter},scope);
            const failed=result.results.filter(r=>r.status!=='verified');
            setPipeline('本地镜像归档：'+(result.results.length-failed.length)+'/'+result.results.length+' 已验证。'+(failed.length?'失败：'+failed.map(x=>x.reason).join('；'):''));
          })}>建立或更新本地受管 Git 镜像</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const result = await assetClient.enterpriseCommand<{ status: string; total: number; materialized: number; missing: number }>('raw/import', { snapshotId: selectedAfter, maxBytes: rawBudgetMiB * 1024 * 1024, maxFiles: 100000 },scope);
            setPipeline('Raw '+result.status+'：'+result.materialized+'/'+result.total+' 文件；未物化 '+result.missing);
          })}>归档当前快照 Raw</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
            const graph = await assetClient.enterpriseCommand<{ status: string; modules: unknown[]; edges: unknown[] }>('graph/build',{snapshotId:selectedAfter},scope);
            setPipeline('Maven '+graph.status+'：'+graph.modules.length+' 个 POM 模块，'+graph.edges.length+' 条可验证关系');
          })}>分析 Maven 模块关系</button>
        </div>
        {pipeline ? <p role="status">{pipeline}</p> : null}
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const result = await assetClient.enterpriseCommand<{ findings:Array<{summary:string;file:string;line:number}>;analyzed:number;status:string }>('quality/analyze',{snapshotId:selectedAfter},scope);
          setPipeline('静态质量分析：'+result.analyzed+' 个已归档代码文件，'+result.findings.length+' 个候选问题，状态 '+result.status+'；首个发现：'+(result.findings[0] ? result.findings[0].file+':'+result.findings[0].line+' '+result.findings[0].summary : '无'));
        })}>扫描代码质量候选问题</button>
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const graph=await assetClient.enterpriseCommand<{nodes:unknown[];edges:unknown[];status:string}>('sourcegraph/build',{snapshotId:selectedAfter},scope);
          setPipeline('源码关系候选：'+graph.nodes.length+' 节点、'+graph.edges.length+' 边；'+graph.status+'。复杂 Java/SQL 解析尚未完成。');
        })}>建立源码调用与 SQL 候选索引</button>
        <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {
          const report=await assetClient.enterpriseCommand<{checked:number;changed:number;bytesRemoved:number;status:string}>('optimization/experiment',{snapshotId:selectedAfter},scope);
          setPipeline('隔离优化实验：'+report.checked+' 个文件，候选优化 '+report.changed+' 个，节约空白字节 '+report.bytesRemoved+'；未改动业务源码。');
        })}>运行隔离优化实验</button>
        <button className="secondary-button" disabled={busy}
          onClick={() => void action(async () => {
            const info = await assetClient.enterpriseGet<{
              javaCompiler: { available: boolean; detail: string };
              sqlParser: { available: boolean; detail: string };
              localModel: { available: boolean; detail: string };
              testSandbox: { available: boolean; detail: string };
            }>('semantic/toolchain');
            setSemanticEvidence('环境自检：Java ' + (info.javaCompiler.available ? '就绪' : '不可用') +
              '；SQLGlot ' + (info.sqlParser.available ? '就绪' : '未安装') +
              '；本地 AI ' + (info.localModel.available ? '端点在线' : '未连接') +
              '；测试容器 ' + (info.testSandbox.available ? '已缓存' : '未准备') +
              '。缺失项目会阻塞对应操作，不会伪造测试成功。');
          })}>检查 Java / SQL / 本地 AI / 测试环境</button>
        <h3>源码语义与动态 SQL 血缘</h3>
        <p className="detail-summary">Java 使用 JDK AST 与符号归属解析；SQL 使用 MyBatis 条件分支和 SQLGlot AST。分析对象必须先归档 Raw。无法解析的调用、运行时条件与缺少的表结构会报告 PARTIAL，而不是虚构完整血缘。</p>
        <div className="topbar-actions">
          <button type="button" className="secondary-button" disabled={busy || !selectedAfter}
            onClick={() => void action(async () => {
              const data = await assetClient.enterpriseCommand<{
                status: string; indexedJavaFiles: number; declarations: number; resolvedCallEdges: number;
                crossRepositoryEdges: number; unresolvedCalls: number; diagnostics: string[]; reason?: string;
              }>('semantic/java', { snapshotId: selectedAfter }, scope);
              setSemanticEvidence('Java ' + data.status + ' · ' + data.indexedJavaFiles + ' 个源码文件、' + data.declarations +
                ' 个方法、' + data.resolvedCallEdges + ' 条已匹配调用边（跨仓 ' + data.crossRepositoryEdges +
                '）、未解析 ' + data.unresolvedCalls + '。' + (data.reason || data.diagnostics.slice(0, 2).join('; ')));
            })}>解析跨仓 Java 符号调用</button>
          <button type="button" className="secondary-button" disabled={busy || !selectedAfter}
            onClick={() => void action(async () => {
              const data = await assetClient.enterpriseCommand<{
                status: string; analyzedFiles: number; statements: Array<{ complete: boolean }>; errors: string[]; reason?: string;
              }>('semantic/sql', { snapshotId: selectedAfter }, scope);
              setSemanticEvidence('MyBatis SQL ' + data.status + ' · ' + data.analyzedFiles + ' 个文件、' +
                data.statements.length + ' 个 SQL 条件分支，未完整解析 ' +
                data.statements.filter(x => !x.complete).length + '。' + (data.reason || data.errors.slice(0, 2).join('; ')));
            })}>分析 MyBatis 动态 SQL 血缘</button>
        </div>
        {semanticEvidence ? <p role="status" className="detail-summary">{semanticEvidence}</p> : null}
        <h3>AI 隔离重构与自动化验证</h3>
        <p className="detail-summary">选择下面的证据仓库和 Java 文件，使用本机 Ollama 模型生成候选修改。不会把公司源码传到云端，也不会直接修改 backV8；验证需要完整 Raw、已缓存的 Docker Maven/JDK 镜像与可运行的离线业务测试。</p>
        <input aria-label="本地重构模型" value={model} onChange={e => setModel(e.target.value)} placeholder="本地 Ollama 模型名称" />
        <div className="topbar-actions">
          <button type="button" className="secondary-button" disabled={busy || !selectedAfter || !evidenceRepo || !evidencePath.endsWith('.java')}
            onClick={() => void action(async () => {
              const result = await assetClient.enterpriseCommand<{ id: string; rationale: string; originalSha256: string; candidateSha256: string }>(
                'refactor/propose', { snapshotId: selectedAfter, repository: evidenceRepo, path: evidencePath.trim(), model }, scope);
              setRefactorProposalId(result.id);
              setSemanticEvidence('候选重构已生成（未修改业务源码）：' + result.id + ' · ' + result.rationale);
            })}>AI 生成隔离候选修改</button>
          <button type="button" className="secondary-button" disabled={busy || !refactorProposalId}
            onClick={() => void action(async () => {
              const result = await assetClient.enterpriseCommand<{ status: string; reason: string; baselineMs?: number; candidateMs?: number }>(
                'refactor/validate', { proposalId: refactorProposalId }, scope);
              setSemanticEvidence('候选 ' + refactorProposalId + ' · ' + result.status + '。' + result.reason +
                (result.baselineMs && result.candidateMs ? ' 基线测试 ' + result.baselineMs + ' ms；修改后测试 ' + result.candidateMs + ' ms。' : ''));
            })}>容器内验证基线与重构结果</button>
        </div>
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
            evidence:[{repository:repo.path,path:evidencePath.trim(),commit:repo.commit}]},scope);
          await reloadEvolution(); setTitle(''); setProblem(''); setEvidencePath('');
        })}>保存带版本来源的问题</button>
        <input aria-label="阶段依据" value={note} placeholder="记录实验、评估、验证依据" onChange={e=>setNote(e.target.value)}/>
        {evolution.map(item=><div className="repository-row" key={item.id}>
          <strong>{item.title}</strong><span>{item.stage} / {item.scope}</span>
          <button className="secondary-button" disabled={busy || !note.trim() || ['promoted','rejected'].includes(item.stage)} onClick={()=>void action(async ()=>{
            const transitions:Record<string,string>={observed:'proposed',proposed:'experimented',experimented:'verified',verified:'promoted'};
            if(item.stage==='verified' && item.scope!=='framework-candidate'){
              await assetClient.enterpriseCommand('evolution/nominate',{id:item.id},scope);
            } else {
              await assetClient.enterpriseCommand('evolution/advance',{id:item.id,stage:transitions[item.stage],note},scope);
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
          <button className="secondary-button" disabled={busy || !selectedBefore || !selectedAfter} onClick={() => void action(async () => {setComparison(await assetClient.enterpriseCompare(selectedBefore,selectedAfter,scope));})}><GitCompareArrows size={16}/>比较</button>
          <button className="secondary-button" disabled={busy || !selectedAfter} onClick={() => void action(async () => {const r=await assetClient.enterpriseVerify(selectedAfter, scope);setVerification(r.ok ? '已验证 '+r.checked+' 个仓库的本地 Git 对象' : '验证未通过：'+r.missing.join('；'));})}>验证快照</button>
        </div>
        {verification ? <p role="status">{verification}</p> : null}
        {comparison ? <div><p>有变化的仓库：{comparison.changedRepositories}</p>
          {comparison.rows.filter((r) => r.status !== 'unchanged').map((r) => <div className="repository-row" key={r.path}><strong>{r.path || '根仓库'}</strong><span>{r.status}</span><span>{r.changedFiles?.length ?? 0} 个已列出的变化文件</span>{!r.diffComplete ? <small>{r.note || '无法提供完整文件差异'}</small> : null}</div>)}
        </div> : null}
      </div> : null}
    </section>
  );
}
