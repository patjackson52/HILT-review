import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HiltApiClient } from './api-client.js';
import { createTaskTool } from './tools/create-task.js';
import { getTaskTool } from './tools/get-task.js';
import { listTasksTool } from './tools/list-tasks.js';
import { pollDecisionTool } from './tools/poll-decision.js';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: unknown): Promise<unknown>;
}

export function createServer(config: {
  apiUrl: string;
  apiKey: string;
  sourceId: string;
}) {
  const client = new HiltApiClient(config);

  const server = new Server(
    { name: 'hilt-review', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const tools: ToolDef[] = [
    createTaskTool(client, config.sourceId),
    pollDecisionTool(client),
    getTaskTool(client),
    listTasksTool(client, config.sourceId),
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      const result = await tool.execute(request.params.arguments ?? {});
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  return server;
}
