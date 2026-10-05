import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { assetClient } from '../services/assetClient';
import { useI18n } from '../i18n/I18nProvider';
import type { ManagedAssetResult, ManagedAssetType } from '../domain/asset';

export type CreateMode = 'transcript-import' | 'manual-record' | 'design' | 'decision';

export interface PromoteFrom {
  type: ManagedAssetType;
  id: string;
  title?: string;
}

export interface CreateAssetDialogProps {
  mode: CreateMode;
  promoteFrom?: PromoteFrom | null;
  onClose: () => void;
  onCreated: (result: ManagedAssetResult) => void;
}

const SOURCES: { value: string; key: string }[] = [
  { value: 'chatgpt', key: 'srcChatgpt' },
  { value: 'codex', key: 'srcCodex' },
  { value: 'codebuddy', key: 'srcCodebuddy' },
  { value: 'opencode', key: 'srcOpencode' },
  { value: 'trae', key: 'srcTrae' },
  { value: 'codearts', key: 'srcCodearts' },
  { value: 'workbuddy', key: 'srcWorkbuddy' },
  { value: 'manual', key: 'srcManual' },
  { value: 'other', key: 'srcOther' },
];

const DESIGN_AREAS = ['architecture', 'product', 'technical'];
const DECISION_STATUSES = ['Accepted', 'Proposed', 'Superseded', 'Deprecated'];

function designTemplate(from?: PromoteFrom | null): string {
  if (!from) return '## Context\n\n## Goals\n\n## Proposed Design\n\n';
  return `## Context\n\n来源聊天: ${from.title ?? ''} (${from.id})\n\n## Goals\n\n## Proposed Design\n\n`;
}

function decisionTemplate(from?: PromoteFrom | null): string {
  const src = from
    ? `来源${from.type === 'conversation' || from.type === 'agent-work-record' ? '工作记录' : '设计'}: ${from.title ?? ''} (${from.id})`
    : '';
  return `## Decision\n\n## Rationale\n\n## Consequences\n\n${src}\n`;
}

export function CreateAssetDialog({ mode, promoteFrom, onClose, onCreated }: CreateAssetDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(promoteFrom?.title ?? '');
  const [source, setSource] = useState('manual');
  const [designArea, setDesignArea] = useState('architecture');
  const [status, setStatus] = useState('Accepted');
  const [content, setContent] = useState(
    mode === 'design' ? designTemplate(promoteFrom) : mode === 'decision' ? decisionTemplate(promoteFrom) : '',
  );
  const [related, setRelated] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dialogTitle = useMemo(() => {
    if (promoteFrom) {
      if (mode === 'design') return t('actPromoteToDesign');
      if (mode === 'decision') return t('actCreateDecision');
    }
    if (mode === 'transcript-import') return t('newAssetTranscriptImport');
    if (mode === 'manual-record') return t('newAssetManualRecord');
    if (mode === 'design') return t('newAssetDesign');
    return t('newAssetDecision');
  }, [promoteFrom, mode, t]);

  async function submit() {
    setError('');
    setBusy(true);
    const relatedPaths = related
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      let result: ManagedAssetResult;
      if (promoteFrom && mode === 'design') {
        result = await assetClient.promoteConversationToDesign(promoteFrom.id, {
          title,
          designArea,
          content,
          relatedAssetPaths: relatedPaths,
        });
      } else if (promoteFrom && mode === 'decision' && promoteFrom.type === 'design') {
        result = await assetClient.promoteDesignToDecision(promoteFrom.id, {
          title,
          status,
          content,
          relatedAssetPaths: relatedPaths,
        });
      } else if (promoteFrom && mode === 'decision') {
        // Work Record (or legacy conversation) promoted to a Decision.
        result = await assetClient.createDecision({
          title,
          status,
          content,
          sourceConversations: [promoteFrom.id],
          relatedAssetPaths: relatedPaths,
        });
      } else if (mode === 'transcript-import') {
        // Imported original transcript (ChatGPT / Codex / CodeBuddy export / markdown / json).
        result = await assetClient.createTranscript({
          title,
          source,
          content,
          captureMode: 'imported-transcript',
          relatedAssetPaths: relatedPaths,
        });
      } else if (mode === 'manual-record') {
        // Human-entered discussion record (manual capture mode, still a Work Record).
        result = await assetClient.createConversation({
          title,
          source,
          content,
          captureMode: 'manual',
          relatedAssetPaths: relatedPaths,
        });
      } else if (mode === 'design') {
        result = await assetClient.createDesign({ title, designArea, content, relatedAssetPaths: relatedPaths });
      } else {
        result = await assetClient.createDecision({ title, status, content, relatedAssetPaths: relatedPaths });
      }
      onCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head">
          <h3>{dialogTitle}</h3>
          <button className="icon-button" aria-label={t('cancel')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {promoteFrom ? (
            <p className="detail-summary">{t('managedNotice')}</p>
          ) : (
            <p className="detail-summary">{t('managedNotice')}</p>
          )}

          <label className="form-field">
            <span>{t('lblTitle')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'decision' ? 'Managed Knowledge Assets' : 'Asset Workbench Persistence'}
            />
          </label>

          {mode === 'transcript-import' || mode === 'manual-record' ? (
            <label className="form-field">
              <span>{t('lblSource')}</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.key)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === 'design' ? (
            <label className="form-field">
              <span>{t('lblDesignArea')}</span>
              <select value={designArea} onChange={(e) => setDesignArea(e.target.value)}>
                {DESIGN_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === 'decision' ? (
            <label className="form-field">
              <span>{t('lblStatus')}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {DECISION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="form-field">
            <span>{mode === 'decision' ? t('lblDecisionContent') : t('lblContent')}</span>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={mode === 'transcript-import' ? 14 : mode === 'manual-record' ? 8 : 12}
              placeholder={mode === 'transcript-import' ? t('placeholderTranscriptImport') : ''}
            />
          </label>

          <label className="form-field">
            <span>{t('lblRelatedAssets')}</span>
            <textarea
              className="form-textarea"
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              rows={3}
              placeholder={'02-design/architecture/foo.md'}
            />
          </label>

          {error ? (
            <div className="banner error">
              <span>{t('errCreateFailed')}: {error}</span>
            </div>
          ) : null}
        </div>

        <div className="modal-foot">
          <button className="secondary-button" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </button>
          <button className="primary-button" onClick={submit} disabled={busy || title.trim().length === 0}>
            {busy ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
