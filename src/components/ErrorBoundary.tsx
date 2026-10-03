import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Top-level error boundary. Without this, any single node that throws during
 * render blanks the whole client with an unrecoverable message. Here we catch it,
 * show a recoverable panel, and let the user reload without losing the scanned
 * asset state (which lives in the dev server, not the page).
 */
function CrashUI({ error, onReload }: { error: Error; onReload: () => void }) {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="banner error app-crash">
        <div>
          <strong>{t('appCrashed')}</strong>
          <p>{t('appCrashedHint')}</p>
          {error.message ? <p className="crash-detail">{error.message}</p> : null}
        </div>
        <button className="primary-button" onClick={onReload}>
          {t('reload')}
        </button>
      </div>
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[AssetWorkbench] uncaught render error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return <CrashUI error={this.state.error} onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
