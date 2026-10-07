import { useEffect, useRef } from 'react';
import { ArrowRight, Box, Code2, FolderPlus, Plug } from 'lucide-react';
import type { AppSection, FrameworkFocus } from '../domain/workspace';
import { useI18n } from '../i18n/I18nProvider';
import { StarterCreator } from './StarterCreator';
import { DEFAULT_ASSET_SKELETON } from '../../packages/asset-core/src/index.ts';
import { LANGUAGE_DESCRIPTORS } from '../../packages/language-core/src/index.ts';
import { BUILTIN_PROVIDER_DEFINITIONS } from '../../packages/provider-sdk/src/index.ts';

interface FrameworkPageProps {
  onNavigate: (section: AppSection) => void;
  focusRequest: { focus: FrameworkFocus; token: number } | null;
}

const SKELETON_DESCRIPTION_KEYS: Record<string, string> = {
  '00-introduction': 'frameworkSkeletonIntroduction',
  '01-code': 'frameworkSkeletonCode',
  '02-design': 'frameworkSkeletonDesign',
  '03-docs': 'frameworkSkeletonDocs',
  '04-conversations': 'frameworkSkeletonConversations',
  '05-derived': 'frameworkSkeletonDerived',
};


const BEGINNER_LEARNING_ORDER = [
  ['asset-core', 'frameworkLearnAssetTitle', 'frameworkLearnAssetBody'],
  ['starter', 'frameworkLearnStarterTitle', 'frameworkLearnStarterBody'],
  ['language-core', 'frameworkLearnLanguageTitle', 'frameworkLearnLanguageBody'],
  ['protocol', 'frameworkLearnProtocolTitle', 'frameworkLearnProtocolBody'],
  ['provider-sdk', 'frameworkLearnProviderTitle', 'frameworkLearnProviderBody'],
] as const;

const PACKAGE_CARDS = [
  ['asset-core', 'Asset Core', 'frameworkPackageAssetTitle', 'frameworkPackageAssetBody', 'frameworkPackageBadgeStart', 'start'],
  ['starter', 'Starter', 'frameworkPackageStarterTitle', 'frameworkPackageStarterBody', 'frameworkPackageBadgeStart', 'start'],
  ['language-core', 'Language Core', 'frameworkPackageLanguageTitle', 'frameworkPackageLanguageBody', 'frameworkPackageBadgeStart', 'start'],
  ['protocol', 'Protocol', 'frameworkPackageProtocolTitle', 'frameworkPackageProtocolBody', 'frameworkPackageBadgeLater', 'later'],
  ['provider-sdk', 'Provider SDK', 'frameworkPackageProviderTitle', 'frameworkPackageProviderBody', 'frameworkPackageBadgeProvider', 'provider'],
] as const;

