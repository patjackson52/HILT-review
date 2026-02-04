import type { ExecutionIntent } from '@hilt-review/shared';
import styles from './ExecutionIntentPanel.module.css';

interface ExecutionIntentPanelProps {
  intent: ExecutionIntent;
}

const KIND_LABELS: Record<ExecutionIntent['kind'], string> = {
  command_template: 'Command Template',
  mcp_tool_call: 'MCP Tool Call',
  http_request: 'HTTP Request',
  custom: 'Custom Action',
};

const KIND_ICONS: Record<ExecutionIntent['kind'], string> = {
  command_template: '$',
  mcp_tool_call: '⚡',
  http_request: '🌐',
  custom: '⚙',
};

export function ExecutionIntentPanel({ intent }: ExecutionIntentPanelProps) {
  const hasDisplay = intent.display && (
    intent.display.action_type ||
    intent.display.target ||
    intent.display.warning
  );

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        <span className={styles.titleIcon}>🎯</span>
        Execution Intent
      </h2>

      <div className={styles.kindBadge}>
        <span className={styles.kindIcon}>{KIND_ICONS[intent.kind]}</span>
        {KIND_LABELS[intent.kind]}
        {intent.template_id && (
          <code className={styles.templateId}>{intent.template_id}</code>
        )}
      </div>

      {hasDisplay && (
        <div className={styles.details}>
          {intent.display?.action_type && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Action:</span>
              <span className={styles.detailValue}>
                {intent.display.icon && (
                  <span className={styles.actionIcon}>{intent.display.icon}</span>
                )}
                {intent.display.action_type}
              </span>
            </div>
          )}

          {intent.display?.target && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Target:</span>
              <span className={styles.detailValue}>{intent.display.target}</span>
            </div>
          )}

          {intent.display?.warning && (
            <div className={styles.warning}>
              <span className={styles.warningIcon}>⚠</span>
              {intent.display.warning}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
