import { Link } from 'react-router-dom';
import { useReviewTasks } from '../hooks/useReviewTasks';
import styles from './Archive.module.css';

export default function Archive() {
  const { tasks, isLoading, error } = useReviewTasks({ status: 'ARCHIVED' });

  if (isLoading) {
    return <div className={styles.loading}>Loading archived tasks...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error.message}</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Archive</h1>
      {tasks.length === 0 ? (
        <div className={styles.empty}>No archived tasks</div>
      ) : (
        <div className={styles.taskList}>
          {tasks.map(task => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className={styles.taskCard}
            >
              <div className={styles.taskContent}>
                <div className={styles.taskHeader}>
                  <span className={styles.service}>{task.service.name}</span>
                  <span className={styles.action}>{task.action.verb}</span>
                  {task.decision && (
                    <span
                      className={`${styles.decisionBadge} ${
                        task.decision.type === 'APPROVE'
                          ? styles.approved
                          : styles.denied
                      }`}
                    >
                      {task.decision.type === 'APPROVE' ? '✓ Approved' : '✕ Denied'}
                    </span>
                  )}
                </div>
                <h2 className={styles.taskTitle}>{task.title}</h2>
                {task.preview && (
                  <p className={styles.preview}>{task.preview}</p>
                )}
                <div className={styles.taskMeta}>
                  <span className={styles.source}>{task.source_name}</span>
                  <span className={styles.date}>
                    Archived {task.archived_at
                      ? new Date(task.archived_at).toLocaleDateString()
                      : new Date(task.updated_at).toLocaleDateString()}
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
