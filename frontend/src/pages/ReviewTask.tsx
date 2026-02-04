import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ReviewTask as ReviewTaskType, RiskLevel, DecisionType } from '@hilt-review/shared';
import { getReviewTask, submitDecision as submitDecisionApi } from '../api/client';
import styles from './ReviewTask.module.css';

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

export default function ReviewTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReviewTaskType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReviewTask(id)
      .then(setTask)
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleSubmitDecision(decision: DecisionType) {
    if (!task || !id) return;

    setIsSubmitting(true);
    try {
      await submitDecisionApi(id, { decision });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className={styles.loading}>Loading task...</div>;
  }

  if (error || !task) {
    return <div className={styles.error}>{error || 'Task not found'}</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button onClick={() => navigate('/')} className={styles.backButton}>
            &larr; Back to Queue
          </button>
          <span className={`${styles.riskBadge} ${styles[task.risk_level]}`}>
            {RISK_LABELS[task.risk_level]}
          </span>
        </div>
        <div className={styles.taskInfo}>
          <span className={styles.service}>{task.service.name}</span>
          <span className={styles.action}>{task.action.verb}</span>
        </div>
        <h1 className={styles.title}>{task.title}</h1>
        {task.risk_warning && (
          <p className={styles.warning}>{task.risk_warning}</p>
        )}
      </header>

      <section className={styles.content}>
        <h2 className={styles.sectionTitle}>Content</h2>
        {task.blocks_working.map(block => (
          <div key={block.id} className={styles.block}>
            {block.label && (
              <div className={styles.blockLabel}>{block.label}</div>
            )}
            <div className={styles.blockContent}>
              {typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content, null, 2)}
            </div>
          </div>
        ))}
      </section>

      {task.execution_intent?.display && (
        <section className={styles.intent}>
          <h2 className={styles.sectionTitle}>Execution Intent</h2>
          <div className={styles.intentDetails}>
            {task.execution_intent.display.action_type && (
              <p className={styles.intentAction}>
                <strong>Action:</strong> {task.execution_intent.display.action_type}
              </p>
            )}
            {task.execution_intent.display.target && (
              <p className={styles.intentTarget}>
                <strong>Target:</strong> {task.execution_intent.display.target}
              </p>
            )}
            {task.execution_intent.display.warning && (
              <p className={styles.intentWarning}>
                {task.execution_intent.display.warning}
              </p>
            )}
          </div>
        </section>
      )}

      <footer className={styles.actions}>
        <button
          onClick={() => handleSubmitDecision('DENY')}
          disabled={isSubmitting}
          className={styles.denyButton}
        >
          Deny
        </button>
        <button
          onClick={() => handleSubmitDecision('APPROVE')}
          disabled={isSubmitting}
          className={styles.approveButton}
        >
          Approve
        </button>
      </footer>
    </div>
  );
}
