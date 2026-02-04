import { Link } from 'react-router-dom';
import type { RiskLevel } from '@hilt-review/shared';
import { useReviewTasks } from '../hooks/useReviewTasks';
import styles from './ReviewQueue.module.css';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'var(--risk-low)',
  medium: 'var(--risk-medium)',
  high: 'var(--risk-high)',
  critical: 'var(--risk-critical)',
};

export default function ReviewQueue() {
  const { tasks, isLoading, error } = useReviewTasks({ status: 'PENDING' });

  if (isLoading) {
    return <div className={styles.loading}>Loading tasks...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error.message}</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Review Queue</h1>
      {tasks.length === 0 ? (
        <div className={styles.empty}>No pending tasks</div>
      ) : (
        <div className={styles.taskList}>
          {tasks.map(task => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className={styles.taskCard}
            >
              <div
                className={styles.riskBand}
                style={{ backgroundColor: RISK_COLORS[task.risk_level] }}
              />
              <div className={styles.taskContent}>
                <div className={styles.taskHeader}>
                  <span className={styles.service}>{task.service.name}</span>
                  <span className={styles.action}>{task.action.verb}</span>
                </div>
                <h2 className={styles.taskTitle}>{task.title}</h2>
                {task.preview && (
                  <p className={styles.preview}>{task.preview}</p>
                )}
                <div className={styles.taskMeta}>
                  <span className={styles.source}>{task.source_name}</span>
                  <span className={styles.date}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
