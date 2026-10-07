import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { AppSection } from '../domain/workspace';
import { guideSteps, sourceLayers } from '../data/productCopy';
import { assetClient } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';
import { StarterCreator } from './StarterCreator';
import { KnowledgeLifecycle } from './KnowledgeLifecycle';

interface GuidePageProps {
  onNavigate: (section: AppSection) => void;
  onOpenAsset: (path: string) => void;
}

export function GuidePage({ onNavigate, onOpenAsset }: GuidePageProps) {
  const { t, loc } = useI18n();
  const [rootPath, setRootPath] = useState('');
  const [currentRoot, setCurrentRoot] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    assetClient
      .config()
      .then((cfg) => {
        setCurrentRoot(cfg.mode === 'business-project' ? cfg.projectRoot : '');
        setRootPath(cfg.mode === 'business-project' ? cfg.projectRoot : '');
      })
      .catch(() => undefined);
  }, []);

  const applyRoot = () => {
    setMessage(t('applyingRoot'));
    assetClient
      .setRoot(rootPath)
      .then((res) => {
        setCurrentRoot(res.projectRoot);
        setMessage(`${t('rootUpdated')} · ${res.fileCount} ${t('statFiles')} · ${res.directoryCount} ${t('statDirs')} · ${t('statsLoadedScope')}`);
      })
      .catch((e) => setMessage(`${t('rootUpdateFailed')}: ${e instanceof Error ? e.message : String(e)}`));
  };

  return (
    <main className="page">
      <section className="topbar">
        <div>
          <p className="eyebrow">{t('guideEyebrow')}</p>
          <h1>{t('guideTitle')}</h1>
          <p className="lead">{t('guideLead')}</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate('console')}>
          <ArrowRight size={17} />
          {t('enterConsole')}
        </button>
      </section>

      <section className="panel guide-binding-principle">
        <p className="eyebrow">{t('guideBindingEyebrow')}</p>
        <h2>{t('guideBindingTitle')}</h2>
        <p className="detail-summary">{t('guideBindingBody')}</p>
      </section>

      <section className="guide-list">
        {guideSteps.map((step, index) => (
          <article className="guide-step" key={loc(step.title)}>
            <span>{index + 1}</span>
            <div>
              <strong>{loc(step.title)}</strong>
              <p>{loc(step.body)}</p>
            </div>
          </article>
        ))}
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('guideStartModeEyebrow')}</p>
            <h2>{t('guideStartModeTitle')}</h2>
          </div>
        </div>
        <div className="guide-start-grid">
          <article className="panel guide-start-card selected">
            <strong>{t('guideExistingTitle')}</strong>
            <p>{t('guideExistingBody')}</p>
            <small>{t('guideExistingHint')}</small>
          </article>
          <article className="panel guide-start-card">
            <strong>{t('guideStarterTitle')}</strong>
            <p>{t('guideStarterBody')}</p>
            <small>{t('guideStarterHint')}</small>
          </article>
        </div>
      </section>

      <section className="panel root-config">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('workspaceBootstrap')}</p>
            <h2>{t('setProjectRoot')}</h2>
          </div>
        </div>
        <p className="detail-summary">{t('setProjectRootHint')}</p>
        <div className="root-input-row">
          <input
            className="root-input"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder={t('projectRootPlaceholder')}
            spellCheck={false}
          />
          <button className="primary-button" onClick={applyRoot}>
            <CheckCircle2 size={17} />
            {t('applyRoot')}
          </button>
        </div>
        {currentRoot ? <p className="detail-summary">{t('currentRoot')}: <code>{currentRoot}</code></p> : null}
        {message ? <p className="detail-summary">{message}</p> : null}
      </section>

      <StarterCreator onActivated={() => onNavigate('assets')} compact />

      <KnowledgeLifecycle
        compact
        titleKey="guideKnowledgeTitle"
        leadKey="guideKnowledgeLead"
        onOpenAi={() => onNavigate('providers')}
        onOpenConversations={() => onOpenAsset('04-conversations')}
        onOpenDecisions={() => onOpenAsset('02-design/decisions')}
      />

      <section className="pipeline-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('humanToSystem')}</p>
            <h2>{t('sourceLayerTitle')}</h2>
          </div>
          <CheckCircle2 size={26} />
        </div>
        <div className="source-layers-band">
          {sourceLayers.map((layer) => (
            <article className="source-layer" key={loc(layer.label)}>
              <span>{loc(layer.label)}</span>
              <strong>{loc(layer.value)}</strong>
              <small>{loc(layer.detail)}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
