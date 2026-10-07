import { useEffect, useMemo, useState } from 'react';
import type { AppSection, NavigationItem } from '../domain/workspace';
import { LocaleSwitcher, useI18n } from '../i18n/I18nProvider';
import { assetClient } from '../services/assetClient';

interface AppNavigationProps {
  items: NavigationItem[];
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
}

type RuntimeIdentity = {
  projectRoot: string;
  mode: 'framework-self' | 'business-project';
  frameworkVersion: string;
  frameworkRevision: string;
};

function lastPathSegment(value: string): string {
  const clean = value.replace(/[\\/]+$/, '');
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

export function AppNavigation({ items, activeSection, onSelect }: AppNavigationProps) {
  const { t, loc } = useI18n();
  const [runtime, setRuntime] = useState<RuntimeIdentity | null>(null);

  useEffect(() => {
    let alive = true;
    assetClient.config()
      .then((cfg) => {
        if (!alive) return;
        setRuntime({
          projectRoot: cfg.projectRoot,
          mode: cfg.mode,
          frameworkVersion: cfg.frameworkVersion,
          frameworkRevision: cfg.frameworkRevision,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeSection]);

  const projectName = useMemo(
    () => runtime?.mode === 'business-project' ? lastPathSegment(runtime.projectRoot) : '',
    [runtime],
  );

  return (
    <aside className="app-nav" aria-label="Asset workbench navigation">
      <div className="rail-title">
        <span>{t('appName')}</span>
        <strong>{t('projectWorkspace')}</strong>
      </div>
      <section className="nav-runtime-card" aria-label={t('navRuntimeTitle')}>
        <div className="nav-runtime-row">
          <span>{t('navRuntimeTitle')}</span>
          <strong className={runtime?.mode === 'business-project' ? 'business' : 'framework'}>
            {runtime?.mode === 'business-project' ? t('runtimeModeBusiness') : t('runtimeModeFramework')}
          </strong>
        </div>
        <div className="nav-runtime-row">
          <span>{t('navFrameworkVersion')}</span>
          <code>{runtime ? `v${runtime.frameworkVersion} · ${runtime.frameworkRevision}` : '—'}</code>
        </div>
        <div className="nav-runtime-project">
          <span>{t('navCurrentProject')}</span>
          <strong>{runtime?.mode === 'business-project' ? projectName : t('navNoBusinessProject')}</strong>
          {runtime?.mode === 'business-project' ? <small title={runtime.projectRoot}>{runtime.projectRoot}</small> : null}
        </div>
      </section>

      <nav>
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button className={`nav-item ${item.id === activeSection ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="step-icon">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              <span className="step-copy">
                <span>{loc(item.title)}</span>
                <small>{loc(item.eyebrow)}</small>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="nav-language">
        <LocaleSwitcher />
      </div>
    </aside>
  );
}
