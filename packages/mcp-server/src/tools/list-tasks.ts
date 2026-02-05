import { HiltApiClient } from '../api-client.js';

const inputSchema = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string',
      enum: ['PENDING', 'APPROVED', 'DENIED', 'DISPATCHED', 'ARCHIVED'],
      description: 'Filter by task status',
    },
    limit: {
      type: 'integer',
      default: 20,
      maximum: 100,
      description: 'Maximum number of tasks to return',
    },
  },
};

export function listTasksTool(client: HiltApiClient, sourceId: string) {
  return {
    name: 'hilt_list_tasks',
    description:
      'List review tasks for this agent. Filter by status to see pending, approved, or denied tasks.',
    inputSchema,

    async execute(args: unknown) {
      const { status, limit } = args as { status?: string; limit?: number };
      const result = await client.listTasks(sourceId, status, limit ?? 20);

      return {
        tasks: result.items.map(t => ({
          task_id: t.id,
          status: t.status,
          title: t.title,
          preview: t.preview,
          created_at: t.created_at,
        })),
        total_count: result.total_count,
      };
    },
  };
}
