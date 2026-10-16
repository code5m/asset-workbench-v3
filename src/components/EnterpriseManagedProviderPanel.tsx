import { useEffect, useState } from 'react';
import { assetClient } from '../services/assetClient';

type Session = {
  id: string; repository: string | null; module: string | null; provider: string;
  providerSessionId: string; status: string; acceptedEvents: number; updatedAt: string;
  transcriptPath?: string;
};
type Provider = {
  provider: string; configuration: string; captureVerified: boolean;
  completedSessions: number; detail: string;
};
type Note = {
  id: string; title: string; content: string; repository: string | null; module: string | null;
  createdAt: string;
}
type LegacyAsset = {
  id: string; relative: string; title: string; type: string; source: string;
  contentFile: string; capturedAt?: string;
};
export function EnterpriseManagedProviderPanel(props: {
  workspaceId: string; sourcePolicy: 'read-only' | 'managed'; onManaged?: () => Promise<void>; onModeChanged?: () => Promise<void>;
}) {
  const { workspaceId, sourcePolicy } = props;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [legacyAssets, setLegacyAssets] = useState<LegacyAsset[]>([]);
  const [legacyContent, setLegacyContent] = useState('');
  const [legacySelected, setLegacySelected] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [sessionEvents, setSessionEvents] = useState<Array<{ kind: string; content: string; timestamp: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeRepo, setKnowledgeRepo] = useState('');
  const [knowledgeModule, setKnowledgeModule] = useState('');
  const [historyPath, setHistoryPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    if (sourcePolicy !== 'managed') return;
    const [status, knowledge, inventory, historical] = await Promise.all([
      assetClient.enterpriseProviderStatus(workspaceId),
      assetClient.enterpriseGet<{ notes: Note[] }>('knowledge/notes', workspaceId),
      assetClient.enterpriseDiscovery(workspaceId),
      assetClient.enterpriseGet<{ assets: LegacyAsset[] }>('knowledge/legacy', workspaceId),
    ]);
    setProviders(status.providers);
    setSessions(status.sessions);
    setNotes(knowledge.notes);
    setLegacyAssets(historical.assets);
    setRepositories(inventory.repositories.map(repo => repo.path));
  };
  useEffect(() => {
    setProviders([]); setSessions([]); setNotes([]); setLegacyAssets([]); setSelectedId('');
    setLegacySelected(''); setLegacyContent('');
    setSessionEvents([]); setError(''); setMessage('');
    void load().catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [workspaceId, sourcePolicy]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  if (sourcePolicy !== 'managed') {
    return <section className="workspace-card" aria-label="企业 Provider 受管功能">
      <h3>Provider、聊天和项目知识</h3>
      <p className="detail-summary">当前为完全只读模式。要将真实 AI 会话、知识与实验记录保存到项目根目录，请明确授权启用企业受管模式。所有业务子仓库仍不安装 Hook，也不修改源码。</p>
      <button type="button" className="secondary-button" disabled={busy || !props.onManaged} onClick={() => void action(async () => {
        if (!window.confirm('仅允许在业务根目录 .asset-workbench-data 下写入数据，并复制校验旧数据（保留原备份）。确认开启企业受管模式？')) return;
        await props.onManaged?.();
      })}>开启企业受管模式</button>
      {error ? <p role="alert">{error}</p> : null}
    </section>;
  }
  const visible = sessions.filter(s => !filter
    || [s.repository, s.module, s.provider, s.providerSessionId]
      .some(value => value?.toLowerCase().includes(filter.trim().toLowerCase())));
  return <section className="workspace-card" aria-label="企业 Provider 与知识工作台">
    <h3>Provider、聊天和知识资产（统一归属）</h3>
    <p className="detail-summary">所有会话统一保存在业务根目录的 .asset-workbench-data。按实际 Git 根目录和 Maven 模块归属；用户级 Hook 不写入任何子仓库。外部 Provider 仍需真实事件和登录授权才能验证。</p>
    <div className="topbar-actions">
      <button className="secondary-button" disabled={busy} onClick={() => void action(load)}>刷新 Provider 与会话</button>
      <button className="secondary-button" disabled={busy}
        onClick={() => void action(async () => {
          if (!window.confirm('此操作会修改当前系统用户 HOME 下的 Codex/CodeBuddy/Trae Hook 配置以及 OpenCode 用户插件。不会修改 backV8 的任何子仓库。继续？')) return;
          const result = await assetClient.setupEnterpriseProviderHooks(workspaceId);
          setMessage(result.results.map(x => x.provider + '：' + x.status).join('；') +
            '。需要在真实 Provider 内结束一次会话后才可以确认自动采集是否有效。');
          await load();
        })}>安装用户级采集 Hook（需授权）</button>
    </div>
    {providers.length > 0 ? <div className="repository-list">
      {providers.map(p => <div className="repository-row" key={p.provider}>
        <strong>{p.provider}</strong>
        <span>{p.configuration === 'configured' ? '已配置' : p.configuration === 'import-only' ? '仅导入/授权' : '未配置'}</span>
        <span>{p.captureVerified ? '存在已结束会话' : '等待真实会话'}</span>
        <small>{p.detail}</small>
      </div>)}
    </div> : <p className="detail-summary">尚无 Provider 诊断结果；点击刷新。</p>}
    <h3>项目聊天与 Agent 工作记录</h3>
    <input className="root-input" aria-label="筛选 Provider 会话仓库或模块" value={filter}
      onChange={e => setFilter(e.target.value)} placeholder="筛选仓库、Maven 模块、Provider 或 Session ID" />
    {visible.length === 0 ? <p className="detail-summary">目前没有符合条件的真实会话。模拟 Hook 的 CI 记录不会冒充真实使用数据。</p> : null}
    <div className="repository-list">
      {visible.slice(0, 80).map(session => <div className="repository-row" key={session.id}>
        <div><strong>{session.provider}</strong> · {session.status} · {session.acceptedEvents} 条事件
          <small>{session.repository || '根工作区'} / {session.module || '模块尚未确权'}</small></div>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void action(async () => {
          const result = await assetClient.enterpriseProviderEvents(workspaceId, session.id);
          setSelectedId(session.id);
          setSessionEvents(result.events.slice(-120));
        })}>查看记录</button>
        <small>{session.transcriptPath || '正在采集／未结束'}</small>
      </div>)}
    </div>
    {selectedId ? <div className="workspace-card"><h3>会话详情 · {selectedId}</h3>
      {sessionEvents.map((event, i) => <p key={i} className="detail-summary">
        <strong>{event.kind}</strong> · {event.timestamp} · {event.content?.slice(0, 500) || '事件元数据'}
      </p>)}
    </div> : null}
    <h3>导入历史 Codex 会话</h3>
    <p className="detail-summary">必须选择真实的 ~/.codex/sessions/*.jsonl，并且其官方元数据里的 cwd 属于本受管项目；来源无法确认的会话拒绝导入。</p>
    <div className="topbar-actions">
      <input className="root-input" value={historyPath} onChange={e => setHistoryPath(e.target.value)}
        placeholder="Codex 官方 JSONL 文件的绝对路径" aria-label="Codex 官方聊天历史文件" />
      <button className="secondary-button" disabled={busy || !historyPath.trim()}
        onClick={() => void action(async () => {
          const result = await assetClient.enterpriseCommand<{
            imported: number; duplicates: number; workspaceId: string;
          }>('provider/history/import', { provider: 'codex', path: historyPath.trim() }, workspaceId);
          setMessage('Codex 已导入 ' + result.imported + ' 条真实记录，重复跳过 ' + result.duplicates + ' 条。');
          await load();
        })}>按真实 cwd 导入</button>
    </div>
    <h3>项目知识笔记</h3>
    <p className="detail-summary">设计、决策和验证记录保存在 .asset-workbench-data/knowledge/notes，可绑定指定仓库与模块，不污染业务源码。</p>
    <input className="root-input" aria-label="知识标题" placeholder="例如：支付退款幂等决策" value={knowledgeTitle}
      onChange={e => setKnowledgeTitle(e.target.value)} />
    <textarea aria-label="知识内容" placeholder="记录业务结论、原因和验收证据" value={knowledgeContent}
      onChange={e => setKnowledgeContent(e.target.value)} />
    <div className="topbar-actions">
      <select aria-label="知识归属 Git 仓库" value={knowledgeRepo} onChange={e => setKnowledgeRepo(e.target.value)}>
        <option value="">整套业务系统</option>
        {repositories.map(repo => <option key={repo} value={repo}>{repo || '根仓库'}</option>)}
      </select>
      <input className="root-input" aria-label="知识归属 Maven 模块" placeholder="模块名称（可选）" value={knowledgeModule}
        onChange={e => setKnowledgeModule(e.target.value)} />
      <button className="secondary-button" disabled={busy || !knowledgeTitle.trim() || !knowledgeContent.trim()}
        onClick={() => void action(async () => {
          await assetClient.enterpriseCommand('knowledge/notes', {
            title: knowledgeTitle, content: knowledgeContent, repository: knowledgeRepo || null,
            module: knowledgeModule || null,
          }, workspaceId);
          setKnowledgeTitle(''); setKnowledgeContent(''); setKnowledgeModule('');
          await load(); setMessage('知识已保存到项目受管目录。');
        })}>保存项目知识</button>
    </div>
    <div className="repository-list">{notes.slice(0, 50).map(note =>
      <div key={note.id} className="repository-row">
        <strong>{note.title}</strong><span>{note.repository || '整个项目'}</span>
        <span>{note.module || '未指定模块'}</span>
        <small>{note.content.slice(0, 260)}</small>
      </div>)}</div>
    <h3>历史聊天、设计与知识迁移</h3>
    <p className="detail-summary">已迁移且 SHA-256 校验通过的旧版 V3 资产在这里查看。来源不明或校验不通过的记录留在原处，不强行归属。</p>
    {legacyAssets.length === 0 ? <p className="detail-summary">暂时没有已确认并迁移的旧版资产。</p> : null}
    <div className="repository-list">
      {legacyAssets.slice(0, 100).map(asset => <div className="repository-row" key={asset.relative}>
        <strong>{asset.title}</strong><span>{asset.source} · {asset.type}</span>
        <button className="secondary-button" disabled={busy} onClick={() => void action(async () => {
          const result = await assetClient.enterpriseGet<{ relative: string; content: string }>(
            'knowledge/legacy/content?relative=' + encodeURIComponent(asset.relative), workspaceId);
          setLegacySelected(result.relative);
          setLegacyContent(result.content);
        })}>查看旧资产内容</button>
      </div>)}
    </div>
    {legacySelected ? <div className="workspace-card">
      <h4>旧资产内容 · {legacySelected}</h4>
      <pre className="detail-summary" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{legacyContent.slice(0, 80000)}</pre>
    </div> : null}
    <details className="instance-optional-settings">
      <summary>高级：旧资产迁移校验与回滚</summary>
      <p className="detail-summary">仅校验复制数据；源中央备份和现有聊天不会自动删除。受管期产生新聊天、知识或分析时，将阻止回滚以避免资产被隐藏。</p>
      <div className="topbar-actions">
        <button className="secondary-button" disabled={busy} onClick={() => void action(async () => {
          const audit = await assetClient.enterpriseManagedAudit(workspaceId);
          setMessage('旧资产复制校验：' + audit.verifiedFiles + '/' + audit.expectedFiles +
            '；源数据保留：' + (audit.sourcePreserved ? '是' : '否') +
            '；新增受管内容 ' + audit.newManagedFiles + '；可安全回滚：' + (audit.rollbackSafe ? '是' : '否') +
            (audit.mismatches.length ? '；差异：' + audit.mismatches.slice(0,5).join(', ') : ''));
        })}>校验旧资产与备份</button>
        <button className="secondary-button" disabled={busy} onClick={() => void action(async () => {
          const audit = await assetClient.enterpriseManagedAudit(workspaceId);
          if (!audit.rollbackSafe || !audit.sourcePreserved) throw new Error('新增受管资产或校验差异导致回滚被阻止，所有数据已保留');
          if (!window.confirm('将存储路由切回中央。原始与受管目录文件都不会删除；确认操作？')) return;
          const result = await assetClient.enterpriseManagedRollback(workspaceId);
          setMessage(result.detail);
          await props.onModeChanged?.();
        })}>确认回滚到完全只读</button>
      </div>
    </details>
    {error ? <p role="alert" className="detail-summary">{error}</p> : null}
    {message ? <p role="status" className="detail-summary">{message}</p> : null}
  </section>;
}
