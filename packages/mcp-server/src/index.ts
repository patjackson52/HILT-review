#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const config = {
    apiUrl: process.env.HILT_API_URL || 'http://localhost:3000',
    apiKey: process.env.HILT_API_KEY!,
    sourceId: process.env.HILT_SOURCE_ID!,
  };

  if (!config.apiKey) {
    console.error('Error: HILT_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!config.sourceId) {
    console.error('Error: HILT_SOURCE_ID environment variable is required');
    process.exit(1);
  }

  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
