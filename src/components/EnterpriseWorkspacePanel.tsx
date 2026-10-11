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
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [result, versions] = await Promise.all([assetClient.enterpriseDiscovery(), assetClient.enterpriseSnapshots()]);
    setDiscovery(result);
    setSnapshots(versions.snapshots);
    setSelectedAfter((s) => s || versions.snapshots[0]?.snapshotId || '');
    setSelectedBefore((s) => s || versions.snapshots[1]?.snapshotId || versions.snapshots[0]?.snapshotId || '');
  };
  useEffect(() => { void refresh().catch((e: unknown) => setError(String(e))); }, []);
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
