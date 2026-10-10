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
  const [runtime, setRuntime] = useState<{ status: 'running' | 'stopped'; url: string | null; pid: number | null } | null>(null);

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
    await assetClient.setRoot(result.manifest.projectRoot);
    await refresh(result.manifest.projectRoot);
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
    setMessage(lang === 'zh-CN'
      ? (next.status === 'running' ? '独立工作台运行中，可点击打开。' : '独立工作台未运行。')
      : (next.status === 'running' ? 'Independent workbench is running.' : 'Independent workbench is stopped.'));
  });

  const deployAndStart = () => run(async () => {
    if (!projectRoot.trim()) { setMessage(t('instanceTargetRequired')); return; }
    let active = manifest;
    if (!active) {
      const created = await assetClient.createInstance(projectRoot.trim(), name.trim() || undefined, initializeKnowledge);
      active = created.manifest;
      setStatus({ manifest: created.manifest, verification: null, latestMigration: null } as InstanceStatusView);
    }
    const release = (await assetClient.frameworkRelease('publish')).release;
    if (!release) throw new Error('Framework release publication returned no build');
    setPublished(release);
    await assetClient.instanceRuntime(projectRoot.trim(), 'adopt', release.releaseId);
    const next = await assetClient.instanceRuntime(projectRoot.trim(), 'start');
    setRuntime(next);
    setMessage(lang === 'zh-CN' ? '独立工作台部署成功，已启动。' : 'Independent Workbench deployed and running.');
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
      <p className="detail-summary">{stage === 'create' ? '绑定一个业务项目，选择是否同时初始化 00–05 知识目录。'
        : stage === 'status' ? '查看当前实例的真实 Manifest 和验证结果。'
        : stage === 'upgrade' ? '先生成版本差异计划，确认可执行后应用；不会自动改写业务代码。'
        : '查看迁移证据及备份，只在存在可回滚记录时允许回滚。'}</p>
      <div className="starter-form">
        <label>
          <span>{t('instanceProjectRoot')}</span>
          <input className="root-input" value={projectRoot} onChange={(event) => setProjectRoot(event.target.value)} placeholder="/path/to/business-project" spellCheck={false} />
        </label>
        <label>
          <span>{t('instanceProjectName')}</span>
          <input className="root-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="payment-service" spellCheck={false} />
        </label>
      </div>

      {stage === 'create' ? <label className="instance-checkbox">
        <input type="checkbox" checked={initializeKnowledge} onChange={(event) => setInitializeKnowledge(event.target.checked)} />
        <span>{t('instanceInitializeKnowledge')}</span>
      </label> : null}

      <div className="hero-actions">
        {stage === 'create' ? <button className="primary-button" disabled={busy} onClick={() => void create()}>{t('instanceCreateAction')}</button> : null}
        <button className="secondary-button" disabled={busy || !projectRoot.trim()} onClick={() => void run(() => refresh())}>{t('instanceLoadAction')}</button>
        {stage === 'status' ? <button className="secondary-button" disabled={busy || !manifest} onClick={() => void verify()}><ShieldCheck size={16} /> {t('instanceVerifyAction')}</button> : null}
        {stage === 'upgrade' ? <button className="secondary-button" disabled={busy || !manifest} onClick={() => void planUpgrade()}><GitCompareArrows size={16} /> {t('instancePlanAction')}</button> : null}
        {stage === 'upgrade' ? <button className="secondary-button" disabled={busy || !canApply} onClick={() => void applyUpgrade()}>{t('instanceApplyAction')}</button> : null}
        {stage === 'migration' ? <button className="secondary-button" disabled={busy || !canRollback} onClick={() => void rollback()}><RotateCcw size={16} /> {t('instanceRollbackAction')}</button> : null}
      </div>

      <section className="instance-runtime-controls">
        <div>
          <strong>{lang === 'zh-CN' ? '独立工作台 · 运行管理' : 'Independent Workbench · Runtime'}</strong>
          <p className="detail-summary">{lang === 'zh-CN'
            ? '复用中央 V3 功能，但使用专属进程、入口地址和项目数据。无需复制整套源码；先点击“发布运行版本”，系统自动构建和校验；每个实例无需独立安装依赖。'
            : 'Shares the central V3 implementation with a dedicated process, local URL and project data. Publish and verify the shared runtime once; no per-instance installation.'}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" disabled={busy || !projectRoot.trim()} onClick={() => void deployAndStart()}>
            {lang === 'zh-CN' ? '一键创建、部署并启动' : 'Create, deploy & start'}
          </button>
          <button className="secondary-button" disabled={busy} onClick={() => void publish()}>
            {lang === 'zh-CN' ? '发布运行版本' : 'Publish runtime'}
          </button>
          <button className="secondary-button" disabled={busy || !projectRoot.trim() || !manifest} onClick={() => void manageRuntime('status')}>{lang === 'zh-CN' ? '检查运行状态' : 'Runtime status'}</button>
          <button className="primary-button" disabled={busy || !manifest || runtime?.status === 'running'} onClick={() => void manageRuntime('start')}>{lang === 'zh-CN' ? '启动独立工作台' : 'Start Workbench'}</button>
          <button className="secondary-button" disabled={busy || !manifest} onClick={() => void manageRuntime('adopt')}>
            {lang === 'zh-CN' ? '采用最新运行版本' : 'Adopt latest release'}
          </button>
          <button className="secondary-button" disabled={busy || !manifest} onClick={() => void manageRuntime('rollback-release')}>
            {lang === 'zh-CN' ? '回退应用版本' : 'Rollback app release'}
          </button>
          <button className="secondary-button" disabled={busy || runtime?.status !== 'running'} onClick={() => void manageRuntime('stop')}>{lang === 'zh-CN' ? '停止' : 'Stop'}</button>
          {runtime?.status === 'running' && runtime.url ? (
            <a className="secondary-button" href={runtime.url} target="_blank" rel="noopener noreferrer">{lang === 'zh-CN' ? '打开独立工作台 ↗' : 'Open Workbench ↗'}</a>
          ) : null}
        </div>
        {published ? <small>{lang === 'zh-CN' ? '已发布：' : 'Published: '}{published.releaseId} · {(published.totalBytes / 1048576).toFixed(2)} MiB</small> : null}
        <small>{runtime?.status === 'running' ? `RUNNING · ${runtime.url}` : lang === 'zh-CN' ? '尚未启动或尚未检查' : 'Stopped or not checked'}</small>
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

      {message ? <p className="detail-summary starter-message">{message}</p> : null}

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
