import { Link } from 'react-router-dom';
import type { ReviewTask, RiskLevel } from '@hilt-review/shared';
import { RiskBadge } from './ui';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: ReviewTask;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'var(--risk-low)',
  medium: 'var(--risk-medium)',
  high: 'var(--risk-high)',
  critical: 'var(--risk-critical)',
};

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Link to={`/tasks/${task.id}`} className={styles.card}>
      <div
        className={styles.riskBand}
        style={{ backgroundColor: RISK_COLORS[task.risk_level] }}
      />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.labels}>
            <span className={styles.service}>
              {task.service.icon && <span className={styles.icon}>{task.service.icon}</span>}
              {task.service.name}
            </span>
            <span className={styles.separator}>|</span>
            <span className={styles.action}>
              {task.action.icon && <span className={styles.icon}>{task.action.icon}</span>}
              {task.action.verb}
            </span>
          </div>
          <RiskBadge level={task.risk_level} />
        </div>
        <h3 className={styles.title}>{task.title}</h3>
        {task.preview && (
          <p className={styles.preview}>{task.preview}</p>
        )}
        <div className={styles.meta}>
          <span className={styles.source}>{task.source_name}</span>
          <span className={styles.date}>
            {formatRelativeDate(task.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
