import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleX, GitCompareArrows, PackageCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import { assetClient, type InstanceSelfTestView, type InstanceStatusView, type InstanceUpgradePlanView } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';

export function InstanceLifecyclePanel() {
  const { t } = useI18n();
  const [projectRoot, setProjectRoot] = useState('');
  const [name, setName] = useState('');
  const [initializeKnowledge, setInitializeKnowledge] = useState(false);
  const [status, setStatus] = useState<InstanceStatusView | null>(null);
  const [plan, setPlan] = useState<InstanceUpgradePlanView | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selfTest, setSelfTest] = useState<InstanceSelfTestView | null>(null);

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

  const runSelfTest = () => run(async () => {
    setSelfTest(null);
    setMessage(t('instanceSelfTestRunning'));
    const result = await assetClient.runInstanceSelfTest();
    setSelfTest(result);
    setMessage(result.ok ? t('instanceSelfTestPass') : t('instanceSelfTestFail'));
  });

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

      <label className="instance-checkbox">
        <input type="checkbox" checked={initializeKnowledge} onChange={(event) => setInitializeKnowledge(event.target.checked)} />
        <span>{t('instanceInitializeKnowledge')}</span>
      </label>

      <div className="hero-actions">
        <button className="primary-button" disabled={busy} onClick={() => void create()}>{t('instanceCreateAction')}</button>
        <button className="secondary-button" disabled={busy || !projectRoot.trim()} onClick={() => void run(() => refresh())}>{t('instanceLoadAction')}</button>
        <button className="secondary-button" disabled={busy || !manifest} onClick={() => void verify()}><ShieldCheck size={16} /> {t('instanceVerifyAction')}</button>
        <button className="secondary-button" disabled={busy || !manifest} onClick={() => void planUpgrade()}><GitCompareArrows size={16} /> {t('instancePlanAction')}</button>
        <button className="secondary-button" disabled={busy || !canApply} onClick={() => void applyUpgrade()}>{t('instanceApplyAction')}</button>
        <button className="secondary-button" disabled={busy || !canRollback} onClick={() => void rollback()}><RotateCcw size={16} /> {t('instanceRollbackAction')}</button>
        <button className="secondary-button" disabled={busy} onClick={() => void runSelfTest()}><ShieldCheck size={16} /> {t('instanceSelfTestAction')}</button>
      </div>

      <div className="starter-cli-map">
        <div>
          <strong>{t('instanceCliCreate')}</strong>
          <code>npm run creator -- instance create --project &lt;directory&gt;</code>
        </div>
        <div>
          <strong>{t('instanceCliLifecycle')}</strong>
          <code>npm run creator -- instance upgrade-plan --project &lt;directory&gt;</code>
          <code>npm run creator -- instance rollback --project &lt;directory&gt;</code>
        </div>
      </div>

      {message ? <p className="detail-summary starter-message">{message}</p> : null}

      {manifest ? (
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

      {status?.verification ? (
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

      {plan ? (
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

      {status?.latestMigration ? (
        <div className="instance-migration-evidence">
          <strong>{t('instanceMigrationEvidence')}</strong>
          <code>{status.latestMigration.migrationId}</code>
          <span>{status.latestMigration.status}</span>
          <small>{status.latestMigration.backupPath}</small>
        </div>
      ) : null}

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

      <p className="starter-safety">{t('instanceSafety')}</p>
    </section>
  );
}
