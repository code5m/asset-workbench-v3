import type { AppSection, NavigationItem } from '../domain/workspace';
import { LocaleSwitcher, useI18n } from '../i18n/I18nProvider';

interface AppNavigationProps {
  items: NavigationItem[];
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
}

export function AppNavigation({ items, activeSection, onSelect }: AppNavigationProps) {
  const { t, loc } = useI18n();

  return (
    <aside className="app-nav" aria-label="Asset workbench navigation">
      <div className="rail-title">
        <span>{t('appName')}</span>
        <strong>{t('projectWorkspace')}</strong>
      </div>
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
