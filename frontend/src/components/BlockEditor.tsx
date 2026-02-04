import { useState, useCallback } from 'react';
import type { ArtifactBlock } from '@hilt-review/shared';
import styles from './BlockEditor.module.css';

interface BlockEditorProps {
  block: ArtifactBlock;
  onChange?: (blockId: string, content: string | Record<string, unknown>) => void;
  readonly?: boolean;
}

export function BlockEditor({ block, onChange, readonly = false }: BlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const contentString = typeof block.content === 'string'
    ? block.content
    : JSON.stringify(block.content, null, 2);

  const canEdit = block.editable && !readonly && onChange;

  const handleStartEdit = useCallback(() => {
    setEditValue(contentString);
    setError(null);
    setIsEditing(true);
  }, [contentString]);

  const handleSave = useCallback(() => {
    if (!onChange) return;

    try {
      if (block.type === 'json') {
        // Validate JSON
        const parsed = JSON.parse(editValue);
        onChange(block.id, parsed);
      } else {
        onChange(block.id, editValue);
      }
      setIsEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid content');
    }
  }, [block.id, block.type, editValue, onChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
    setError(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [handleCancel, handleSave]);

  return (
    <div className={`${styles.block} ${isEditing ? styles.editing : ''}`}>
      <div className={styles.header}>
        {block.label && (
          <span className={styles.label}>{block.label}</span>
        )}
        <span className={styles.typeBadge}>{block.type}</span>
        {canEdit && !isEditing && (
          <button
            onClick={handleStartEdit}
            className={styles.editButton}
            title="Edit block"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className={styles.editContainer}>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.textarea}
            autoFocus
            spellCheck={block.type !== 'json'}
          />
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.editActions}>
            <span className={styles.hint}>
              Press <kbd>Esc</kbd> to cancel, <kbd>Cmd+S</kbd> to save
            </span>
            <button onClick={handleCancel} className={styles.cancelButton}>
              Cancel
            </button>
            <button onClick={handleSave} className={styles.saveButton}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <pre className={styles.content}>
          <code>{contentString}</code>
        </pre>
      )}
    </div>
  );
}

interface BlockListProps {
  blocks: ArtifactBlock[];
  onChange?: (blockId: string, content: string | Record<string, unknown>) => void;
  readonly?: boolean;
  title?: string;
}

export function BlockList({ blocks, onChange, readonly = false, title }: BlockListProps) {
  if (blocks.length === 0) {
    return (
      <section className={styles.section}>
        {title && <h2 className={styles.sectionTitle}>{title}</h2>}
        <div className={styles.emptyState}>No content blocks</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      {title && <h2 className={styles.sectionTitle}>{title}</h2>}
      <div className={styles.blockList}>
        {blocks.map(block => (
          <BlockEditor
            key={block.id}
            block={block}
            onChange={onChange}
            readonly={readonly}
          />
        ))}
      </div>
    </section>
  );
}
