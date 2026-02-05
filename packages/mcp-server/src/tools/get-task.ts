import { HiltApiClient } from '../api-client.js';

const inputSchema = {
  type: 'object' as const,
  required: ['task_id'],
  properties: {
    task_id: {
      type: 'string',
      description: 'Task ID to retrieve',
    },
  },
};

export function getTaskTool(client: HiltApiClient) {
  return {
    name: 'hilt_get_task',
    description: 'Get the current status and details of a review task.',
    inputSchema,

    async execute(args: unknown) {
      const { task_id } = args as { task_id: string };
      const task = await client.getTask(task_id);

      return {
        task_id: task.id,
        status: task.status,
        title: task.title,
        blocks_final: task.blocks_final,
        decision: task.decision,
        has_changes: task.diff !== undefined,
        created_at: task.created_at,
        updated_at: task.updated_at,
      };
    },
  };
}
