import { CheckCircle2, CircleDashed, TerminalSquare, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { StarterCreator } from './StarterCreator';
import { InstanceLifecyclePanel } from './InstanceLifecyclePanel';

interface CreatorWorkbenchProps {
  onActivated?: () => void;
}

export function CreatorWorkbench({ onActivated }: CreatorWorkbenchProps) {
  const { t } = useI18n();

  const capabilities = [
    { id: 'knowledge', title: t('creatorCapabilityKnowledge'), body: t('creatorCapabilityKnowledgeBody'), status: 'available' as const },
    { id: 'instance', title: t('creatorCapabilityInstance'), body: t('creatorCapabilityInstanceBody'), status: 'available' as const },
    { id: 'upgrade', title: t('creatorCapabilityUpgrade'), body: t('creatorCapabilityUpgradeBody'), status: 'available' as const },
    { id: 'migration', title: t('creatorCapabilityMigration'), body: t('creatorCapabilityMigrationBody'), status: 'available' as const },
  ];

  return (
    <section className="creator-workbench">
      <section className="panel creator-workbench-hero">
        <div>
          <p className="eyebrow">{t('creatorWorkbenchEyebrow')}</p>
          <h2>{t('creatorWorkbenchTitle')}</h2>
          <p className="detail-summary">{t('creatorWorkbenchLead')}</p>
        </div>
        <TerminalSquare size={30} />
      </section>

      <section className="creator-capability-grid">
        {capabilities.map((capability) => (
          <article className="panel creator-capability-card" key={capability.id}>
            <div className="creator-capability-head">
              <strong>{capability.title}</strong>
              <span className={`framework-capability-status ${capability.status}`}>
                {capability.status === 'available' ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
                {capability.status === 'available' ? t('frameworkCapabilityAvailable') : t('frameworkCapabilityPlanned')}
              </span>
            </div>
            <p>{capability.body}</p>
          </article>
        ))}
      </section>

      <StarterCreator onActivated={onActivated} />
      <InstanceLifecyclePanel />

      <section className="panel creator-workbench-boundary">
        <Wrench size={20} />
        <div>
          <strong>{t('creatorWorkbenchBoundaryTitle')}</strong>
          <p>{t('creatorWorkbenchBoundaryBody')}</p>
        </div>
      </section>
    </section>
  );
}
