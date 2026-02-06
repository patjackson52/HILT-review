import { useState } from 'react';
import type { DeliveryMode } from '@hilt-review/shared';
import { Modal, Button, Input, Textarea, Select } from './ui';
import type { CreateSourceParams } from '../api/client';
import styles from './CreateSourceModal.module.css';

interface CreateSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: CreateSourceParams) => Promise<void>;
}

const deliveryModeOptions = [
  { value: 'PULL_ONLY', label: 'Pull Only' },
  { value: 'WEBHOOK_ONLY', label: 'Webhook Only' },
  { value: 'WEBHOOK_AND_PULL', label: 'Webhook + Pull' },
];

export function CreateSourceModal({ isOpen, onClose, onSubmit }: CreateSourceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('PULL_ONLY');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showWebhookFields = deliveryMode !== 'PULL_ONLY';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const params: CreateSourceParams = {
        name: name.trim(),
        description: description.trim() || undefined,
        delivery: {
          mode: deliveryMode,
          webhook: showWebhookFields
            ? {
                enabled: true,
                url: webhookUrl.trim() || undefined,
                secret: webhookSecret.trim() || undefined,
                timeout_ms: 5000,
                max_attempts: 10,
                retry_backoff_seconds: 30,
              }
            : { enabled: false },
        },
      };

      await onSubmit(params);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setDeliveryMode('PULL_ONLY');
    setWebhookUrl('');
    setWebhookSecret('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Integration" size="md">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Agent"
          required
          fullWidth
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this integration do?"
          fullWidth
        />

        <Select
          label="Delivery Mode"
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
          options={deliveryModeOptions}
          fullWidth
        />

        {showWebhookFields && (
          <>
            <Input
              label="Webhook URL"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/webhook"
              fullWidth
            />
            <Input
              label="Webhook Secret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Optional signing secret"
              fullWidth
            />
            <p className={styles.hint}>
              Webhook requests include an HMAC-SHA256 signature in the{' '}
              <code>X-HILT-Signature</code> header.
            </p>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
