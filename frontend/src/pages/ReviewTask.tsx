import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ReviewTask as ReviewTaskType, DecisionType, ArtifactBlock } from '@hilt-review/shared';
import { getReviewTask, submitDecision as submitDecisionApi, patchBlocks } from '../api/client';
import { TaskHeader } from '../components/TaskHeader';
import { ExecutionIntentPanel } from '../components/ExecutionIntentPanel';
import { BlockList } from '../components/BlockEditor';
import { DecisionControls } from '../components/DecisionControls';
import styles from './ReviewTask.module.css';

export default function ReviewTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReviewTaskType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBlocks, setLocalBlocks] = useState<ArtifactBlock[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!id) return;
    getReviewTask(id)
      .then((data) => {
        setTask(data);
        setLocalBlocks(data.blocks_working);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleBlockChange = useCallback((blockId: string, content: string | Record<string, unknown>) => {
    setLocalBlocks(prev => {
      const updated = prev.map(block =>
        block.id === blockId ? { ...block, content } : block
      );
      return updated;
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleSubmitDecision = useCallback(async (decision: DecisionType, reason?: string) => {
    if (!task || !id) return;

    setIsSubmitting(true);
    try {
      // If there are unsaved changes, save blocks first
      if (hasUnsavedChanges) {
        await patchBlocks(id, {
          blocks: localBlocks.map(b => ({ id: b.id, content: b.content })),
        });
      }

      await submitDecisionApi(id, { decision, reason });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }, [task, id, hasUnsavedChanges, localBlocks, navigate]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate('/');
  }, [hasUnsavedChanges, navigate]);

  if (isLoading) {
    return <div className={styles.loading}>Loading task...</div>;
  }

  if (error || !task) {
    return (
      <div className={styles.error}>
        <p>{error || 'Task not found'}</p>
        <button onClick={() => navigate('/')} className={styles.backLink}>
          Back to Queue
        </button>
      </div>
    );
  }

  const hasChanges = hasUnsavedChanges ||
    JSON.stringify(task.blocks_original) !== JSON.stringify(task.blocks_working);

  return (
    <div className={styles.container}>
      <TaskHeader task={task} onBack={handleBack} />

      {task.execution_intent && (
        <ExecutionIntentPanel intent={task.execution_intent} />
      )}

      <BlockList
        blocks={localBlocks}
        onChange={task.status === 'PENDING' ? handleBlockChange : undefined}
        readonly={task.status !== 'PENDING'}
        title="Content"
      />

      <DecisionControls
        status={task.status}
        interactionSchema={task.interaction_schema}
        hasChanges={hasChanges}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitDecision}
      />
    </div>
  );
}
