import { ArrowRight, Braces, ClipboardList, Gavel, MessageSquareText } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface KnowledgeLifecycleProps {
  compact?: boolean;
  titleKey?: string;
  leadKey?: string;
  onOpenAi?: () => void;
  onOpenConversations?: () => void;
  onOpenDecisions?: () => void;
}

const STEPS = [
  ['knowledgeStepConversationTitle', 'knowledgeStepConversationBody', MessageSquareText],
  ['knowledgeStepWorkRecordTitle', 'knowledgeStepWorkRecordBody', ClipboardList],
  ['knowledgeStepDesignTitle', 'knowledgeStepDesignBody', Braces],
  ['knowledgeStepDecisionTitle', 'knowledgeStepDecisionBody', Gavel],
] as const;

export function KnowledgeLifecycle({
  compact = false,
  titleKey = 'knowledgeLifecycleTitle',
  leadKey = 'knowledgeLifecycleLead',
  onOpenAi,
  onOpenConversations,
  onOpenDecisions,
}: KnowledgeLifecycleProps) {
  const { t } = useI18n();

  return (
    <section className={compact ? 'panel knowledge-lifecycle compact' : 'panel knowledge-lifecycle'}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('knowledgeLifecycleEyebrow')}</p>
          <h2>{t(titleKey)}</h2>
          <p className="knowledge-lifecycle-lead">{t(leadKey)}</p>
        </div>
      </div>

      <div className="knowledge-lifecycle-flow">
        {STEPS.map(([title, body, Icon], index) => (
          <div className="knowledge-lifecycle-stage" key={title}>
            <div className="knowledge-lifecycle-stage-head">
              <span>{index + 1}</span>
              <Icon size={17} />
            </div>
            <strong>{t(title)}</strong>
            <p>{t(body)}</p>
          </div>
        ))}
      </div>

      <div className="knowledge-lifecycle-rule">
        <strong>{t('knowledgeLifecycleRuleTitle')}</strong>
        <span>{t('knowledgeLifecycleRuleBody')}</span>
      </div>

      {onOpenAi || onOpenConversations || onOpenDecisions ? (
        <div className="knowledge-lifecycle-actions">
          {onOpenAi ? (
            <button className="secondary-button" onClick={onOpenAi}>
              {t('knowledgeActionAi')} <ArrowRight size={15} />
            </button>
          ) : null}
          {onOpenConversations ? (
            <button className="secondary-button" onClick={onOpenConversations}>
              {t('knowledgeActionConversations')} <ArrowRight size={15} />
            </button>
          ) : null}
          {onOpenDecisions ? (
            <button className="secondary-button" onClick={onOpenDecisions}>
              {t('knowledgeActionDecisions')} <ArrowRight size={15} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
