import { useState } from 'react';
import { CheckCircle2, CircleX, FolderCheck, FolderPlus, ShieldCheck } from 'lucide-react';
import { assetClient, type KnowledgeVerificationView } from '../services/assetClient';
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
  const [verification, setVerification] = useState<KnowledgeVerificationView | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!target.trim()) {
      setMessage(t('starterTargetRequired'));
      return;
    }
    setBusy(true);
    setVerification(null);
    setMessage(t('starterCreating'));
    try {
      const result = await assetClient.createKnowledge(target.trim(), name.trim() || undefined);
      setCreatedTarget(result.target);
      setTarget(result.target);
      setVerification(result.verification);
      setMessage(`${t('starterCreated')} · ${result.created.length} ${t('starterFilesCreated')}`);
    } catch (error) {
      setMessage(`${t('starterCreateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!target.trim()) {
      setMessage(t('starterTargetRequired'));
      return;
    }
    setBusy(true);
    setMessage(t('starterVerifying'));
    try {
      const result = await assetClient.verifyKnowledge(target.trim());
      setVerification(result);
      setMessage(result.ok ? t('starterVerified') : t('starterVerifyFailed'));
    } catch (error) {
      setMessage(`${t('starterVerifyFailed')}: ${error instanceof Error ? error.message : String(error)}`);
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
        <button className="secondary-button" disabled={busy || !target.trim()} onClick={() => void verify()}>
          <ShieldCheck size={17} />
          {t('starterVerify')}
        </button>
        {createdTarget ? (
          <button className="secondary-button" disabled={busy} onClick={() => void activate()}>
            <CheckCircle2 size={17} />
            {t('starterUseWorkspace')}
          </button>
        ) : null}
      </div>

      <details className="creator-advanced-cli"><summary>CLI · 高级详情 / Advanced commands</summary><div className="starter-cli-map">
        <div>
          <strong>{t('starterCliCreateTitle')}</strong>
          <code>npm run creator -- knowledge create --target &lt;directory&gt; --name &lt;project&gt;</code>
        </div>
        <div>
          <strong>{t('starterCliVerifyTitle')}</strong>
          <code>npm run creator -- knowledge verify --target &lt;directory&gt;</code>
        </div>
      </div>

      </div></details>

      <p className="starter-safety">{t('starterSafety')}</p>
      {message ? <p className="detail-summary starter-message">{message}</p> : null}

      {verification ? (
        <div className={verification.ok ? 'starter-verification pass' : 'starter-verification fail'}>
          <div className="starter-verification-head">
            {verification.ok ? <FolderCheck size={20} /> : <CircleX size={20} />}
            <div>
              <strong>{t('starterVerificationTitle')}</strong>
              <span>{verification.ok ? t('starterVerificationPass') : t('starterVerificationFail')}</span>
            </div>
          </div>
          <div className="starter-verification-list">
            {verification.checks.map((check) => (
              <div key={`${check.kind}:${check.path}`} className={check.ok ? 'pass' : 'fail'}>
                {check.ok ? <CheckCircle2 size={14} /> : <CircleX size={14} />}
                <code>{check.path}</code>
                <small>{check.kind}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
