import { useState } from 'react';
import { CheckCircle2, FolderPlus } from 'lucide-react';
import { assetClient } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';

interface StarterCreatorProps {
  onActivated?: () => void;
  compact?: boolean;
}

export function StarterCreator({ onActivated, compact = false }: StarterCreatorProps) {
  const { t } = useI18n();
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [createdTarget, setCreatedTarget] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!target.trim()) {
      setMessage(t('starterTargetRequired'));
      return;
    }
    setBusy(true);
    setMessage(t('starterCreating'));
    try {
      const result = await assetClient.createStarter(target.trim(), name.trim() || undefined);
      setCreatedTarget(result.target);
      setTarget(result.target);
      setMessage(`${t('starterCreated')} · ${result.created.length} ${t('starterFilesCreated')}`);
    } catch (error) {
      setMessage(`${t('starterCreateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!createdTarget) return;
    setBusy(true);
    setMessage(t('starterActivating'));
    try {
      const result = await assetClient.setRoot(createdTarget);
      setMessage(`${t('starterActivated')} · ${result.directoryCount} ${t('statDirs')}`);
      onActivated?.();
    } catch (error) {
      setMessage(`${t('rootUpdateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={compact ? 'panel starter-creator compact' : 'panel starter-creator'}>
      <div className="starter-heading">
        <div>
          <p className="eyebrow">{t('starterEyebrow')}</p>
          <h2>{t('starterTitle')}</h2>
          <p className="detail-summary">{t('starterLead')}</p>
        </div>
        <FolderPlus size={28} />
      </div>

      <div className="starter-form">
        <label>
          <span>{t('starterTarget')}</span>
          <input
            className="root-input"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={t('starterTargetPlaceholder')}
            spellCheck={false}
          />
        </label>
        <label>
          <span>{t('starterProjectName')}</span>
          <input
            className="root-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('starterProjectNamePlaceholder')}
            spellCheck={false}
          />
        </label>
      </div>

      <div className="hero-actions">
        <button className="primary-button" disabled={busy} onClick={() => void create()}>
          <FolderPlus size={17} />
          {busy ? t('starterWorking') : t('starterCreate')}
        </button>
        {createdTarget ? (
          <button className="secondary-button" disabled={busy} onClick={() => void activate()}>
            <CheckCircle2 size={17} />
            {t('starterUseWorkspace')}
          </button>
        ) : null}
      </div>
      <p className="starter-safety">{t('starterSafety')}</p>
      {message ? <p className="detail-summary starter-message">{message}</p> : null}
    </section>
  );
}
