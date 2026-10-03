import type { ImportStatus, ReleaseObservationStatus, RepositoryStatus, StepState } from '../domain/workspace';
import { useI18n } from '../i18n/I18nProvider';

type StatusBadgeProps = {
  value: RepositoryStatus | ImportStatus | ReleaseObservationStatus | StepState | string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const { t } = useI18n();
  return <span className={`status-badge ${value}`}>{t(`st_${value}`)}</span>;
}
