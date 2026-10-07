import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BookOpen,
  CircleHelp,
  KeyRound,
  Plug,
  Plus,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  X,
} from 'lucide-react';
import { assetClient, type ProviderDetailView, type ProviderStatusView } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';
import { KnowledgeLifecycle } from './KnowledgeLifecycle';
import type { AppSection } from '../domain/workspace';

type Tab = 'intro' | 'manage';

const ONBOARDING_SEEN_KEY = 'aw3-provider-onboarding-seen';

function initialTab(): Tab {
  try { return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1' ? 'manage' : 'intro'; } catch { return 'intro'; }
}

function labelFromMap(value: string, map: Record<string, string>, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

const AUTH_KEYS: Record<string, string> = {
  NOT_REQUIRED: 'providerAuthNone',
  MANUAL_IMPORT: 'providerAuthManual',
  EXISTING_SESSION: 'providerAuthSession',
  OAUTH_SESSION: 'providerAuthOauth',
  EXTERNAL: 'providerAuthExternal',
  ENVIRONMENT: 'providerAuthEnv',
  CONFIGURED: 'providerAuthConfigured',
  NOT_CONFIGURED: 'providerAuthMissing',
  VERIFIED: 'providerAuthVerified',
  INVALID: 'providerAuthInvalid',
};

const SOURCE_KEYS: Record<string, string> = {
  hooks: 'providerSourceHooks',
  plugin: 'providerSourcePlugin',
  'event-stream': 'providerSourceStream',
  'cli-json': 'providerSourceCli',
  'export-import': 'providerSourceExport',
  'manual-import': 'providerSourceManual',
  custom: 'providerSourceCustom',
};

const FINAL_KEYS: Record<string, string> = {
  'explicit-event': 'providerFinalExplicit',
  'session-idle': 'providerFinalIdle',
  'stop-event': 'providerFinalStop',
  'next-session': 'providerFinalNext',
  manual: 'providerFinalManual',
  custom: 'providerFinalCustom',
};

const STATUS_KEYS: Record<string, string> = {
  ENABLED: 'providerStatusEnabled',
  DISABLED: 'providerStatusDisabled',
  LIMITED: 'providerStatusLimited',
  BLOCKED_AUTH: 'providerStatusBlockedAuth',
  NOT_INSTALLED: 'providerStatusNotInstalled',
  UNSUPPORTED_VERSION: 'providerStatusUnsupported',
  WAITING_REAL_EVENT: 'providerStatusWaitingEvent',
  ERROR: 'providerStatusError',
};

const STEP_KEYS: Record<string, string> = {
  Discovery: 'providerStepDiscovery',
  Authentication: 'providerStepAuth',
  Integration: 'providerStepIntegration',
  'Real Event': 'providerStepEvent',
  Transcript: 'providerStepTranscript',
};

const PROVIDER_DESCRIPTION_KEYS: Record<string, string> = {
  codex: 'providerDescCodex',
  codebuddy: 'providerDescCodebuddy',
  opencode: 'providerDescOpencode',
  trae: 'providerDescTrae',
  codearts: 'providerDescCodearts',
  chatgpt: 'providerDescChatgpt',
  workbuddy: 'providerDescWorkbuddy',
};

function verificationDetail(status: string, t: (key: string) => string): string {
  if (status === 'PASS') return t('providerVerificationPass');
  if (status === 'BLOCKED') return t('providerVerificationBlocked');
  if (status === 'FAIL') return t('providerVerificationFail');
  return t('providerVerificationWaiting');
}

export function ProviderManager({ onNavigate, onOpenAsset }: { onNavigate: (section: AppSection) => void; onOpenAsset: (path: string) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);

  const openManage = () => {
    try { localStorage.setItem(ONBOARDING_SEEN_KEY, '1'); } catch { /* noop */ }
    setTab('manage');
  };

  return (
    <main className="page provider-manager">
      <section className="topbar">
        <div>
          <p className="eyebrow">AI CONNECTION</p>
          <h1>{t('providerPageTitle')}</h1>
          <p>{t('providerPageLead')}</p>
        </div>
      </section>

      <div className="provider-tabs">
        <button className={tab === 'intro' ? 'selected' : ''} onClick={() => setTab('intro')}>
          <BookOpen size={16}/>{t('providerIntroTab')}
        </button>
        <button className={tab === 'manage' ? 'selected' : ''} onClick={openManage}>
          <Plug size={16}/>{t('providerManageTab')}
        </button>
      </div>

      {tab === 'intro' ? <ProviderIntro onManage={openManage} onFramework={() => onNavigate('framework')} onOpenAsset={onOpenAsset} /> : <ProviderConsole />}
    </main>
  );
}

function ProviderIntro({ onManage, onFramework, onOpenAsset }: { onManage: () => void; onFramework: () => void; onOpenAsset: (path: string) => void }) {
  const { t } = useI18n();
  const flow = ['providerFlowChat', 'providerFlowSource', 'providerFlowAdapter', 'providerFlowKernel', 'providerFlowTranscript', 'providerFlowAsset'];
  const concepts = [
    ['providerConceptProviderTitle', 'providerConceptProviderBody'],
    ['providerConceptHookTitle', 'providerConceptHookBody'],
    ['providerConceptPluginTitle', 'providerConceptPluginBody'],
    ['providerConceptAcpTitle', 'providerConceptAcpBody'],
    ['providerConceptTranscriptTitle', 'providerConceptTranscriptBody'],
    ['providerConceptWorkTitle', 'providerConceptWorkBody'],
    ['providerConceptVerifyTitle', 'providerConceptVerifyBody'],
    ['providerConceptLimitedTitle', 'providerConceptLimitedBody'],
  ] as const;

  return (
    <div className="provider-intro">
      <section className="panel provider-intro-hero">
        <div>
          <p className="eyebrow">{t('providerIntroEyebrow')}</p>
          <h2>{t('providerIntroTitle')}</h2>
          <p>{t('providerIntroLead')}</p>
        </div>
        <button className="primary-button" onClick={onManage}>{t('providerGoManage')}</button>
      </section>

      <section className="panel">
        <h2>{t('providerFlowTitle')}</h2>
        <div className="capture-flow">
          {flow.map((key, index) => (
            <div key={key} className="capture-flow-item"><span>{index + 1}</span><strong>{t(key)}</strong></div>
          ))}
        </div>
      </section>

      <KnowledgeLifecycle
        compact
        titleKey="providerKnowledgeTitle"
        leadKey="providerKnowledgeLead"
        onOpenConversations={() => onOpenAsset('04-conversations')}
        onOpenDecisions={() => onOpenAsset('02-design/decisions')}
      />

      <section className="provider-concept-grid">
        {concepts.map(([title, body]) => <Concept key={title} title={t(title)} body={t(body)} />)}
      </section>

      <section className="panel provider-sdk-cta">
        <div>
          <p className="eyebrow">{t('providerDeveloperEyebrow')}</p>
          <h2>{t('providerDeveloperTitle')}</h2>
          <p>{t('providerDeveloperLead')}</p>
        </div>
        <button className="secondary-button" onClick={onFramework}>
          <Plug size={16}/>{t('providerDeveloperAction')}
        </button>
      </section>

      <section className="panel">
        <h2>{t('providerCompareTitle')}</h2>
        <div className="concept-compare">
          <div><strong>Hook</strong><span>{t('providerCompareHook')}</span><small>Codex / CodeBuddy / Trae</small></div>
          <div><strong>Plugin</strong><span>{t('providerComparePlugin')}</span><small>OpenCode</small></div>
          <div><strong>ACP</strong><span>{t('providerCompareAcp')}</span><small>{t('providerCompareAcpNote')}</small></div>
          <div><strong>Transcript</strong><span>{t('providerCompareTranscript')}</span><small>{t('providerCompareTranscriptNote')}</small></div>
        </div>
      </section>
    </div>
  );
}

function Concept({ title, body }: { title: string; body: string }) {
  return <article className="panel provider-concept"><CircleHelp size={20}/><h3>{title}</h3><p>{body}</p></article>;
}

function ProviderConsole() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderStatusView[]>([]);
  const [selected, setSelected] = useState('codex');
  const selectedRef = useRef('codex');
  const [detail, setDetail] = useState<ProviderDetailView | null>(null);
  const [message, setMessage] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [ak, setAk] = useState('');
  const [sk, setSk] = useState('');
  const [detectedAt, setDetectedAt] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = async (force = false) => {
    setRefreshing(force);
    try {
      const overview = await assetClient.providerOverview(force);
      setProviders(overview.providers);
      setDetectedAt(overview.detectedAt);
      const id = selectedRef.current || overview.providers[0]?.provider;
      if (id) {
        const next = await assetClient.providerDetail(id, force);
        if (selectedRef.current === id) setDetail(next);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadOverview(false); }, []);

  const choose = async (id: string) => {
    selectedRef.current = id;
    setSelected(id);
    setMessage('');
    const next = await assetClient.providerDetail(id, false);
    if (selectedRef.current === id) setDetail(next);
  };

  const action = async (name: string, body: Record<string, unknown> = {}) => {
    try {
      const result = await assetClient.providerAction(selected, name, body);
      if (name === 'run-verification' && result?.verification) {
        setDetail(result as ProviderDetailView);
        setMessage(`${t('providerVerificationDone')} ${new Date(result.verificationRunAt).toLocaleString()}`);
        await loadOverview(false);
      } else {
        setMessage(result.detail ?? (name === 'credentials' ? t('providerCredentialsSaved') : t('providerActionDone')));
        await loadOverview(false);
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const statusLabel = (value: string) => labelFromMap(value, STATUS_KEYS, t);
  const authLabel = (value: string) => labelFromMap(value, AUTH_KEYS, t);
  const sourceLabel = (value: string) => labelFromMap(value, SOURCE_KEYS, t);
  const finalizationLabel = (value: string) => labelFromMap(value, FINAL_KEYS, t);
  const stepLabel = (value: string) => labelFromMap(value, STEP_KEYS, t);

  return <>
    <section className="topbar provider-console-head">
      <div>
        <p className="eyebrow">PROVIDER MANAGER</p>
        <h2>{t('providerConsoleTitle')}</h2>
        <p>{t('providerConsoleLead')}</p>
        {detectedAt ? <small className="provider-detected-at">{t('providerDetectedAt')} {new Date(detectedAt).toLocaleString()}</small> : null}
      </div>
      <div className="hero-actions">
        <button className="secondary-button" disabled={refreshing} onClick={() => void loadOverview(true)}>
          <RefreshCw size={16}/>{refreshing ? t('providerDetecting') : t('providerRedetect')}
        </button>
        <button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={16}/>{t('providerAdd')}</button>
      </div>
    </section>

    <section className="provider-grid">
      <div className="panel">
        <h2>{t('providerOverviewTitle')}</h2>
        <p className="note">{t('providerOverviewNote')}</p>
        <div className="provider-table">
          <div className="provider-head">{t('providerOverviewHead')}</div>
          {providers.map((item) => {
            const status = item.platformStatus ?? item.status;
            return <button key={item.provider} className={`provider-row ${selected === item.provider ? 'selected' : ''}`} onClick={() => void choose(item.provider)}>
              <strong>{item.provider}</strong>
              <span>{item.installed === false && item.provider !== 'chatgpt' ? t('providerNotInstalled') : t('providerAvailable')}</span>
              <span>{item.runtimeVerified ? 'E2E PASS' : t('providerE2ENotReady')}</span>
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
              <p>{PROVIDER_DESCRIPTION_KEYS[selected] ? t(PROVIDER_DESCRIPTION_KEYS[selected]) : detail.definition.description}</p>
            </div>
            <span className={`status-badge ${detail.status.platformStatus.toLowerCase().replaceAll('_','-')}`}>{statusLabel(detail.status.platformStatus)}</span>
          </div>

          <div className="provider-summary-row">
            <span>{t('providerInstall')}: <strong>{detail.status.installed === false && selected !== 'chatgpt' ? t('providerNotInstalled') : t('providerAvailable')}</strong></span>
            <span>{t('providerVersion')}: <strong>{detail.status.version ?? '—'}</strong></span>
            <span>{t('providerEvidence')}: <strong>{detail.status.runtimeVerified ? t('providerEvidenceReady') : selected === 'chatgpt' ? t('providerRealtimeNA') : t('providerWaitingReal')}</strong></span>
          </div>

          <div className="provider-capability-grid">
            <CapabilityCard
              icon={<KeyRound size={20}/>}
              title={t('providerAuthCard')}
              value={authLabel(detail.status.authStatus)}
              help={t('providerAuthHelp')}
            />
            <CapabilityCard
              icon={<RadioTower size={20}/>}
              title={t('providerSourceCard')}
              value={sourceLabel(detail.definition.eventSource.type)}
              help={t('providerSourceHelp')}
            />
            <CapabilityCard
              icon={<TimerReset size={20}/>}
              title={t('providerFinalCard')}
              value={finalizationLabel(detail.definition.finalization.strategy)}
              help={t('providerFinalHelp')}
            />
          </div>

          {selected === 'chatgpt' ? <div className="banner">
            <strong>{t('providerChatgptTitle')}</strong>
            <span>{t('providerChatgptBody')}</span>
          </div> : null}

          {selected === 'trae' ? <div className="banner warn"><span>{t('providerTraeBody')}</span></div> : null}

          {selected === 'codearts' ? <div className="credential-box">
            <h3>{t('providerCredentialTitle')}</h3>
            <p>{t('providerCredentialBody')}</p>
            <span>Access Key：{detail.status.authStatus === 'CONFIGURED' ? t('providerConfigured') : t('providerNotConfigured')}</span>
            <span>Secret Key：{detail.status.authStatus === 'CONFIGURED' ? t('providerConfigured') : t('providerNotConfigured')}</span>
            <input aria-label="Access Key" type="password" value={ak} onChange={(e) => setAk(e.target.value)} placeholder="Access Key"/>
            <input aria-label="Secret Key" type="password" value={sk} onChange={(e) => setSk(e.target.value)} placeholder="Secret Key"/>
            <button className="secondary-button" onClick={() => void action('credentials', { CODEARTS_CLI_AK: ak, CODEARTS_CLI_SK: sk })}>{detail.status.authStatus === 'CONFIGURED' ? t('providerUpdateCredentials') : t('providerSaveCredentials')}</button>
            <button className="secondary-button" onClick={() => void action('delete-credentials')}>{t('providerDeleteCredentials')}</button>
            <button className="primary-button" onClick={() => void action('verify-auth')}>{t('providerTestConnection')}</button>
          </div> : null}

          <div className="hero-actions">
            <button className="secondary-button" onClick={() => void action(detail.status.enabled ? 'disable' : 'enable')}>
              {detail.status.enabled ? t('providerDisable') : t('providerEnable')}
            </button>
            <button className="primary-button" onClick={() => void action('run-verification')}><ShieldCheck size={16}/>{t('providerRunVerification')}</button>
          </div>
          {message ? <p className="provider-message">{message}</p> : null}

          <h3>{t('providerVerificationTitle')}</h3>
          <div className="skeleton-rows">
            {detail.verification.map((row) => <div className="skeleton-row" key={row.step}>
              <strong>{stepLabel(row.step)}</strong>
              <span>{verificationDetail(row.status, t)}</span>
              <span className={`status-badge ${row.status.toLowerCase()}`}>{row.status}</span>
            </div>)}
          </div>

          <details>
            <summary>{t('providerAdvanced')}</summary>
            <p>{t('providerInternalAuth')}: {detail.status.authStatus}</p>
            <p>{t('providerEventEntry')}: {detail.definition.eventSource.type}</p>
            <p>{t('providerConfigPath')}: {detail.definition.eventSource.projectConfigPath ?? t('providerNoConfig')}</p>
            <pre>{JSON.stringify(detail.definition.events, null, 2)}</pre>
            <p>{detail.definition.finalization.limitation ?? t('providerFinalDefault')}</p>
            <h4>{t('providerRawVerificationDetail')}</h4>
            {detail.verification.map((row) => <p key={`raw-${row.step}`}><code>{row.step}</code>: {row.detail}</p>)}
          </details>
        </> : <p>{t('providerLoading')}</p>}
      </div>
    </section>

    {addOpen ? <div className="provider-drawer-backdrop" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) setAddOpen(false);
    }}>
      <aside className="provider-drawer" role="dialog" aria-modal="true" aria-label={t('providerAdd')}>
        <div className="provider-drawer-head">
          <div><p className="eyebrow">CUSTOM PROVIDER</p><h2>{t('providerCustomTitle')}</h2></div>
          <button className="icon-button" onClick={() => setAddOpen(false)} aria-label={t('cancel')}><X size={20}/></button>
        </div>
        <CustomProvider onSaved={async () => { setAddOpen(false); await loadOverview(true); }} />
      </aside>
    </div> : null}
  </>;
}

function CapabilityCard({ icon, title, value, help }: { icon: ReactNode; title: string; value: string; help: string }) {
  return <article className="provider-capability-card">
    <div className="provider-capability-icon">{icon}</div>
    <div><small>{title}</small><strong>{value}</strong><p>{help}</p></div>
  </article>;
}

function CustomProvider({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [authType, setAuthType] = useState('manual');
  const [eventSource, setEventSource] = useState('custom');
  const [finalization, setFinalization] = useState('manual');
  const [error, setError] = useState('');

  return <div className="provider-wizard">
    <p>{t('providerCustomLead')}</p>
    <section className="provider-wizard-step"><span>1</span><div><h3>{t('providerCustomBasic')}</h3>
      <input aria-label="Provider name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('providerNamePlaceholder')}/>
      <input aria-label="Provider id" value={id} onChange={(e) => setId(e.target.value)} placeholder={t('providerIdPlaceholder')}/>
      <input aria-label="Config path" value={configPath} onChange={(e) => setConfigPath(e.target.value)} placeholder={t('providerConfigPlaceholder')}/>
    </div></section>
    <section className="provider-wizard-step"><span>2</span><div><h3>{t('providerCustomCapabilities')}</h3>
      <div className="provider-wizard-fields">
        <label>{t('providerAuthCard')}<select aria-label="Auth type" value={authType} onChange={(e) => setAuthType(e.target.value)}><option value="manual">{t('providerAuthExternal')}</option><option value="existing-session">{t('providerAuthSession')}</option><option value="none">{t('providerAuthNone')}</option></select></label>
        <label>{t('providerSourceCard')}<select aria-label="Event source" value={eventSource} onChange={(e) => setEventSource(e.target.value)}><option value="custom">{t('providerSourceCustom')}</option><option value="hooks">{t('providerSourceHooks')}</option><option value="plugin">{t('providerSourcePlugin')}</option><option value="event-stream">{t('providerSourceStream')}</option><option value="cli-json">{t('providerSourceCli')}</option><option value="export-import">{t('providerSourceExport')}</option><option value="manual-import">{t('providerSourceManual')}</option></select></label>
        <label>{t('providerFinalCard')}<select aria-label="Finalization strategy" value={finalization} onChange={(e) => setFinalization(e.target.value)}><option value="manual">{t('providerFinalManual')}</option><option value="explicit-event">{t('providerFinalExplicit')}</option><option value="session-idle">{t('providerFinalIdle')}</option><option value="next-session">{t('providerFinalNext')}</option><option value="custom">{t('providerFinalCustom')}</option></select></label>
      </div>
    </div></section>
    <section className="provider-wizard-step"><span>3</span><div><h3>{t('providerCustomVerify')}</h3><p>{t('providerCustomVerifyBody')}</p></div></section>
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
    }}>{t('providerSaveDefinition')}</button>
    {error ? <p className="error-text">{error}</p> : null}
  </div>;
}
