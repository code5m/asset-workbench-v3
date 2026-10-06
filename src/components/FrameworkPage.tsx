import { ArrowRight, Box, Code2, FolderPlus, Plug } from 'lucide-react';
import type { AppSection } from '../domain/workspace';
import { useI18n } from '../i18n/I18nProvider';
import { StarterCreator } from './StarterCreator';
import { DEFAULT_ASSET_SKELETON } from '../../packages/asset-core/src/index.ts';
import { LANGUAGE_DESCRIPTORS } from '../../packages/language-core/src/index.ts';
import { BUILTIN_PROVIDER_DEFINITIONS } from '../../packages/provider-sdk/src/index.ts';

interface FrameworkPageProps {
  onNavigate: (section: AppSection) => void;
}

const SKELETON_DESCRIPTION_KEYS: Record<string, string> = {
  '00-introduction': 'frameworkSkeletonIntroduction',
  '01-code': 'frameworkSkeletonCode',
  '02-design': 'frameworkSkeletonDesign',
  '03-docs': 'frameworkSkeletonDocs',
  '04-conversations': 'frameworkSkeletonConversations',
  '05-derived': 'frameworkSkeletonDerived',
};

const PACKAGE_CARDS = [
  ['protocol', 'frameworkPackageProtocolTitle', 'frameworkPackageProtocolBody'],
  ['provider-sdk', 'frameworkPackageProviderTitle', 'frameworkPackageProviderBody'],
  ['language-core', 'frameworkPackageLanguageTitle', 'frameworkPackageLanguageBody'],
  ['asset-core', 'frameworkPackageAssetTitle', 'frameworkPackageAssetBody'],
  ['starter', 'frameworkPackageStarterTitle', 'frameworkPackageStarterBody'],
] as const;

export function FrameworkPage({ onNavigate }: FrameworkPageProps) {
  const { t } = useI18n();

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

      <section className="panel">
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

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkPackagesEyebrow')}</p>
            <h2>{t('frameworkPackagesTitle')}</h2>
          </div>
        </div>
        <div className="framework-package-grid">
          {PACKAGE_CARDS.map(([name, title, body]) => (
            <article className="panel framework-package-card" key={name}>
              <code>packages/{name}</code>
              <h3>{t(title)}</h3>
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

      <section className="framework-provider-section">
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

      <StarterCreator onActivated={() => onNavigate('assets')} />

      <section className="panel framework-skeleton">
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
