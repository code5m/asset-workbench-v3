import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, CircleAlert, Play } from 'lucide-react';
import type { AppSection } from '../domain/workspace';
import { assetCategoryCards, keyDocuments, welcomeSteps } from '../data/productCopy';
import { assetClient } from '../services/assetClient';
import type { ExpectedSkeletonEntry } from '../domain/asset';
import type { ProviderStatusView } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';

interface WelcomePageProps {
  onNavigate: (section: AppSection) => void;
  onOpenAsset: (path: string) => void;
}

/** Asset Categories cover 01-05 only; `00-introduction/` belongs to the skeleton. */
const CARD_TO_SKELETON: Record<string, string> = {
  code: '01-code',
  design: '02-design',
  document: '03-docs',
  conversation: '04-conversations',
  derived: '05-derived',
};

type DocStatus = 'FOUND' | 'MISSING' | 'PENDING';

const DEFAULT_DOC_COUNT = 3;

const welcomeProviderStatusKey = (value: string): string => ({
  ENABLED: 'providerStatusEnabled',
  DISABLED: 'providerStatusDisabled',
  AVAILABLE: 'providerAvailable',
  NOT_INSTALLED: 'providerStatusNotInstalled',
  NEEDS_AUTH: 'providerStatusBlockedAuth',
  BLOCKED: 'providerStatusBlockedAuth',
  LIMITED: 'providerStatusLimited',
  ERROR: 'providerStatusError',
}[value] ?? 'providerStatusLimited');

const welcomeProviderSourceKey = (provider: string): string => ({
  codex: 'providerSourceHooks',
  codebuddy: 'providerSourceHooks',
  trae: 'providerSourceHooks',
  opencode: 'providerSourcePlugin',
  codearts: 'providerSourceExport',
  chatgpt: 'providerSourceManual',
}[provider] ?? 'providerSourceCustom');

