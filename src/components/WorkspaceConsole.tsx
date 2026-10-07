import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, GitBranch, RefreshCw, ShieldCheck } from 'lucide-react';
import { wizardSteps } from '../data/navigation';
import { pipelineNotes } from '../data/productCopy';
import { assetClient } from '../services/assetClient';
import type { RepositoryRevision } from '../domain/asset';
import { useI18n } from '../i18n/I18nProvider';
import { StatusBadge } from './StatusBadge';

interface WorkspaceConsoleProps {
  activeStep: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function WorkspaceConsole({ activeStep }: WorkspaceConsoleProps) {
  const { t, loc } = useI18n();
  const [repos, setRepos] = useState<RepositoryRevision[]>([]);
  const [projectRoot, setProjectRoot] = useState('');
  const [scannedAt, setScannedAt] = useState('');
  const [fileCount, setFileCount] = useState(0);
  const [directoryCount, setDirectoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runtimeMode, setRuntimeMode] = useState<'framework-self' | 'business-project'>('framework-self');

  const load = async () => {
    setLoading(true);
    try {
      const cfg = await assetClient.config();
      setProjectRoot(cfg.projectRoot);
      setRuntimeMode(cfg.mode);
      if (cfg.mode === 'framework-self') {
        setFileCount(0);
        setDirectoryCount(0);
        setRepos([]);
        setScannedAt('');
        return;
      }
      const [tree, repositories, ws] = await Promise.all([
        assetClient.tree(''),
        assetClient.repositories(),
        assetClient.workspace(),
      ]);
      setFileCount(tree.fileCount);
      setDirectoryCount(tree.directoryCount);
      setScannedAt(ws.lastScannedAt ?? tree.parent.modifiedAt);
      setRepos(repositories);
    } catch {
      // keep the current visible state; the page must not fabricate project data.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="console">
      <section className="topbar">
        <div>
          <p className="eyebrow">{t('appName')}</p>
          <h1>{t('consoleTitle')}</h1>
          <p className="lead">{t('consoleLead')}</p>
        </div>
        <div className="topbar-actions">
          <span className="status-badge future">{t('noWorkspaceVersion')}</span>
          <button className="secondary-button" onClick={load} title={t('rescan')}>
            <RefreshCw size={17} />
            {t('refresh')}
          </button>
        </div>
      </section>

      {runtimeMode === 'framework-self' ? (
        <section className="panel runtime-mode-notice framework-self-notice">
          <div>
            <p className="eyebrow">{t('runtimeModeFramework')}</p>
            <h2>{t('runtimeFrameworkNoticeTitle')}</h2>
            <p>{t('runtimeFrameworkNoticeBody')}</p>
            <code>{projectRoot}</code>
          </div>
        </section>
      ) : (
        <section className="panel runtime-mode-notice business-project-notice">
          <div>
            <p className="eyebrow">{t('runtimeModeBusiness')}</p>
            <h2>{t('runtimeBusinessNoticeTitle')}</h2>
            <p>{t('runtimeBusinessNoticeBody')}</p>
            <code>{projectRoot}</code>
          </div>
        </section>
      )}

      {runtimeMode === 'framework-self' ? null : (
      <section className="metrics-grid">
        <article className="metric-card">
          <span>{t('statFiles')}</span>
          <strong>{loading ? '—' : fileCount}</strong>
          <small>{t('loadedAssets')}</small>
        </article>
        <article className="metric-card">
          <span>{t('statDirs')}</span>
          <strong>{loading ? '—' : directoryCount}</strong>
          <small>{t('loadedDirectories')}</small>
        </article>
        <article className="metric-card">
          <span>{t('statRepos')}</span>
          <strong>{loading ? '—' : repos.length}</strong>
          <small>{t('loadedRepositories')}</small>
        </article>
        <article className="metric-card">
          <span>{t('scannedAt')}</span>
          <strong style={{ fontSize: 16 }}>{scannedAt ? formatDate(scannedAt) : '—'}</strong>
          <small>{t('lastScan')}</small>
        </article>
      </section>

      </section>
      )}

      {runtimeMode === 'framework-self' ? null : (
      <>
      <section className="workspace-band">
        <div className="workspace-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('workspaceProfile')}</p>
              <h2>{t('projectWorkspace')}</h2>
            </div>
            <StatusBadge value="active" />
          </div>
          <p>{t('workspaceProfileNote')}</p>
          <div className="profile-grid">
            <Field label={t('discoveryRoot')} value={projectRoot || '—'} wide />
            <Field label={t('scannedAt')} value={scannedAt ? formatDate(scannedAt) : '—'} wide />
          </div>
        </div>

        <div className="snapshot-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('workspaceVersionCore')}</p>
              <h2>{t('noWorkspaceVersion')}</h2>
            </div>
            <ShieldCheck size={28} />
          </div>
          <div className="digest-box">
            <small>{t('versionState')}</small>
            <code>{t('versionNotFrozen')}</code>
          </div>
          <p className="note">{t('versionNoteReal')}</p>
        </div>
      </section>

      <section className="work-grid">
        <article className="panel repositories-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('currentStep')}</p>
              <h2>{getStepTitle(activeStep, loc)}</h2>
            </div>
            <div className="compact-summary">
              <strong>{repos.length}</strong>
              <span>{t('discoveredRepositories')}</span>
            </div>
          </div>

          {repos.length === 0 ? (
            <p className="detail-summary">{t('noRepositories')}</p>
          ) : (
            <div className="repository-list">
              {repos.map((repo) => (
                <div className="repository-row" key={repo.path || repo.repositoryId}>
                  <div className="repo-main">
                    <GitBranch size={18} />
                    <div>
                      <strong>{repo.path || repo.repositoryId}</strong>
                      <small>{repo.remote ?? t('noGitRemote')}</small>
                    </div>
                  </div>
                  <div className="repo-ref">
                    <span>{repo.branch ?? '—'}</span>
                    <code>{repo.headCommit ?? '—'}</code>
                  </div>
                  <div className="repo-reason">
                    <span>{repo.dirty ? t('gitDirty') : t('gitClean')}</span>
                    <small>
                      {t('gitModified')}: {repo.modifiedCount} · {t('gitUntracked')}: {repo.untrackedCount}
                    </small>
                  </div>
                  <StatusBadge value={repo.dirty ? 'warning' : 'done'} />
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel import-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('rawImport')}</p>
              <h2>{t('manifestVerification')}</h2>
            </div>
            <Database size={26} />
          </div>
          <p className="detail-summary">{t('rawImportPending')}</p>
        </article>
      </section>

      <section className="pipeline-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('derivedPipeline')}</p>
            <h2>{t('pipelineTitle')}</h2>
          </div>
          <Database size={28} />
        </div>
        <div className="pipeline-grid">
          {wizardSteps.slice(6).map((step) => {
            const Icon = step.icon;
            return (
              <div className="pipeline-step" key={step.id}>
                <Icon size={20} />
                <strong>{loc(step.title)}</strong>
                <StatusBadge value={step.state} />
              </div>
            );
          })}
        </div>
        <div className="note-list">
          {pipelineNotes.map((note, index) => (
            <p key={index}>
              {note.warn ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              {loc(note.text)}
            </p>
          ))}
        </div>
      </section>
      </>
      )}
    </main>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStepTitle(stepId: string, loc: (value: { 'zh-CN': string; en: string }) => string) {
  const step = wizardSteps.find((s) => s.id === stepId);
  return step ? loc(step.title) : loc({ 'zh-CN': '仓库', en: 'Repositories' });
}
