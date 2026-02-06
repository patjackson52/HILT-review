import { useState } from 'react';
import type { Source } from '@hilt-review/shared';
import { Card, CardHeader, CardContent, Button, Badge } from './ui';
import type { ApiKeyInfo } from '../api/client';
import styles from './SourceCard.module.css';

interface SourceCardProps {
  source: Source;
  apiKeys: ApiKeyInfo[];
  isLoadingKeys: boolean;
  onGenerateKey: () => void;
  onRevokeKey: (keyId: string) => void;
  onDelete: () => void;
}

export function SourceCard({
  source,
  apiKeys,
  isLoadingKeys,
  onGenerateKey,
  onRevokeKey,
  onDelete,
}: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deliveryModeLabels: Record<string, string> = {
    WEBHOOK_ONLY: 'Webhook',
    PULL_ONLY: 'Pull',
    WEBHOOK_AND_PULL: 'Webhook + Pull',
  };

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.name}>{source.name}</h3>
          <Badge variant="secondary">
            {deliveryModeLabels[source.delivery.mode] || source.delivery.mode}
          </Badge>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" size="sm" onClick={onGenerateKey}>
            Generate Key
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="danger" size="sm" onClick={onDelete}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {source.description && (
          <p className={styles.description}>{source.description}</p>
        )}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            ID: <code>{source.id}</code>
          </span>
          <span className={styles.metaItem}>
            Created: {new Date(source.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className={styles.keysSection}>
          <button
            type="button"
            className={styles.keysToggle}
            onClick={() => setExpanded(!expanded)}
          >
            API Keys ({apiKeys.length})
            <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className={styles.keysList}>
              {isLoadingKeys ? (
                <p className={styles.loading}>Loading keys...</p>
              ) : apiKeys.length === 0 ? (
                <p className={styles.empty}>No API keys yet</p>
              ) : (
                apiKeys.map((key) => (
                  <div key={key.id} className={styles.keyRow}>
                    <div className={styles.keyInfo}>
                      <code className={styles.keyPrefix}>{key.key_prefix}...</code>
                      <Badge
                        variant={key.environment === 'live' ? 'success' : 'secondary'}
                      >
                        {key.environment}
                      </Badge>
                      {key.name && (
                        <span className={styles.keyName}>{key.name}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevokeKey(key.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