export function WelcomePage({ onNavigate, onOpenAsset }: WelcomePageProps) {
  const { t, loc } = useI18n();
  const [skeleton, setSkeleton] = useState<ExpectedSkeletonEntry[]>([]);
  const [skeletonOpen, setSkeletonOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [providers, setProviders] = useState<ProviderStatusView[]>([]);

  useEffect(() => {
    assetClient
      .skeleton()
      .then(setSkeleton)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    assetClient.providers().then(setProviders).catch(() => undefined);
  }, []);

  // Key Document existence comes from the real engine: a resolved read means the
  // file exists, a rejected read means it does not. Nothing is assumed here.
  useEffect(() => {
    let alive = true;
    void Promise.all(
      keyDocuments.map(async (doc) => {
        try {
          await assetClient.content(doc.path);
          return [doc.path, 'FOUND'] as const;
        } catch {
          return [doc.path, 'MISSING'] as const;
        }
      }),
    ).then((pairs) => {
      if (alive) setDocStatus(Object.fromEntries(pairs) as Record<string, DocStatus>);
    });
    return () => {
      alive = false;
    };
  }, []);

  const statusByPath = useMemo(() => new Map(skeleton.map((s) => [s.path, s.status])), [skeleton]);

  const foundCount = skeleton.filter((s) => s.status === 'FOUND').length;
  const totalCount = skeleton.length;
  const allFound = foundCount === totalCount && totalCount > 0;
  const missingNames = skeleton.filter((s) => s.status !== 'FOUND').map((s) => s.path);

  const visibleDocs = docsOpen ? keyDocuments : keyDocuments.slice(0, DEFAULT_DOC_COUNT);

  return (
    <main className="page">
      {/* Layer 1 — Product introduction. */}
      <section className="welcome-hero">
        <div>
          <p className="eyebrow">{t('welcomeEyebrow')}</p>
          <h1>{t('welcomeTitle')}</h1>
          <p className="lead">{t('welcomeLead')}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate('guide')}>
              <Play size={17} />
              {t('startGuide')}
            </button>
            <button className="secondary-button" onClick={() => onNavigate('assets')}>
              <ArrowRight size={17} />
              {t('viewAssets')}
            </button>
          </div>
        </div>
        <div className="plain-explainer">
          <CircleAlert size={22} />
          <strong>{t('whyNotCopyTitle')}</strong>
          <p>{t('whyNotCopyBody')}</p>
        </div>
      </section>

      {/* Layer 2 — Workflow: process overview, intentionally lightweight. */}
      <section className="flow-strip">
        <p className="eyebrow">{t('workflowTitle')}</p>
        <div className="flow-items">
          {welcomeSteps.map((step, index) => (
            <div className="flow-item" key={loc(step.title)}>
              <span className="flow-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{loc(step.title)}</strong>
                <p>{loc(step.body)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Layer 3 — Asset Overview: what kinds of assets exist (01-05). */}
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('assetCategoriesTitle')}</p>
            <h2>{t('assetCategoriesLead')}</h2>
          </div>
        </div>
        <div className="asset-category-grid">
          {assetCategoryCards.map((category) => {
            const Icon = category.icon;
            const skPath = CARD_TO_SKELETON[category.id];
            const status = skPath ? statusByPath.get(skPath) : undefined;
            return (
              <article
                className="asset-category-card"
                key={category.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenAsset(category.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenAsset(category.path);
                  }
                }}
              >
                <div className="asset-category-head">
                  <Icon size={18} />
                  <strong>{loc(category.name)}</strong>
                </div>
                <span>{category.path}</span>
                {status ? (
                  <span className={`status-badge ${status.toLowerCase()}`}>{t(`sk_${status.toLowerCase()}`)}</span>
                ) : (
                  <small>{t('loading')}</small>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('welcomeProviderEyebrow')}</p>
            <h2>{t('welcomeProviderTitle')}</h2>
          </div>
        </div>
        <div className="skeleton-rows">
          {providers.map((provider) => {
            const visibleStatus = provider.platformStatus ?? provider.status;
            return (
              <article className="skeleton-row" key={provider.provider}>
                <code>{provider.provider}</code>
                <span className="skeleton-row-kind">{t(welcomeProviderSourceKey(provider.provider))}</span>
                <span className={`status-badge ${visibleStatus.toLowerCase().replace(/_/g, '-')}`}>{t(welcomeProviderStatusKey(visibleStatus))}</span>
              </article>
            );
          })}
        </div>
      </section>

      {/* Layers 4 & 5 — Workspace Health (left) + Key Project Documents (right). */}
      <section className="home-bottom-grid">
        <div className="home-col">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('healthTitle')}</p>
              <h2>{t('healthStatusTitle')}</h2>
            </div>
          </div>
          <div className="health-band">
            <div className="health-summary">
              <div className="health-text">
                <h2>
                  {totalCount > 0 ? `${foundCount} / ${totalCount}` : '—'} {t('healthNormal')}
                </h2>
                <p>
                  {totalCount === 0
                    ? t('loading')
                    : allFound
                      ? t('healthAllOk')
                      : `${t('healthMissingPrefix')}${missingNames.join(' / ')}`}
                </p>
              </div>
              <button className="secondary-button health-toggle" onClick={() => setSkeletonOpen((v) => !v)}>
                {skeletonOpen ? t('collapseDetail') : t('expandDetail')}
                <ChevronDown size={15} className={skeletonOpen ? 'chev-open' : ''} />
              </button>
            </div>
            {skeletonOpen ? (
              <div className="skeleton-rows">
                {skeleton.map((entry) => (
                  <article className="skeleton-row" key={entry.path}>
                    <code>{entry.path}/</code>
                    <span className="skeleton-row-kind">{entry.assetType}</span>
                    <span className={`status-badge ${entry.status.toLowerCase()}`}>{t(`sk_${entry.status.toLowerCase()}`)}</span>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="home-col">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('keyDocumentsTitle')}</p>
              <h2>{t('keyDocumentsLead')}</h2>
            </div>
          </div>
          <div className="key-doc-list">
            {visibleDocs.map((doc) => {
              const status = docStatus[doc.path] ?? 'PENDING';
              return (
                <article
                  className="key-doc-row"
                  key={doc.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenAsset(doc.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenAsset(doc.path);
                    }
                  }}
                  >
                  <strong>{doc.name}</strong>
                  <code>{doc.path}</code>
                  <span className={`status-badge ${status === 'PENDING' ? 'partial' : status.toLowerCase()}`}>
                    {status === 'PENDING' ? t('loading') : t(`sk_${status.toLowerCase()}`)}
                  </span>
                </article>
              );
            })}
          </div>
          {keyDocuments.length > DEFAULT_DOC_COUNT ? (
            <button className="text-button" onClick={() => setDocsOpen((v) => !v)}>
              {docsOpen ? t('collapseDetail') : `${t('viewAll')} (${keyDocuments.length - DEFAULT_DOC_COUNT})`}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
