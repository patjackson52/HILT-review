import { useState } from 'react';
import { Modal, Button, Input, Select, CodeBlock } from './ui';
import type { GenerateApiKeyResponse } from '../api/client';
import styles from './GenerateApiKeyModal.module.css';

interface GenerateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceName: string;
  onGenerate: (params: { environment: 'live' | 'test'; name?: string }) => Promise<GenerateApiKeyResponse>;
}

const environmentOptions = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
];

export function GenerateApiKeyModal({
  isOpen,
  onClose,
  sourceName,
  onGenerate,
}: GenerateApiKeyModalProps) {
  const [environment, setEnvironment] = useState<'live' | 'test'>('test');
  const [name, setName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<GenerateApiKeyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const result = await onGenerate({
        environment,
        name: name.trim() || undefined,
      });
      setGeneratedKey(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    // Only allow close if acknowledged or no key generated
    if (generatedKey && !acknowledged) {
      return;
    }
    setEnvironment('test');
    setName('');
    setGeneratedKey(null);
    setError(null);
    setAcknowledged(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={generatedKey ? 'API Key Generated' : `Generate API Key for ${sourceName}`}
      size="md"
      closeOnBackdrop={!generatedKey || acknowledged}
    >
      {generatedKey ? (
        <div className={styles.keyDisplay}>
          <div className={styles.warning}>
            <strong>Important:</strong> This key will only be shown once.
            Copy and store it securely now.
          </div>

          <CodeBlock code={generatedKey.key} language="API Key" />

          <div className={styles.keyMeta}>
            <span>Environment: {generatedKey.environment}</span>
            {generatedKey.name && <span>Name: {generatedKey.name}</span>}
          </div>

          <label className={styles.acknowledge}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I have copied and saved this API key
          </label>

          <div className={styles.actions}>
            <Button onClick={handleClose} disabled={!acknowledged}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.form}>
          <Select
            label="Environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'live' | 'test')}
            options={environmentOptions}
            fullWidth
          />

          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Server"
            fullWidth
          />

          <p className={styles.hint}>
            Use <strong>test</strong> keys for development and{' '}
            <strong>live</strong> keys for production.
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} isLoading={isGenerating}>
              Generate Key
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
