import type { WizardStep } from '../domain/workspace';
import { useI18n } from '../i18n/I18nProvider';

interface StepRailProps {
  steps: WizardStep[];
  activeStep: string;
  onSelect: (stepId: string) => void;
  compact?: boolean;
}

export function StepRail({ steps, activeStep, onSelect, compact = false }: StepRailProps) {
  const { t, loc } = useI18n();
  return (
    <aside className={compact ? 'step-rail compact' : 'step-rail'} aria-label="Workspace bootstrap steps">
      <div className="rail-title">
        <span>{t('setup')}</span>
        <strong>{t('workspaceBootstrap')}</strong>
      </div>
      <nav>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const selected = step.id === activeStep;
          return (
            <button className={`step-item ${selected ? 'selected' : ''} ${step.state}`} key={step.id} onClick={() => onSelect(step.id)}>
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="step-icon">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              <span className="step-copy">
                <span>{loc(step.title)}</span>
                <small>{loc(step.eyebrow)}</small>
              </span>
              <span className="state-dot" title={t(`st_${step.state}`)} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
