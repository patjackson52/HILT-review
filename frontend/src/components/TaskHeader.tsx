import type { ReviewTask, RiskLevel } from '@hilt-review/shared';
import styles from './TaskHeader.module.css';

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

interface TaskHeaderProps {
  task: ReviewTask;
  onBack?: () => void;
}

export function TaskHeader({ task, onBack }: TaskHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        {onBack && (
          <button onClick={onBack} className={styles.backButton}>
            &larr; Back to Queue
          </button>
        )}
        <span className={`${styles.riskBadge} ${styles[task.risk_level]}`}>
          {RISK_LABELS[task.risk_level]}
        </span>
      </div>

      <div className={styles.taskMeta}>
        <span className={styles.service}>
          {task.service.icon && <span className={styles.icon}>{task.service.icon}</span>}
          {task.service.name}
        </span>
        <span className={styles.separator}>&rarr;</span>
        <span className={styles.action}>
          {task.action.icon && <span className={styles.icon}>{task.action.icon}</span>}
          {task.action.verb}
        </span>
        {task.source_service && (
          <>
            <span className={styles.separator}>via</span>
            <span className={styles.sourceService}>{task.source_service.name}</span>
          </>
        )}
      </div>

      <h1 className={styles.title}>{task.title}</h1>

      {task.risk_warning && (
        <div className={styles.warning}>
          <span className={styles.warningIcon}>⚠</span>
          {task.risk_warning}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.source}>Source: {task.source_name}</span>
        <span className={styles.time}>
          Created: {new Date(task.created_at).toLocaleString()}
        </span>
      </div>
    </header>
  );
}
