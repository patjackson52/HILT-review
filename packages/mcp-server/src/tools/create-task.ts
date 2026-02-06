import type { ArtifactBlock, BlockType } from '@hilt-review/shared';
import { HiltApiClient } from '../api-client.js';

const inputSchema = {
  type: 'object' as const,
  required: ['summary', 'blocks'],
  properties: {
    summary: {
      type: 'string',
      description: 'Short description of what this action will do (max 200 chars)',
    },
    blocks: {
      type: 'array',
      description: 'Content blocks for the reviewer to see and optionally edit',
      items: {
        type: 'object',
        required: ['type', 'content'],
        properties: {
          type: {
            type: 'string',
            enum: ['markdown', 'plaintext', 'json'],
            description: 'Content type of the block',
          },
          content: {
            type: 'string',
            description: 'Block content (text or stringified JSON)',
          },
          editable: {
            type: 'boolean',
            default: true,
            description: 'Whether the reviewer can edit this block',
          },
        },
      },
    },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH'],
      default: 'NORMAL',
    },
    risk_level: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      description: 'Risk level of the proposed action',
    },
    execution_intent: {
      type: 'object',
      description: 'What will happen if approved (shown to reviewer)',
      properties: {
        action_type: { type: 'string', description: 'e.g. Send Email, Update Config' },
        target: { type: 'string', description: 'e.g. user@example.com, production database' },
        warning: { type: 'string', description: 'Optional warning to show reviewer' },
      },
    },
    idempotency_key: {
      type: 'string',
      description: 'Unique key for safe retries',
    },
    metadata: {
      type: 'object',
      description: 'Arbitrary metadata (trace_id, context, etc.)',
    },
  },
};

interface CreateTaskInput {
  summary: string;
  blocks: Array<{
    type: 'markdown' | 'plaintext' | 'json';
    content: string;
    editable?: boolean;
  }>;
  priority?: string;
  risk_level?: string;
  execution_intent?: {
    action_type?: string;
    target?: string;
    warning?: string;
  };
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

export function createTaskTool(client: HiltApiClient, sourceId: string) {
  return {
    name: 'hilt_create_task',
    description:
      'Submit a proposed action for human review. The human reviewer ' +
      'will see the content blocks, can edit them, and will approve or deny. ' +
      'Returns the task ID — use hilt_poll_decision to wait for the result.',
    inputSchema,

    async execute(args: unknown) {
      const input = args as CreateTaskInput;

      const task = await client.createTask(
        {
          source_id: sourceId,
          title: input.summary,
          service: { id: 'mcp-agent', name: 'MCP Agent' },
          action: { type: 'create', verb: input.summary.slice(0, 50) },
          risk_level: input.risk_level || 'medium',
          priority: input.priority || 'NORMAL',
          blocks: input.blocks.map((b, i): ArtifactBlock => ({
            id: `block-${i}`,
            type: b.type as BlockType,
            content: b.type === 'json' ? tryParseJson(b.content) : b.content,
            editable: b.editable ?? true,
          })),
          execution_intent: input.execution_intent
            ? { kind: 'custom', display: input.execution_intent }
            : undefined,
          metadata: { ...input.metadata, mcp_summary: input.summary },
        },
        input.idempotency_key
      );

      return {
        task_id: task.id,
        status: task.status,
        created_at: task.created_at,
      };
    },
  };
}

function tryParseJson(s: string): string | Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return s;
  }
}