export function FrameworkPage({ onNavigate, focusRequest }: FrameworkPageProps) {
  const { t } = useI18n();
  const architectureRef = useRef<HTMLElement | null>(null);
  const packagesRef = useRef<HTMLElement | null>(null);
  const providersRef = useRef<HTMLElement | null>(null);
  const starterRef = useRef<HTMLDivElement | null>(null);
  const skeletonRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const target =
      focusRequest.focus === 'packages'
        ? packagesRef.current
        : focusRequest.focus === 'providers'
          ? providersRef.current
          : focusRequest.focus === 'starter'
            ? starterRef.current
            : focusRequest.focus === 'skeleton'
              ? skeletonRef.current
              : architectureRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusRequest?.token]);

  return (
    <main className="page framework-page">
      <section className="welcome-hero framework-hero">
        <div>
          <p className="eyebrow">{t('frameworkEyebrow')}</p>
          <h1>{t('frameworkTitle')}</h1>
          <p className="lead">{t('frameworkLead')}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate('providers')}>
              <Plug size={17} />
              {t('frameworkManageProviders')}
            </button>
            <button className="secondary-button" onClick={() => onNavigate('guide')}>
              <ArrowRight size={17} />
              {t('frameworkOpenGuide')}
            </button>
          </div>
        </div>
        <div className="framework-summary">
          <span><strong>{BUILTIN_PROVIDER_DEFINITIONS.length}</strong>{t('frameworkBuiltinProviders')}</span>
          <span><strong>{LANGUAGE_DESCRIPTORS.length}</strong>{t('frameworkLanguageEcosystems')}</span>
          <span><strong>{DEFAULT_ASSET_SKELETON.length}</strong>{t('frameworkSkeletonAreas')}</span>
        </div>
      </section>

      <section className="panel framework-beginner-map">
        <div>
          <p className="eyebrow">{t('frameworkBeginnerEyebrow')}</p>
          <h2>{t('frameworkBeginnerTitle')}</h2>
          <p>{t('frameworkBeginnerLead')}</p>
        </div>
        <div className="framework-beginner-grid">
          <article><strong>{t('frameworkBeginnerAssetsTitle')}</strong><p>{t('frameworkBeginnerAssetsBody')}</p></article>
          <article><strong>{t('frameworkBeginnerAiTitle')}</strong><p>{t('frameworkBeginnerAiBody')}</p></article>
          <article><strong>{t('frameworkBeginnerBaseTitle')}</strong><p>{t('frameworkBeginnerBaseBody')}</p></article>
        </div>
      </section>

      <section className="panel framework-runtime-map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkRuntimeEyebrow')}</p>
            <h2>{t('frameworkRuntimeTitle')}</h2>
            <p className="framework-section-lead">{t('frameworkRuntimeLead')}</p>
          </div>
        </div>

        <div className="framework-runtime-lanes">
          <article className="framework-runtime-lane">
            <strong>{t('frameworkRuntimeUserLane')}</strong>
            <div className="framework-runtime-steps">
              <div><span>1</span><b>{t('frameworkRuntimeUser')}</b><small>{t('frameworkRuntimeUserNote')}</small></div>
              <i>→</i>
              <div><span>2</span><b>{t('frameworkRuntimeFrontend')}</b><small>{t('frameworkRuntimeFrontendNote')}</small></div>
              <i>→</i>
              <div><span>3</span><b>{t('frameworkRuntimeBackend')}</b><small>{t('frameworkRuntimeBackendNote')}</small></div>
              <i>→</i>
              <div><span>4</span><b>{t('frameworkRuntimeCore')}</b><small>{t('frameworkRuntimeCoreNote')}</small></div>
              <i>→</i>
              <div><span>5</span><b>{t('frameworkRuntimeAssets')}</b><small>{t('frameworkRuntimeAssetsNote')}</small></div>
            </div>
          </article>

          <article className="framework-runtime-lane">
            <strong>{t('frameworkRuntimeAiLane')}</strong>
            <div className="framework-runtime-steps">
              <div><span>1</span><b>{t('frameworkRuntimeAiTool')}</b><small>{t('frameworkRuntimeAiToolNote')}</small></div>
              <i>→</i>
              <div><span>2</span><b>{t('frameworkRuntimeProvider')}</b><small>{t('frameworkRuntimeProviderNote')}</small></div>
              <i>→</i>
              <div><span>3</span><b>{t('frameworkRuntimeCapture')}</b><small>{t('frameworkRuntimeCaptureNote')}</small></div>
              <i>→</i>
              <div><span>4</span><b>{t('frameworkRuntimeTranscript')}</b><small>{t('frameworkRuntimeTranscriptNote')}</small></div>
              <i>→</i>
              <div><span>5</span><b>{t('frameworkRuntimeKnowledge')}</b><small>{t('frameworkRuntimeKnowledgeNote')}</small></div>
            </div>
          </article>
        </div>
      </section>

      <section className="framework-project-compare">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkVsProjectEyebrow')}</p>
            <h2>{t('frameworkVsProjectTitle')}</h2>
            <p className="framework-section-lead">{t('frameworkVsProjectLead')}</p>
          </div>
        </div>
        <div className="framework-project-compare-grid">
          <article className="panel">
            <span className="framework-role-badge">{t('frameworkSelfBadge')}</span>
            <h3>{t('frameworkSelfTitle')}</h3>
            <p>{t('frameworkSelfBody')}</p>
            <pre>{t('frameworkSelfTree')}</pre>
          </article>
          <article className="panel">
            <span className="framework-role-badge">{t('frameworkManagedBadge')}</span>
            <h3>{t('frameworkManagedTitle')}</h3>
            <p>{t('frameworkManagedBody')}</p>
            <pre>{t('frameworkManagedTree')}</pre>
          </article>
        </div>
        <p className="framework-language-neutral">{t('frameworkVsProjectRule')}</p>
      </section>

      <section className="panel framework-learning-path">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkLearningEyebrow')}</p>
            <h2>{t('frameworkLearningTitle')}</h2>
            <p className="framework-section-lead">{t('frameworkLearningLead')}</p>
          </div>
        </div>
        <div className="framework-learning-list">
          {BEGINNER_LEARNING_ORDER.map(([name, title, body], index) => (
            <article key={name}>
              <span>{index + 1}</span>
              <div>
                <code>packages/{name}</code>
                <strong>{t(title)}</strong>
                <p>{t(body)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="framework-beginner-scope">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkScopeEyebrow')}</p>
            <h2>{t('frameworkScopeTitle')}</h2>
            <p className="framework-section-lead">{t('frameworkScopeLead')}</p>
          </div>
        </div>
        <div className="framework-scope-grid">
          <article className="panel framework-scope-card primary">
            <h3>{t('frameworkScopeKnowTitle')}</h3>
            <ul>
              <li>{t('frameworkScopeKnowProject')}</li>
              <li>{t('frameworkScopeKnowAi')}</li>
              <li>{t('frameworkScopeKnowAssets')}</li>
              <li>{t('frameworkScopeKnowConversation')}</li>
              <li>{t('frameworkScopeKnowSkeleton')}</li>
            </ul>
          </article>
          <article className="panel framework-scope-card">
            <h3>{t('frameworkScopeSkipTitle')}</h3>
            <ul>
              <li>{t('frameworkScopeSkipProtocol')}</li>
              <li>{t('frameworkScopeSkipProviderSdk')}</li>
              <li>{t('frameworkScopeSkipServer')}</li>
              <li>{t('frameworkScopeSkipScripts')}</li>
              <li>{t('frameworkScopeSkipCi')}</li>
            </ul>
            <p>{t('frameworkScopeSkipNote')}</p>
          </article>
        </div>
      </section>

      <section className="panel" ref={architectureRef}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkArchitectureEyebrow')}</p>
            <h2>{t('frameworkArchitectureTitle')}</h2>
          </div>
        </div>
        <div className="framework-flow">
          <div><Code2 size={19}/><strong>{t('frameworkFlowProvider')}</strong><small>{t('frameworkFlowProviderNote')}</small></div>
          <span>→</span>
          <div><Plug size={19}/><strong>{t('frameworkFlowSdk')}</strong><small>{t('frameworkFlowSdkNote')}</small></div>
          <span>→</span>
          <div><Box size={19}/><strong>{t('frameworkFlowProtocol')}</strong><small>{t('frameworkFlowProtocolNote')}</small></div>
          <span>→</span>
          <div><Box size={19}/><strong>{t('frameworkFlowKernel')}</strong><small>{t('frameworkFlowKernelNote')}</small></div>
          <span>→</span>
          <div><FolderPlus size={19}/><strong>{t('frameworkFlowAssets')}</strong><small>{t('frameworkFlowAssetsNote')}</small></div>
        </div>
        <p className="framework-language-neutral">{t('frameworkLanguageNeutral')}</p>
      </section>

      <section ref={packagesRef}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkPackagesEyebrow')}</p>
            <h2>{t('frameworkPackagesTitle')}</h2>
            <p className="framework-section-lead">{t('frameworkPackagesLead')}</p>
          </div>
        </div>
        <div className="framework-package-grid">
          {PACKAGE_CARDS.map(([name, technicalName, title, body, badge, badgeTone], index) => (
            <article className="panel framework-package-card" key={name}>
              <div className="framework-package-card-top">
                <span className="framework-package-order">{index + 1}</span>
                <span className={`framework-package-badge ${badgeTone}`}>{t(badge)}</span>
              </div>
              <h3>{t(title)}</h3>
              <div className="framework-package-technical">
                <code>{technicalName}</code>
                <small>packages/{name}</small>
              </div>
              <p>{t(body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkLanguagesEyebrow')}</p>
            <h2>{t('frameworkLanguagesTitle')}</h2>
          </div>
          <span className="framework-scope-note">{t('frameworkLanguagesScope')}</span>
        </div>
        <div className="framework-language-grid">
          {LANGUAGE_DESCRIPTORS.map((language) => (
            <article className="panel framework-language-card" key={language.id}>
              <strong>{language.displayName}</strong>
              <div>
                <span>{t('frameworkSourceFiles')}</span>
                <code>{language.extensions.map((extension) => `.${extension}`).join(' · ')}</code>
              </div>
              <div>
                <span>{t('frameworkManifests')}</span>
                <code>{language.manifests.join(' · ')}</code>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="framework-provider-section" ref={providersRef}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkProviderEyebrow')}</p>
            <h2>{t('frameworkProviderTitle')}</h2>
          </div>
          <button className="secondary-button" onClick={() => onNavigate('providers')}>
            <Plug size={16}/>{t('frameworkProviderManage')}
          </button>
        </div>
        <div className="framework-provider-grid">
          {BUILTIN_PROVIDER_DEFINITIONS.map((provider) => (
            <article className="panel framework-provider-card" key={provider.id}>
              <div><strong>{provider.displayName}</strong><code>{provider.id}</code></div>
              <span>{t('frameworkEventSource')}: {provider.eventSource.type}</span>
              <span>{t('frameworkFinalization')}: {provider.finalization.strategy}</span>
            </article>
          ))}
        </div>
        <p className="detail-summary">{t('frameworkProviderSdkLead')}</p>
      </section>

      <div ref={starterRef}><StarterCreator onActivated={() => onNavigate('assets')} /></div>

      <section className="panel framework-skeleton" ref={skeletonRef}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkSkeletonEyebrow')}</p>
            <h2>{t('frameworkSkeletonTitle')}</h2>
          </div>
        </div>
        <div className="skeleton-rows">
          {DEFAULT_ASSET_SKELETON.map((entry) => (
            <article className="skeleton-row" key={entry.path}>
              <code>{entry.path}/</code>
              <span className="skeleton-row-kind">{entry.assetType}</span>
              <span>{t(SKELETON_DESCRIPTION_KEYS[entry.path] ?? 'frameworkSkeletonOther')}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
