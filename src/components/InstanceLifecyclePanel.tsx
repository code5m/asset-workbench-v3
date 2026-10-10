import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleX, GitCompareArrows, PackageCheck, RotateCcw, ShieldCheck, Stethoscope } from 'lucide-react';
import { assetClient, type InstanceSelfTestView, type InstanceStatusView, type InstanceUpgradePlanView } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';

export function InstanceLifecyclePanel() {
  const { t, lang } = useI18n();
  const [stage, setStage] = useState<'create' | 'status' | 'upgrade' | 'migration'>('create');
  const [projectRoot, setProjectRoot] = useState('');
  const [name, setName] = useState('');
  const [initializeKnowledge, setInitializeKnowledge] = useState(false);
  const [status, setStatus] = useState<InstanceStatusView | null>(null);
  const [plan, setPlan] = useState<InstanceUpgradePlanView | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selfTest, setSelfTest] = useState<InstanceSelfTestView | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestError, setSelfTestError] = useState('');
  const [published, setPublished] = useState<{ releaseId: string; totalBytes: number } | null>(null);
  const [knownInstances, setKnownInstances] = useState<Array<{ projectRoot: string; status: string; url: string | null }>>([]);
  const [inventoryError, setInventoryError] = useState('');
  const loadInventory = async () => {
    try {
      const items = await assetClient.listInstanceRuntimes();
      setKnownInstances(items);
      setInventoryError('');
    } catch (error) { setInventoryError(error instanceof Error ? error.message : String(error)); }
  };
  useEffect(() => {
    void loadInventory();
    void assetClient.frameworkRelease('current')
      .then(({ release }) => setPublished(release))
      .catch(() => undefined);
  }, []);

  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof assetClient.instanceRuntime>> | null>(null);
  const selectProject = (root: string) => {
    setProjectRoot(root);
    setStatus(null);
    setRuntime(null);
    setPlan(null);
    setMessage('');
  };

  const manifest = status?.manifest ?? null;
  const canApply = plan?.status === 'ready' && plan.actions.length > 0;
  const canRollback = status?.latestMigration?.status === 'applied';

  const selfTestFlow = [
    {
      id: 'instance-create',
      number: '01',
      phase: t('instanceSelfTestPhaseBaseline'),
      title: t('instanceSelfTestStepCreateTitle'),
      purpose: t('instanceSelfTestStepCreatePurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepCreateAction'),
      pass: t('instanceSelfTestStepCreatePass'),
    },
    {
      id: 'pre-upgrade-verify',
      number: '02',
      phase: t('instanceSelfTestPhaseBaseline'),
      title: t('instanceSelfTestStepPreVerifyTitle'),
      purpose: t('instanceSelfTestStepPreVerifyPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepPreVerifyAction'),
      pass: t('instanceSelfTestStepPreVerifyPass'),
    },
    {
      id: 'upgrade-plan',
      number: '03',
      phase: t('instanceSelfTestPhaseUpgrade'),
      title: t('instanceSelfTestStepPlanTitle'),
      purpose: t('instanceSelfTestStepPlanPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepPlanAction'),
      pass: t('instanceSelfTestStepPlanPass'),
    },
    {
      id: 'upgrade-apply',
      number: '04',
      phase: t('instanceSelfTestPhaseUpgrade'),
      title: t('instanceSelfTestStepApplyTitle'),
      purpose: t('instanceSelfTestStepApplyPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepApplyAction'),
      pass: t('instanceSelfTestStepApplyPass'),
    },
    {
      id: 'migration-evidence',
      number: '05',
      phase: t('instanceSelfTestPhaseUpgrade'),
      title: t('instanceSelfTestStepMigrationTitle'),
      purpose: t('instanceSelfTestStepMigrationPurpose'),
      kind: 'check' as const,
      action: t('instanceSelfTestStepMigrationAction'),
      pass: t('instanceSelfTestStepMigrationPass'),
    },
    {
      id: 'backup-evidence',
      number: '06',
      phase: t('instanceSelfTestPhaseUpgrade'),
      title: t('instanceSelfTestStepBackupTitle'),
      purpose: t('instanceSelfTestStepBackupPurpose'),
      kind: 'check' as const,
      action: t('instanceSelfTestStepBackupAction'),
      pass: t('instanceSelfTestStepBackupPass'),
    },
    {
      id: 'post-upgrade-verify',
      number: '07',
      phase: t('instanceSelfTestPhaseVerify'),
      title: t('instanceSelfTestStepPostVerifyTitle'),
      purpose: t('instanceSelfTestStepPostVerifyPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepPostVerifyAction'),
      pass: t('instanceSelfTestStepPostVerifyPass'),
    },
    {
      id: 'rollback',
      number: '08',
      phase: t('instanceSelfTestPhaseRollback'),
      title: t('instanceSelfTestStepRollbackTitle'),
      purpose: t('instanceSelfTestStepRollbackPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepRollbackAction'),
      pass: t('instanceSelfTestStepRollbackPass'),
    },
    {
      id: 'post-rollback-verify',
      number: '09',
      phase: t('instanceSelfTestPhaseRollback'),
      title: t('instanceSelfTestStepPostRollbackTitle'),
      purpose: t('instanceSelfTestStepPostRollbackPurpose'),
      kind: 'command' as const,
      action: t('instanceSelfTestStepPostRollbackAction'),
      pass: t('instanceSelfTestStepPostRollbackPass'),
    },
    {
      id: 'business-file-unchanged',
      number: '10',
      phase: t('instanceSelfTestPhaseSafety'),
      title: t('instanceSelfTestStepBusinessTitle'),
      purpose: t('instanceSelfTestStepBusinessPurpose'),
      kind: 'check' as const,
      action: t('instanceSelfTestStepBusinessAction'),
      pass: t('instanceSelfTestStepBusinessPass'),
    },
    {
      id: 'framework-self-isolation',
      number: '11',
      phase: t('instanceSelfTestPhaseSafety'),
      title: t('instanceSelfTestStepIsolationTitle'),
      purpose: t('instanceSelfTestStepIsolationPurpose'),
      kind: 'check' as const,
      action: t('instanceSelfTestStepIsolationAction'),
      pass: t('instanceSelfTestStepIsolationPass'),
    },
    {
      id: 'cleanup',
      number: '12',
      phase: t('instanceSelfTestPhaseCleanup'),
      title: t('instanceSelfTestStepCleanupTitle'),
      purpose: t('instanceSelfTestStepCleanupPurpose'),
      kind: 'check' as const,
      action: t('instanceSelfTestStepCleanupAction'),
      pass: t('instanceSelfTestStepCleanupPass'),
    },
  ];

  const capabilityRows = useMemo(() => {
    if (!manifest) return [];
    return Object.entries(manifest.capabilities);
  }, [manifest]);

  useEffect(() => {
    assetClient.config()
      .then((cfg) => {
        if (cfg.mode === 'business-project') setProjectRoot(cfg.projectRoot);
      })
      .catch(() => undefined);
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (root = projectRoot) => {
    if (!root.trim()) {
      setMessage(t('instanceTargetRequired'));
      return;
    }
    const next = await assetClient.instanceStatus(root.trim());
    setStatus(next);
    try { setRuntime(next.manifest ? await assetClient.instanceRuntime(root.trim(), 'status') : null); }
    catch { setRuntime(null); }
    setPlan(null);
    setMessage(next.manifest ? t('instanceStatusLoaded') : t('instanceNotCreated'));
  };

  const create = () => run(async () => {
    if (!projectRoot.trim()) {
      setMessage(t('instanceTargetRequired'));
      return;
    }
    const result = await assetClient.createInstance(projectRoot.trim(), name.trim() || undefined, initializeKnowledge);
    await refresh(result.manifest.projectRoot);
    await loadInventory();
    setMessage(t('instanceCreated'));
   });

  const verify = () => run(async () => {
    if (!projectRoot.trim()) {
      setMessage(t('instanceTargetRequired'));
      return;
    }
    const result = await assetClient.verifyInstance(projectRoot.trim());
    setStatus((current) => current ? { ...current, manifest: result.manifest, verification: result } : {
      manifest: result.manifest,
      verification: result,
      latestMigration: null,
    });
    setMessage(result.ok ? t('instanceVerifyPass') : t('instanceVerifyFail'));
  });

  const planUpgrade = () => run(async () => {
    if (!projectRoot.trim()) {
      setMessage(t('instanceTargetRequired'));
      return;
    }
    const next = await assetClient.planInstanceUpgrade(projectRoot.trim());
    setPlan(next);
    setMessage(next.status === 'noop' ? t('instanceUpgradeNoop') : t('instanceUpgradePlanned'));
  });

  const applyUpgrade = () => run(async () => {
    if (!projectRoot.trim() || !plan) return;
    const result = await assetClient.applyInstanceUpgrade(projectRoot.trim(), plan.planId);
    setPlan(result.plan);
    await refresh(projectRoot.trim());
    setMessage(result.applied ? t('instanceUpgradeApplied') : t('instanceUpgradeNoop'));
  });

  const rollback = () => run(async () => {
    if (!projectRoot.trim()) return;
    await assetClient.rollbackInstance(projectRoot.trim(), status?.latestMigration?.migrationId);
    await refresh(projectRoot.trim());
    setMessage(t('instanceRollbackDone'));
  });

  const publish = () => run(async () => {
    const result = await assetClient.frameworkRelease('publish');
    setPublished(result.release);
    setMessage(lang === 'zh-CN' ? '已发布并验证不可变运行版本，可启动独立实例。' : 'Verified immutable release published.');
  });
  const manageRuntime = (action: 'start' | 'stop' | 'status' | 'adopt' | 'rollback-release') => run(async () => {
    if (!projectRoot.trim()) { setMessage(t('instanceTargetRequired')); return; }
    const release = action === 'adopt' ? (await assetClient.frameworkRelease('current')).release : null;
    const next = await assetClient.instanceRuntime(projectRoot.trim(), action, release?.releaseId);
    setRuntime(next);
    await loadInventory();
    setMessage(lang === 'zh-CN'
      ? (next.status === 'running' ? '工作台已启动。点击「打开工作台」即可进入。' : '工作台目前未运行。')
      : (next.status === 'running' ? 'Independent workbench is running.' : 'Independent workbench is stopped.'));
  });

  // Starting an existing Instance must not silently publish or adopt a newer build.
  const deployAndStart = () => run(async () => {
    const root = projectRoot.trim();
    if (!root) { setMessage(t('instanceTargetRequired')); return; }
    let current = await assetClient.instanceStatus(root);
    const wasExisting = Boolean(current.manifest);
    if (!current.manifest) {
      await assetClient.createInstance(root, name.trim() || undefined, initializeKnowledge);
      current = await assetClient.instanceStatus(root);
    }
    setStatus(current);
    let release = (await assetClient.frameworkRelease('current')).release;
    if (!release) release = (await assetClient.frameworkRelease('publish')).release;
    if (!release) throw new Error('No verified Framework release available');
    setPublished(release);
    const next = await assetClient.instanceRuntime(root, 'start');
    setRuntime(next);
    await loadInventory();
    setMessage(lang === 'zh-CN'
      ? (wasExisting ? '工作台已启动。点击「打开工作台」进入原来的项目。' : '独立工作台已创建并启动，点击「打开工作台」进入。')
      : (wasExisting ? 'Workbench started. Choose Open to continue.' : 'Workbench created and started. Choose Open to enter.'));
  });
  const launchExisting = (root: string) => run(async () => {
    setProjectRoot(root);
    const current = await assetClient.instanceRuntime(root, 'status');
    if (current.status === 'running') {
      setRuntime(current);
      return;
    }
    // Reuse an existing immutable Framework release; publish only when none exists.
    const publishedRelease = (await assetClient.frameworkRelease('current')).release;
    if (!publishedRelease) await assetClient.frameworkRelease('publish');
    const next = await assetClient.instanceRuntime(root, 'start');
    setRuntime(next);
    await loadInventory();
    setMessage(lang === 'zh-CN' ? '工作台已启动，点击「打开」进入。' : 'Workbench started; choose Open.');
  });
  const runSelfTest = async () => {
    setBusy(true);
    setSelfTestRunning(true);
    setSelfTest(null);
    setSelfTestError('');
    try {
      // This API creates and cleans its own temporary project; no projectRoot is passed.
      const result = await assetClient.runInstanceSelfTest();
      setSelfTest(result);
    } catch (error) {
      setSelfTestError(error instanceof Error ? error.message : String(error));
    } finally {
      setSelfTestRunning(false);
      setBusy(false);
    }
  };

  return (
    <section className="panel instance-lifecycle-panel">
      <div className="instance-lifecycle-heading">
        <div>
          <p className="eyebrow">{t('instanceLifecycleEyebrow')}</p>
          <h2>{t('instanceLifecycleTitle')}</h2>
          <p className="detail-summary">{t('instanceLifecycleLead')}</p>
        </div>
        <PackageCheck size={28} />
      </div>

      <section className="instance-inventory" aria-label={lang === 'zh-CN' ? '我的独立工作台' : 'My workbenches'}>
        <div className="instance-inventory-header">
          <h3>{lang === 'zh-CN' ? '我的独立工作台' : 'My workbenches'}</h3>
          <button className="secondary-button" disabled={busy} onClick={() => void loadInventory()}>{lang === 'zh-CN' ? '刷新列表' : 'Refresh'}</button>
        </div>
        {inventoryError ? <p role="alert" className="engine-check-fail">{inventoryError}</p> : null}
        {knownInstances.length === 0 ? <p className="detail-summary">{lang === 'zh-CN' ? '暂无已登记的运行实例。下方输入项目路径，即可创建第一个独立工作台。' : 'No registered runtimes yet. Enter a project path below to create your first workbench.'}</p> : null}
        <div className="instance-inventory-list">
          {knownInstances.map((item) => (
            <div className="instance-inventory-item" key={item.projectRoot}>
              <button type="button" className="instance-inventory-select" disabled={busy} onClick={() => { selectProject(item.projectRoot); setStage('status'); void refresh(item.projectRoot); }}>
                <strong>{item.projectRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? item.projectRoot}</strong>
                <span>{item.status === 'running' ? (lang === 'zh-CN' ? '运行中' : 'Running') : (lang === 'zh-CN' ? '未运行' : 'Stopped')}</span>
                <span>{item.projectRoot}</span>
              </button>
              <div className="instance-inventory-actions">
                {item.status === 'running' && item.url
                  ? <a className="primary-button" href={item.url} target="_blank" rel="noopener noreferrer">{lang === 'zh-CN' ? '打开工作台 ↗' : 'Open ↗'}</a>
                  : <button className="primary-button" disabled={busy} onClick={() => void launchExisting(item.projectRoot)}>{lang === 'zh-CN' ? '启动' : 'Start'}</button>}
                <button className="secondary-button" disabled={busy} onClick={() => { selectProject(item.projectRoot); setStage('status'); void refresh(item.projectRoot); }}>{lang === 'zh-CN' ? '管理' : 'Manage'}</button>
                {item.status === 'running' ? <button className="secondary-button" disabled={busy} onClick={() => void run(async () => {
                  const next = await assetClient.instanceRuntime(item.projectRoot, 'stop');
                  if (projectRoot === item.projectRoot) setRuntime(next);
                  await loadInventory();
                  setMessage(lang === 'zh-CN' ? '已停止该工作台的后台服务；项目数据仍保留。' : 'Workbench stopped; project data preserved.');
                })}>{lang === 'zh-CN' ? '停止运行' : 'Stop'}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="instance-isolation-note" aria-label={lang === 'zh-CN' ? '项目数据边界' : 'Project data boundary'}>
        <ShieldCheck size={20} />
        <div>
          <strong>{lang === 'zh-CN' ? '项目数据独立保存' : 'Project-scoped storage'}</strong>
          <p>{lang === 'zh-CN' ? '每个工作台的聊天原文、Agent 工作记录和采集事件保存在其绑定的项目目录中。中央 Framework 负责统一管理，不自动合并其他项目的记录。导入来源不明的历史会话仍需人工确认归属。' : 'Transcripts, agent work records and capture events are stored under the bound project. The central Framework manages runtimes without merging project data. Historical imports with unknown origin still require attribution review.'}</p>
          <code>04-conversations/transcripts · 04-conversations/work-records · .asset-workbench-data/capture</code>
        </div>
      </section>
      <section className="instance-guided-flow" aria-label={lang === 'zh-CN' ? '创建并打开独立工作台' : 'Create and open workbench'}>
        <div className="instance-guided-head">
          <div>
            <h3>{lang === 'zh-CN' ? '创建或打开独立工作台' : 'Create or open a Workbench'}</h3>
            <p className="detail-summary">{lang === 'zh-CN'
              ? '新项目只需选择路径并点击一次；已有工作台可以直接启动。系统会自动检查运行版本，不必先手动发布。'
              : 'Select a project and click once. Existing workbenches restart without republishing or upgrading.'}</p>
          </div>
          <span role="status" className={`instance-guided-status ${runtime?.status === 'running' ? 'running' : ''}`}>
            {runtime?.status === 'running' ? (lang === 'zh-CN' ? '运行中' : 'Running')
              : runtime?.status === 'stopped' ? (lang === 'zh-CN' ? '未启动' : 'Stopped')
                : (lang === 'zh-CN' ? '等待选择项目' : 'Choose a project')}
          </span>
        </div>
        <div className="starter-form">
          <label>
            <span>{t('instanceProjectRoot')}</span>
            <input className="root-input" value={projectRoot} onChange={(event) => selectProject(event.target.value)}
              placeholder="/path/to/business-project" spellCheck={false} />
            <small className="instance-field-hint">{lang === 'zh-CN' ? '填写已经存在的业务项目文件夹。每个项目拥有自己的聊天、Provider 设置与知识资产。' : 'An existing project directory. Conversations, Provider settings and knowledge are project-scoped.'}</small>
          </label>
        </div>
        <details className="instance-optional-settings">
          <summary>{lang === 'zh-CN' ? '创建选项（可选）' : 'Creation options (optional)'}</summary>
          <div>
            <label>
              <span>{lang === 'zh-CN' ? '工作台名称（可选）' : 'Workbench name (optional)'}</span>
              <input className="root-input" value={name} onChange={(event) => setName(event.target.value)}
                placeholder="payment-service" spellCheck={false} />
              <small className="instance-field-hint">{lang === 'zh-CN' ? '只在首次创建时使用，已有工作台不会改名' : 'Only used when creating a new Instance'}</small>
            </label>
            <label className="instance-checkbox">
              <input type="checkbox" checked={initializeKnowledge} onChange={(event) => setInitializeKnowledge(event.target.checked)} />
              <span>{lang === 'zh-CN' ? '首次创建时同时初始化 00–05 知识目录（仅适用于符合初始化条件的项目）' : 'Initialize 00–05 knowledge on first creation (eligible projects only)'}</span>
            </label>
          </div>
        </details>
        <div className="instance-guided-steps">
          <div><span>1</span><strong>{lang === 'zh-CN' ? '选择项目' : 'Choose project'}</strong><small>{lang === 'zh-CN' ? '填写目录，或从上方列表选择' : 'Enter path or select above'}</small></div>
          <div><span>2</span><strong>{lang === 'zh-CN' ? '自动准备并启动' : 'Prepare and start'}</strong><small>{lang === 'zh-CN' ? '首次自动创建并准备运行包；已创建的不会自动升级' : 'Create and publish only when needed; no silent upgrades'}</small></div>
          <div><span>3</span><strong>{lang === 'zh-CN' ? '打开完整工作台' : 'Open full Workbench'}</strong><small>{lang === 'zh-CN' ? '进入项目专属资产、聊天、Provider 与知识学习页面' : 'Assets, transcripts, Providers and project knowledge'}</small></div>
        </div>
        <div className="instance-guided-actions">
          {runtime?.status === 'running' && runtime.url
            ? <a className="primary-button instance-guided-primary" href={runtime.url} target="_blank" rel="noopener noreferrer">
              {lang === 'zh-CN' ? '打开工作台 ↗' : 'Open Workbench ↗'}
            </a>
            : <button type="button" className="primary-button instance-guided-primary" disabled={busy || !projectRoot.trim()}
                onClick={() => void deployAndStart()}>
              {busy ? (lang === 'zh-CN' ? '正在处理，请稍候…' : 'Working…')
                : manifest ? (lang === 'zh-CN' ? '启动独立工作台' : 'Start Workbench')
                : (lang === 'zh-CN' ? '一键创建或启动工作台' : 'Create or start Workbench')}
            </button>}
          <span className="instance-guided-action-help">{lang === 'zh-CN'
            ? '启动只会运行工作台；不会自动打开新网页，也不会修改项目业务代码。成功后点击「打开工作台」。'
            : 'Starting does not open a browser automatically or change business code. Choose Open when ready.'}</span>
        </div>
        {published ? (
          <small className="instance-release-hint">
            {lang === 'zh-CN' ? '中央运行包已就绪' : 'Central runtime ready'} · {published.releaseId} · {(published.totalBytes / 1048576).toFixed(2)} MiB
          </small>
        ) : (
          <small className="instance-release-hint">{lang === 'zh-CN' ? '若首次使用尚无运行包，系统将在首次创建时自动发布。' : 'If no release exists, first-time setup will publish it automatically.'}</small>
        )}
      </section>
      {message ? <p role="status" className="detail-summary starter-message">{message}</p> : null}
      <details className="instance-advanced-management">
        <summary>{lang === 'zh-CN' ? '高级管理 · 状态验证、版本发布、升级和回滚' : 'Advanced management · Verify, publish, upgrade and rollback'}</summary>
        <p className="detail-summary">{lang === 'zh-CN'
          ? '日常创建和启动不需要使用下列按钮。仅当你要检查故障、发布 Framework 新版本或主动升级、恢复实例时使用。'
          : 'Not needed for everyday work. Use only for diagnostics, publishing a new Framework release or explicit upgrade and recovery.'}</p>
        <div className="instance-stage-nav" role="group" aria-label="Instance lifecycle">
          {([
            ['create', '① 创建实例', 'Create'],
            ['status', '② 状态与验证', 'Status / Verify'],
            ['upgrade', '③ 实例升级', 'Upgrade'],
            ['migration', '④ 迁移与回滚', 'Migration / Rollback'],
          ] as const).map(([id, zh, en]) => (
            <button type="button" key={id} className={`secondary-button instance-stage-button ${stage === id ? 'selected' : ''}`}
              aria-pressed={stage === id} onClick={() => setStage(id)}>
              {lang === 'zh-CN' ? zh : en}
            </button>
          ))}
        </div>
        <p className="detail-summary">{stage === 'create' ? '仅创建实例身份，不会启动工作台。'
          : stage === 'status' ? '读取当前 Instance 的 Manifest 和验证结果。'
            : stage === 'upgrade' ? '生成计划、确认差异并主动升级 Manifest。'
              : '查看已有迁移记录，并根据实际备份条件回滚 Manifest。'}</p>
        <div className="hero-actions">
          {stage === 'create' ? <button className="secondary-button" disabled={busy || !projectRoot.trim()} onClick={() => void create()}>{t('instanceCreateAction')}</button> : null}
          <button className="secondary-button" disabled={busy || !projectRoot.trim()} onClick={() => void run(() => refresh())}>{t('instanceLoadAction')}</button>
          {stage === 'status' ? <button className="secondary-button" disabled={busy || !manifest} onClick={() => void verify()}><ShieldCheck size={16} /> {t('instanceVerifyAction')}</button> : null}
          {stage === 'upgrade' ? <button className="secondary-button" disabled={busy || !manifest} onClick={() => void planUpgrade()}><GitCompareArrows size={16} /> {t('instancePlanAction')}</button> : null}
          {stage === 'upgrade' ? <button className="secondary-button" disabled={busy || !canApply} onClick={() => void applyUpgrade()}>{t('instanceApplyAction')}</button> : null}
          {stage === 'migration' ? <button className="secondary-button" disabled={busy || !canRollback} onClick={() => void rollback()}><RotateCcw size={16} /> {t('instanceRollbackAction')}</button> : null}
        </div>
        <section className="instance-runtime-controls">
          <strong>{lang === 'zh-CN' ? '运行版本与维护' : 'Runtime release maintenance'}</strong>
          <p className="detail-summary">{lang === 'zh-CN'
            ? '「发布运行版本」为中央 Framework 构建新的共享运行包，不是创建工作台，也不是启动按钮。「采用最新运行版本」会主动切换所选实例的程序版本；回退仅在存在旧版本记录时可用。'
            : 'Publish builds a shared Framework release; it does not create or start an Instance. Adopt switches the selected Instance release intentionally.'}</p>
          <div className="hero-actions">
            <button className="secondary-button" disabled={busy} onClick={() => void publish()}>{lang === 'zh-CN' ? '发布中央运行版本' : 'Publish Framework release'}</button>
            <button className="secondary-button" disabled={busy || !projectRoot.trim() || !manifest} onClick={() => void manageRuntime('status')}>{lang === 'zh-CN' ? '检查运行状态' : 'Runtime status'}</button>
            <button className="secondary-button" disabled={busy || !manifest} onClick={() => void manageRuntime('adopt')}>{lang === 'zh-CN' ? '采用最新运行版本' : 'Adopt latest release'}</button>
            <button className="secondary-button" disabled={busy || !runtime?.previousReleaseId} onClick={() => void manageRuntime('rollback-release')}>{lang === 'zh-CN' ? '回退应用版本' : 'Rollback app release'}</button>
            <button className="secondary-button" disabled={busy || runtime?.status !== 'running'} onClick={() => void manageRuntime('stop')}>{lang === 'zh-CN' ? '停止运行' : 'Stop Workbench'}</button>
          </div>
        </section>
        <details className="creator-advanced-cli"><summary>CLI · 高级详情 / Advanced commands</summary><div className="starter-cli-map">
          <div>
            <strong>{t('instanceCliCreate')}</strong>
            <code>npm run creator -- instance create --project &lt;directory&gt;</code>
          </div>
          <div>
            <strong>{t('instanceCliLifecycle')}</strong>
            <code>npm run creator -- instance upgrade-plan --project &lt;directory&gt;</code>
            <code>npm run creator -- instance rollback --project &lt;directory&gt;</code>
          </div>
        </div></details>
      {(stage === 'status' || stage === 'create') && manifest ? (
        <div className="instance-manifest-card">
          <div className="instance-manifest-head">
            <CheckCircle2 size={18} />
            <strong>{t('instanceManifestTitle')}</strong>
            <code>{manifest.instanceId}</code>
          </div>
          <div className="instance-manifest-grid">
            <div><span>{t('instanceFrameworkVersion')}</span><strong>{manifest.framework.version}</strong></div>
            <div><span>{t('instanceFrameworkRevision')}</span><strong>{manifest.framework.revision}</strong></div>
            <div><span>{t('instanceGeneration')}</span><strong>{manifest.generation}</strong></div>
            <div><span>{t('instanceKnowledgeState')}</span><strong>{manifest.knowledge.status}</strong></div>
          </div>
          <div className="instance-capability-list">
            {capabilityRows.map(([id, version]) => <span key={id}><code>{id}</code><strong>v{version}</strong></span>)}
          </div>
        </div>
      ) : null}

      {stage === 'status' && status?.verification ? (
        <div className={status.verification.ok ? 'starter-verification pass' : 'starter-verification fail'}>
          <div className="starter-verification-head">
            {status.verification.ok ? <CheckCircle2 size={20} /> : <CircleX size={20} />}
            <div>
              <strong>{t('instanceVerificationTitle')}</strong>
              <span>{status.verification.upToDate ? t('instanceUpToDate') : t('instanceNeedsUpgrade')}</span>
            </div>
          </div>
          <div className="starter-verification-list">
            {status.verification.checks.map((check) => (
              <div key={check.id} className={check.ok ? 'pass' : 'fail'}>
                {check.ok ? <CheckCircle2 size={14} /> : <CircleX size={14} />}
                <code>{check.id}</code>
                <small>{check.detail}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {stage === 'upgrade' && plan ? (
        <div className="instance-upgrade-plan">
          <div className="instance-manifest-head">
            <GitCompareArrows size={18} />
            <strong>{t('instanceUpgradePlanTitle')}</strong>
            <span className={`framework-capability-status ${plan.status === 'noop' ? 'available' : 'partial'}`}>{plan.status}</span>
          </div>
          {plan.actions.length === 0 ? <p>{t('instanceUpgradeNoChanges')}</p> : (
            <div className="instance-plan-actions">
              {plan.actions.map((action) => (
                <div key={action.id}>
                  <code>{action.id}</code>
                  <span>{action.from}</span>
                  <b>→</b>
                  <span>{action.to}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {stage === 'migration' && status?.latestMigration ? (
        <div className="instance-migration-evidence">
          <strong>{t('instanceMigrationEvidence')}</strong>
          <code>{status.latestMigration.migrationId}</code>
          <span>{status.latestMigration.status}</span>
          <small>{status.latestMigration.backupPath}</small>
        </div>
      ) : null}

      </details>
      <section className="instance-engine-self-test" aria-labelledby="instance-engine-self-test-title">
        <div className="instance-engine-self-test-heading">
          <div>
            <h3 id="instance-engine-self-test-title">{t('instanceEngineSelfTestTitle')}</h3>
            <small>{t('instanceEngineSelfTestLead')}</small>
          </div>
        </div>
        <div className="instance-engine-self-test-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void runSelfTest()}>
            <Stethoscope size={16} /> {t('instanceSelfTestAction')}
          </button>
          {selfTestRunning ? <small role="status">{t('instanceSelfTestRunning')}</small> : null}
          {!selfTestRunning && selfTest ? (
            <small role="status" className={selfTest.ok ? 'engine-check-pass' : 'engine-check-fail'}>
              {selfTest.ok ? t('instanceSelfTestPass') : t('instanceSelfTestFail')}
            </small>
          ) : null}
          {selfTestError ? <small role="alert" className="engine-check-fail">{selfTestError}</small> : null}
        </div>
        {selfTest ? (
        <div className={selfTest.ok ? 'instance-self-test pass' : 'instance-self-test fail'}>
          <div className="instance-self-test-head">
            <div className="instance-self-test-title">
              {selfTest.ok ? <CheckCircle2 size={20} /> : <CircleX size={20} />}
              <div>
                <strong>{t('instanceSelfTestTitle')}</strong>
                <span>{selfTest.ok ? t('instanceSelfTestPassHuman') : t('instanceSelfTestFailHuman')}</span>
              </div>
            </div>
            <code className="instance-self-test-machine-status">{selfTest.ok ? 'SELF_TEST_PASS' : 'SELF_TEST_FAIL'}</code>
          </div>

          <div className="instance-self-test-route">
            <strong>{t('instanceSelfTestRouteTitle')}</strong>
            <span>{t('instanceSelfTestRoute')}</span>
          </div>

          <div className="instance-self-test-meta">
            <span>{t('instanceFrameworkVersion')}: <strong>{selfTest.framework.version}</strong></span>
            <span>{t('instanceFrameworkRevision')}: <strong>{selfTest.framework.revision}</strong></span>
          </div>

          <div className="instance-self-test-flow">
            {selfTestFlow.map((item) => {
              const result = selfTest.steps.find((step) => step.id === item.id);
              const state = result?.ok ? 'pass' : result ? 'fail' : 'pending';
              return (
                <article className={`instance-self-test-flow-step ${state}`} key={item.id}>
                  <div className="instance-self-test-step-index">{item.number}</div>
                  <div className="instance-self-test-step-content">
                    <div className="instance-self-test-step-heading">
                      <div>
                        <small>{item.phase}</small>
                        <strong>{item.title}</strong>
                      </div>
                      <span className={`instance-self-test-step-status ${state}`}>
                        {result?.ok ? <CheckCircle2 size={14} /> : result ? <CircleX size={14} /> : <CircleDashed size={14} />}
                        {result?.ok ? t('instanceSelfTestStatusPass') : result ? t('instanceSelfTestStatusFail') : t('instanceSelfTestStatusPending')}
                      </span>
                    </div>
                    <div className="instance-self-test-learning-row">
                      <span>{t('instanceSelfTestPurposeLabel')}</span>
                      <p>{item.purpose}</p>
                    </div>
                    <div className="instance-self-test-learning-row">
                      <span>{item.kind === 'command' ? t('instanceSelfTestCommandLabel') : t('instanceSelfTestCheckLabel')}</span>
                      <code>{item.action}</code>
                    </div>
                    <div className="instance-self-test-learning-row">
                      <span>{t('instanceSelfTestPassCriteriaLabel')}</span>
                      <p>{item.pass}</p>
                    </div>
                    {result && !result.ok ? (
                      <div className="instance-self-test-failure">
                        <strong>{t('instanceSelfTestFailureReason')}</strong>
                        <code>{result.detail}</code>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <details className="instance-self-test-technical">
            <summary>{t('instanceSelfTestTechnicalDetails')}</summary>
            <p>{t('instanceSelfTestTechnicalDetailsHint')}</p>
            <div>
              {selfTest.steps.map((step) => (
                <div key={step.id}>
                  <code>{step.id}</code>
                  <span>{step.detail}</span>
                </div>
              ))}
            </div>
          </details>

          <p className="detail-summary">{t('instanceSelfTestCleanup')}</p>
        </div>
      ) : null}
      </section>

      <p className="starter-safety">{t('instanceSafety')}</p>
    </section>
  );
}
