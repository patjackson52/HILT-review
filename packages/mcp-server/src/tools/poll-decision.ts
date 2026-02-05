import { HiltApiClient } from '../api-client.js';

const inputSchema = {
  type: 'object' as const,
  required: ['task_id'],
  properties: {
    task_id: {
      type: 'string',
      description: 'Task ID returned from hilt_create_task',
    },
    timeout_seconds: {
      type: 'integer',
      default: 300,
      description: 'Max seconds to wait (default 5 min, max 1 hour)',
    },
  },
};

export function pollDecisionTool(client: HiltApiClient) {
  return {
    name: 'hilt_poll_decision',
    description:
      'Wait for the human reviewer to approve or deny a task. ' +
      'Blocks until a decision is made or timeout. Returns the decision ' +
      'and final (possibly edited) content.',
    inputSchema,

    async execute(args: unknown) {
      const { task_id, timeout_seconds } = args as {
        task_id: string;
        timeout_seconds?: number;
      };

      const timeout = Math.min(timeout_seconds ?? 300, 3600);
      const task = await client.pollForDecision(task_id, timeout);

      if (task.status === 'PENDING') {
        return {
          status: 'PENDING',
          message: 'Decision not yet made. Task is still pending review.',
        };
      }

      return {
        status: task.status,
        decision: task.decision,
        blocks_final: task.blocks_final,
        has_changes: task.diff !== undefined,
      };
    },
  };
}
