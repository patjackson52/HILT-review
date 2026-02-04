import { useState, useCallback } from 'react';
import type { DecisionType, InteractionSchema, DenyReason, ReviewTaskStatus } from '@hilt-review/shared';
import styles from './DecisionControls.module.css';

interface DecisionControlsProps {
  status: ReviewTaskStatus;
  interactionSchema?: InteractionSchema;
  hasChanges?: boolean;
  isSubmitting?: boolean;
  onSubmit: (decision: DecisionType, reason?: string) => void;
}

export function DecisionControls({
  status,
  interactionSchema,
  hasChanges = false,
  isSubmitting = false,
  onSubmit,
}: DecisionControlsProps) {
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  const denyReasons = interactionSchema?.deny_reasons || [];
  const requireConfirmation = interactionSchema?.require_confirmation;

  const handleApprove = useCallback(() => {
    if (requireConfirmation) {
      const confirmed = window.confirm(
        'Are you sure you want to approve this task? This action cannot be undone.'
      );
      if (!confirmed) return;
    }
    onSubmit('APPROVE');
  }, [requireConfirmation, onSubmit]);

  const handleDenyClick = useCallback(() => {
    if (denyReasons.length > 0) {
      setShowDenyDialog(true);
    } else {
      onSubmit('DENY');
    }
  }, [denyReasons.length, onSubmit]);

  const handleDenySubmit = useCallback(() => {
    const reason = selectedReason === 'custom' ? customReason : selectedReason;
    onSubmit('DENY', reason || undefined);
    setShowDenyDialog(false);
    setSelectedReason('');
    setCustomReason('');
  }, [selectedReason, customReason, onSubmit]);

  const handleDenyCancel = useCallback(() => {
    setShowDenyDialog(false);
    setSelectedReason('');
    setCustomReason('');
  }, []);

  // If task is already decided, show status
  if (status !== 'PENDING') {
    return (
      <div className={styles.decidedContainer}>
        <div className={`${styles.decidedBadge} ${styles[status.toLowerCase()]}`}>
          {status === 'APPROVED' && '✓ Approved'}
          {status === 'DENIED' && '✕ Denied'}
          {status === 'DISPATCHED' && '→ Dispatched'}
          {status === 'ARCHIVED' && '◊ Archived'}
        </div>
      </div>
    );
  }

  return (
    <>
      <footer className={styles.controls}>
        {hasChanges && (
          <div className={styles.changesIndicator}>
            <span className={styles.changesIcon}>✎</span>
            Changes made
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={handleDenyClick}
            disabled={isSubmitting}
            className={styles.denyButton}
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className={styles.approveButton}
          >
            {isSubmitting ? 'Submitting...' : 'Approve'}
          </button>
        </div>
      </footer>

      {showDenyDialog && (
        <div className={styles.dialogOverlay} onClick={handleDenyCancel}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Deny Task</h3>
            <p className={styles.dialogDescription}>
              Please select a reason for denying this task:
            </p>

            <div className={styles.reasonList}>
              {denyReasons.map((reason: DenyReason) => (
                <label key={reason.id} className={styles.reasonOption}>
                  <input
                    type="radio"
                    name="denyReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                  />
                  <span className={styles.reasonLabel}>{reason.label}</span>
                </label>
              ))}
              <label className={styles.reasonOption}>
                <input
                  type="radio"
                  name="denyReason"
                  value="custom"
                  checked={selectedReason === 'custom'}
                  onChange={(e) => setSelectedReason(e.target.value)}
                />
                <span className={styles.reasonLabel}>Other (specify)</span>
              </label>
            </div>

            {selectedReason === 'custom' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter your reason..."
                className={styles.customReasonInput}
                autoFocus
              />
            )}

            <div className={styles.dialogActions}>
              <button onClick={handleDenyCancel} className={styles.dialogCancelButton}>
                Cancel
              </button>
              <button
                onClick={handleDenySubmit}
                disabled={!selectedReason || (selectedReason === 'custom' && !customReason)}
                className={styles.dialogDenyButton}
              >
                Deny Task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
