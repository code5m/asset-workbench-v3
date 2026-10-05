import { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, CircleHelp, Plug, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { assetClient, type ProviderDetailView, type ProviderStatusView } from '../services/assetClient';

type Tab = 'intro' | 'manage';

const authLabel = (value: string) => ({
  NOT_REQUIRED: '无需认证',
  MANUAL_IMPORT: '手工导入',
  EXISTING_SESSION: '使用当前登录态',
  OAUTH_SESSION: 'OAuth 登录态',
  EXTERNAL: '外部认证',
  ENVIRONMENT: '环境变量',
  CONFIGURED: '已配置',
  NOT_CONFIGURED: '未配置',
  VERIFIED: '认证通过',
  INVALID: '认证失败',
}[value] ?? value);

const sourceLabel = (value: string) => ({
  hooks: 'Hooks（生命周期通知）',
  plugin: 'Plugin（插件事件）',
  'event-stream': '事件流',
  'cli-json': 'CLI JSON',
  'export-import': '官方导出 / 导入',
  'manual-import': '手工导入',
  custom: '自定义适配器',
}[value] ?? value);

const finalizationLabel = (value: string) => ({
  'explicit-event': '明确结束事件',
  'session-idle': '会话空闲',
  'stop-event': '回答停止事件',
  'next-session': '下一会话开始时',
  manual: '手工结束',
  custom: 'Provider 特定策略',
}[value] ?? value);

const statusLabel = (value: string) => ({
  ENABLED: '已接入，可正常采集',
  DISABLED: '已停用采集',
  LIMITED: '部分能力可用',
  BLOCKED_AUTH: '等待认证',
  NOT_INSTALLED: '本机未安装',
  UNSUPPORTED_VERSION: '版本不支持',
  WAITING_REAL_EVENT: '等待真实会话验证',
  ERROR: '接入异常',
}[value] ?? value);

const verificationStepLabel = (value: string) => ({
  Discovery: '① 安装 / 可用性',
  Authentication: '② 认证',
  Integration: '③ 接入配置',
  'Real Event': '④ 真实事件',
  Transcript: '⑤ 原始对话',
}[value] ?? value);

export function ProviderManager() {
  const [tab, setTab] = useState<Tab>('intro');
  return (
    <main className="page provider-manager">
      <section className="topbar">
        <div>
          <p className="eyebrow">AI CONNECTION</p>
          <h1>AI 接入与会话采集</h1>
          <p>先看懂聊天是怎么进入项目的，再管理 Codex、CodeBuddy、OpenCode 等 Provider。</p>
        </div>
      </section>
      <div className="provider-tabs">
        <button className={tab === 'intro' ? 'selected' : ''} onClick={() => setTab('intro')}><BookOpen size={16}/>入门说明</button>
        <button className={tab === 'manage' ? 'selected' : ''} onClick={() => setTab('manage')}><Plug size={16}/>Provider 管理</button>
      </div>
      {tab === 'intro' ? <ProviderIntro onManage={() => setTab('manage')} /> : <ProviderConsole />}
    </main>
  );
}

function ProviderIntro({ onManage }: { onManage: () => void }) {
  return (
    <div className="provider-intro">
      <section className="panel provider-intro-hero">
        <div>
          <p className="eyebrow">先理解一件事</p>
          <h2>Asset Workbench 保存的是“真实聊天证据”，不是 AI 自己写的摘要</h2>
          <p>不同 AI 工具原生格式不同，但都会先进入统一 Capture Kernel，再生成标准的 <code>transcript.md</code>。Agent 自己整理的工作总结则单独保存为 Work Record。</p>
        </div>
        <button className="primary-button" onClick={onManage}>去管理 Provider</button>
      </section>

      <section className="panel">
        <h2>一条聊天是怎么被保存的？</h2>
        <div className="capture-flow">
          {['你和 AI 聊天', 'Hook / Plugin / 官方导出', 'Provider Adapter', 'Capture Kernel', 'transcript.md', '项目知识资产'].map((item, index) => (
            <div key={item} className="capture-flow-item"><span>{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section className="provider-concept-grid">
        <Concept title="Provider 是什么？" body="一个 AI 工具的接入定义。例如 Codex、CodeBuddy、OpenCode、Trae。它描述认证方式、事件从哪里来，以及怎么判断会话结束。" />
        <Concept title="Hook 是什么？" body="AI 工具在发生某件事时主动通知我们。例如你发送消息时触发 UserPromptSubmit，AI 回答完成时触发 Stop，会话结束时触发 SessionEnd。" />
        <Concept title="Plugin 是什么？" body="装在 AI 工具里的小插件。OpenCode 通过插件把真实事件转给 Asset Workbench，再由统一 Capture Kernel 处理。" />
        <Concept title="ACP 是什么？" body="某些 Agent 提供的程序化会话控制协议，可以创建 Session、发消息或读取状态。ACP 不是 Hook，也不是 Transcript，更不是所有 Provider 的必需条件。" />
        <Concept title="Transcript 是什么？" body="你和 AI 真正说过的话，是原始对话证据，统一保存为 transcript.md。它应该保留中文、重复消息和原始顺序。" />
        <Concept title="Work Record 是什么？" body="Agent 对一次任务做的结构化工作总结：调查了什么、改了什么、验证了什么。它不是完整聊天原文。" />
        <Concept title="运行验证是什么？" body="不是刷新页面。它重新读取真实安装、认证、接入配置和已存在的真实 Capture 证据，并按五段结果展示。没有真实会话就不会伪造 E2E PASS。" />
        <Concept title="为什么有 LIMITED？" body="因为不同工具能力不同。ChatGPT 当前只能显式导入；Trae 当前缺可靠 SessionEnd；这些限制会诚实显示，而不是强行全绿。" />
      </section>

      <section className="panel">
        <h2>ACP、Hook、Plugin 的关系</h2>
        <div className="concept-compare">
          <div><strong>Hook</strong><span>“发生事件时通知我”</span><small>Codex / CodeBuddy / Trae</small></div>
          <div><strong>Plugin</strong><span>“把一个事件转发插件装进去”</span><small>OpenCode</small></div>
          <div><strong>ACP</strong><span>“程序化控制或连接 Agent Session”</span><small>可选能力，不是统一采集前提</small></div>
          <div><strong>Transcript</strong><span>“最终保存下来的原始聊天证据”</span><small>所有 Provider 统一目标</small></div>
        </div>
      </section>
    </div>
  );
}

function Concept({ title, body }: { title: string; body: string }) {
  return <article className="panel provider-concept"><CircleHelp size={20}/><h3>{title}</h3><p>{body}</p></article>;
}

function ProviderConsole() {
  const [providers, setProviders] = useState<ProviderStatusView[]>([]);
  const [selected, setSelected] = useState<string>('codex');
  const selectedRef = useRef('codex');
  const [detail, setDetail] = useState<ProviderDetailView | null>(null);
  const [message, setMessage] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [ak, setAk] = useState('');
  const [sk, setSk] = useState('');

  const reload = async () => {
    const list = await assetClient.providers();
    setProviders(list);
    const id = selectedRef.current || list[0]?.provider;
    if (id) {
      const next = await assetClient.providerDetail(id);
      if (selectedRef.current === id) setDetail(next);
    }
  };

  useEffect(() => { void reload(); }, []);

  const choose = async (id: string) => {
    selectedRef.current = id;
    setSelected(id);
    setDetail(null);
    const next = await assetClient.providerDetail(id);
    if (selectedRef.current === id) setDetail(next);
    setMessage('');
  };

  const action = async (name: string, body: Record<string, unknown> = {}) => {
    try {
      const result = await assetClient.providerAction(selected, name, body);
      if (name === 'run-verification' && result?.verification) {
        setDetail(result as ProviderDetailView);
        setMessage(`验证完成：${new Date(result.verificationRunAt).toLocaleString()}`);
      } else {
        setMessage(result.detail ?? (name === 'credentials' ? '凭据已保存到操作系统安全凭据库。' : '操作完成。'));
        await reload();
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return <>
    <section className="topbar provider-console-head">
      <div>
        <p className="eyebrow">PROVIDER MANAGER</p>
        <h2>连接并管理 AI 会话采集</h2>
        <p>停用只停止新的采集，不删除历史 Transcript。E2E PASS 只来自真实 Provider 会话证据。</p>
      </div>
      <div className="hero-actions">
        <button className="secondary-button" onClick={() => void reload()}><RefreshCw size={16}/>重新检测</button>
        <button className="primary-button" onClick={() => setAddOpen(!addOpen)}><Plus size={16}/>添加 Provider</button>
      </div>
    </section>

    {addOpen ? <CustomProvider onSaved={async () => { setAddOpen(false); await reload(); }} /> : null}

    <section className="provider-grid">
      <div className="panel">
        <h2>Provider 总览</h2>
        <p className="note">状态来自真实安装、配置和 Capture 证据；不是手工勾选。</p>
        <div className="provider-table">
          <div className="provider-head">Provider · 安装 · E2E · 状态</div>
          {providers.map((item) => {
            const status = (item as any).platformStatus ?? item.status;
            return <button key={item.provider} className={`provider-row ${selected === item.provider ? 'selected' : ''}`} onClick={() => void choose(item.provider)}>
              <strong>{item.provider}</strong>
              <span>{item.installed === false && item.provider !== 'chatgpt' ? '未安装' : '可用'}</span>
              <span>{item.runtimeVerified ? 'E2E PASS' : '未完成 E2E'}</span>
              <span className={`status-badge ${String(status).toLowerCase().replaceAll('_','-')}`}>{statusLabel(String(status))}</span>
            </button>;
          })}
        </div>
      </div>

      <div className="panel provider-detail">
        {detail ? <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{detail.definition.providerType}</p>
              <h2>{detail.definition.displayName}</h2>
              <p>{detail.definition.description}</p>
            </div>
            <span className={`status-badge ${detail.status.platformStatus.toLowerCase().replaceAll('_','-')}`}>{statusLabel(detail.status.platformStatus)}</span>
          </div>

          <div className="provider-facts">
            <Fact label="安装" value={detail.status.installed === false && selected !== 'chatgpt' ? '本机未安装' : '可用'} />
            <Fact label="版本" value={detail.status.version ?? '—'} />
            <Fact label="认证" value={authLabel(detail.status.authStatus)} />
            <Fact label="事件来源" value={sourceLabel(detail.definition.eventSource.type)} />
            <Fact label="结束策略" value={finalizationLabel(detail.definition.finalization.strategy)} />
            <Fact label="真实运行证据" value={detail.status.runtimeVerified ? '已有真实 Transcript' : selected === 'chatgpt' ? '实时采集不适用' : '等待真实会话'} />
          </div>

          {selected === 'chatgpt' ? <div className="banner">
            <strong>ChatGPT 当前采用显式导入</strong>
            <span>不会读取 chatgpt.com DOM，也不会调用私有 API。请把真实 Transcript 显式导入项目；导入后会保存到 <code>04-conversations/transcripts/chatgpt/</code>。</span>
          </div> : null}

          {selected === 'trae' ? <div className="banner warn">
            <span>当前 Trae 构建没有 SessionEnd。可以接收 Hook，但系统不会伪造“会话已结束”；因此在拿到真实终止证据前保持 LIMITED / WAITING。</span>
          </div> : null}

          {selected === 'codearts' ? <div className="credential-box">
            <h3>访问密钥</h3>
            <p>凭据保存在操作系统安全凭据库；页面不会回显旧值，也不会写入项目、日志或聊天记录。</p>
            <span>Access Key：{detail.status.authStatus === 'CONFIGURED' ? '已配置' : '未配置'}</span>
            <span>Secret Key：{detail.status.authStatus === 'CONFIGURED' ? '已配置' : '未配置'}</span>
            <input aria-label="Access Key" type="password" value={ak} onChange={(e) => setAk(e.target.value)} placeholder="Access Key"/>
            <input aria-label="Secret Key" type="password" value={sk} onChange={(e) => setSk(e.target.value)} placeholder="Secret Key"/>
            <button className="secondary-button" onClick={() => void action('credentials', { CODEARTS_CLI_AK: ak, CODEARTS_CLI_SK: sk })}>{detail.status.authStatus === 'CONFIGURED' ? '更新凭据' : '保存凭据'}</button>
            <button className="secondary-button" onClick={() => void action('delete-credentials')}>删除凭据</button>
            <button className="primary-button" onClick={() => void action('verify-auth')}>测试连接</button>
          </div> : null}

          <div className="hero-actions">
            <button className="secondary-button" onClick={() => void action(detail.status.enabled ? 'disable' : 'enable')}>{detail.status.enabled ? '停用采集' : '启用采集'}</button>
            <button className="primary-button" onClick={() => void action('run-verification')}><ShieldCheck size={16}/>运行验证</button>
          </div>
          {message ? <p className="provider-message">{message}</p> : null}

          <h3>验证结果</h3>
          <div className="skeleton-rows">
            {detail.verification.map((row) => <div className="skeleton-row" key={row.step}>
              <strong>{verificationStepLabel(row.step)}</strong>
              <span>{row.detail}</span>
              <span className={`status-badge ${row.status.toLowerCase()}`}>{row.status}</span>
            </div>)}
          </div>

          <details>
            <summary>高级技术详情</summary>
            <p>内部认证枚举：{detail.status.authStatus}</p>
            <p>事件入口：{detail.definition.eventSource.type}</p>
            <p>配置路径：{detail.definition.eventSource.projectConfigPath ?? '无需项目配置'}</p>
            <pre>{JSON.stringify(detail.definition.events, null, 2)}</pre>
            <p>{detail.definition.finalization.limitation ?? '会话结束策略由 Provider 事件确认。'}</p>
          </details>
        </> : <p>正在读取 Provider 状态…</p>}
      </div>
    </section>
  </>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <span><small>{label}</small><strong>{value}</strong></span>;
}

function CustomProvider({ onSaved }: { onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [authType, setAuthType] = useState('manual');
  const [eventSource, setEventSource] = useState('custom');
  const [finalization, setFinalization] = useState('manual');
  const [error, setError] = useState('');

  return <section className="panel custom-provider">
    <h2>添加自定义 Provider Definition</h2>
    <p>这里保存的是“接入定义”，不是任意命令执行器。为安全起见，自定义 Provider 不能填写可执行命令。保存后仍需可信 Adapter / 事件映射和一次真实验证，才算真正接入。</p>
    <input aria-label="Provider name" value={name} onChange={(e) => setName(e.target.value)} placeholder="名称"/>
    <input aria-label="Provider id" value={id} onChange={(e) => setId(e.target.value)} placeholder="Provider ID，例如 my-agent"/>
    <input aria-label="Config path" value={configPath} onChange={(e) => setConfigPath(e.target.value)} placeholder="项目配置路径（可选）"/>
    <label>认证<select aria-label="Auth type" value={authType} onChange={(e) => setAuthType(e.target.value)}><option value="manual">手工/外部</option><option value="existing-session">已有登录态</option><option value="none">无需认证</option></select></label>
    <label>事件来源<select aria-label="Event source" value={eventSource} onChange={(e) => setEventSource(e.target.value)}><option value="custom">需要专用 Adapter</option><option value="hooks">Hooks</option><option value="plugin">Plugin</option><option value="event-stream">Event Stream</option><option value="cli-json">CLI JSON</option><option value="export-import">导出/导入</option><option value="manual-import">手工导入</option></select></label>
    <label>结束策略<select aria-label="Finalization strategy" value={finalization} onChange={(e) => setFinalization(e.target.value)}><option value="manual">手工</option><option value="explicit-event">明确结束事件</option><option value="session-idle">会话空闲</option><option value="next-session">下一会话</option><option value="custom">专用策略</option></select></label>
    <button className="primary-button" onClick={async () => {
      try {
        await assetClient.saveCustomProvider({
          schemaVersion: 1,
          version: '1.0.0',
          id,
          displayName: name,
          description: 'Custom Provider Definition',
          providerType: 'custom',
          discovery: { configPaths: configPath ? [configPath] : [] },
          auth: { type: authType },
          eventSource: { type: eventSource, projectConfigPath: configPath || undefined },
          events: {},
          finalization: { strategy: finalization, limitation: 'Definition only. Trusted adapter/event mapping and real validation are still required.' },
          verification: { required: [], requireTranscript: eventSource !== 'manual-import' },
        });
        await onSaved();
      } catch (e) { setError((e as Error).message); }
    }}>保存 Definition</button>
    {error ? <p className="error-text">{error}</p> : null}
  </section>;
}
