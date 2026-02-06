import { useState, useCallback } from 'react';
import { Button } from '../components/ui';
import { AdminKeyPrompt } from '../components/AdminKeyPrompt';
import { SourceCard } from '../components/SourceCard';
import { CreateSourceModal } from '../components/CreateSourceModal';
import { GenerateApiKeyModal } from '../components/GenerateApiKeyModal';
import { IntegrationInstructions } from '../components/IntegrationInstructions';
import { useAdminKey } from '../hooks/useAdminKey';
import { useSources, useApiKeys } from '../hooks/useSources';
import type { Source } from '@hilt-review/shared';
import styles from './IntegrationSetup.module.css';

export default function IntegrationSetup() {
  const { isConfigured, setAdminKey, clearAdminKey } = useAdminKey();
  const { sources, isLoading, error, createSource, deleteSource, refresh } = useSources();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyModalSource, setKeyModalSource] = useState<Source | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | undefined>();

  // Use the first source as selected if none selected
  const effectiveSourceId = selectedSourceId || sources[0]?.id || null;

  if (!isConfigured) {
    return (
      <div className={styles.container}>
        <AdminKeyPrompt onSave={setAdminKey} />
      </div>
    );
  }

  const handleCreateSource = async (params: Parameters<typeof createSource>[0]) => {
    const source = await createSource(params);
    setSelectedSourceId(source.id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>API Integrations</h1>
          <p className={styles.subtitle}>
            Manage your agent integrations and API keys
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Create Integration
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAdminKey}>
            Change Admin Key
          </Button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          Failed to load sources: {error.message}
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>Loading integrations...</div>
      ) : sources.length === 0 ? (
        <div className={styles.empty}>
          <p>No integrations yet.</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Create your first integration
          </Button>
        </div>
      ) : (
        <div className={styles.sourceList}>
          {sources.map((source) => (
            <SourceCardWithKeys
              key={source.id}
              source={source}
              isSelected={source.id === effectiveSourceId}
              onSelect={() => setSelectedSourceId(source.id)}
              onGenerateKey={() => setKeyModalSource(source)}
              onDelete={() => deleteSource(source.id)}
            />
          ))}
        </div>
      )}

      {effectiveSourceId && (
        <IntegrationInstructions
          sourceId={effectiveSourceId}
          apiKey={lastGeneratedKey}
        />
      )}

      <CreateSourceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSource}
      />

      {keyModalSource && (
        <GenerateApiKeyModalWrapper
          source={keyModalSource}
          onClose={() => setKeyModalSource(null)}
          onKeyGenerated={setLastGeneratedKey}
        />
      )}
    </div>
  );
}

// Wrapper component to manage API keys for a source
function SourceCardWithKeys({
  source,
  isSelected,
  onSelect,
  onGenerateKey,
  onDelete,
}: {
  source: Source;
  isSelected: boolean;
  onSelect: () => void;
  onGenerateKey: () => void;
  onDelete: () => void;
}) {
  const { keys, isLoading, revokeKey } = useApiKeys(source.id);

  return (
    <div onClick={onSelect} className={isSelected ? styles.selected : ''}>
      <SourceCard
        source={source}
        apiKeys={keys}
        isLoadingKeys={isLoading}
        onGenerateKey={onGenerateKey}
        onRevokeKey={revokeKey}
        onDelete={onDelete}
      />
    </div>
  );
}

// Wrapper to handle key generation with the hook
function GenerateApiKeyModalWrapper({
  source,
  onClose,
  onKeyGenerated,
}: {
  source: Source;
  onClose: () => void;
  onKeyGenerated: (key: string) => void;
}) {
  const { generateKey } = useApiKeys(source.id);

  const handleGenerate = useCallback(
    async (params: { environment: 'live' | 'test'; name?: string }) => {
      const result = await generateKey({ ...params, key_type: 'source' });
      onKeyGenerated(result.key);
      return result;
    },
    [generateKey, onKeyGenerated]
  );

  return (
    <GenerateApiKeyModal
      isOpen={true}
      onClose={onClose}
      sourceName={source.name}
      onGenerate={handleGenerate}
    />
  );
}
