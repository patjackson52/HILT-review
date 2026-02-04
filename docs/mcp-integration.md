# MCP Integration for HILT-Review

This document covers integrating HILT-Review with the Model Context Protocol (MCP), enabling AI agents to propose tasks directly through a standardized tool interface.

---

## 1. Overview

### What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open protocol that enables AI assistants to connect to external tools and data sources. Instead of agents making raw HTTP calls, MCP provides:

- **Standardized tool discovery** - Agents can discover available tools programmatically
- **Type-safe schemas** - Tool inputs/outputs are well-defined with JSON Schema
- **Transport flexibility** - Works over stdio, HTTP/SSE, or WebSocket
- **Built-in authentication** - Consistent auth patterns across tools

### Why MCP for HILT-Review?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Without MCP                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AI Agent ──HTTP──▶ HILT-Review API                                     │
│                                                                          │
│  - Agent must know API structure                                        │
│  - Custom HTTP client code needed                                       │
│  - No standardized discovery                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        With MCP                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AI Agent ──MCP──▶ HILT-Review MCP Server ──HTTP──▶ HILT-Review API    │
│                                                                          │
│  - Agent discovers tools automatically                                  │
│  - Standard tool calling interface                                      │
│  - Works with any MCP-compatible agent (Claude, etc.)                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- Agents using Claude Code, Cursor, or other MCP hosts can use HILT-Review without custom integration
- Tool definitions are discoverable - agents see what operations are available
- Consistent error handling and retry semantics
- Easier adoption for agent developers

---

## 2. Architecture

### MCP Server as API Wrapper

The MCP server is a thin wrapper around the existing REST API:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HILT-Review System                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   MCP Host   │     │  HILT-Review     │     │   HILT-Review    │    │
│  │  (Claude,    │────▶│  MCP Server      │────▶│   REST API       │    │
│  │   Cursor)    │     │  (stdio/HTTP)    │     │   (Fastify)      │    │
│  └──────────────┘     └──────────────────┘     └──────────────────┘    │
│         │                      │                        │               │
│         │                      │                        ▼               │
│         │                      │               ┌──────────────────┐    │
│         │                      │               │    PostgreSQL    │    │
│         │                      │               │    + pg-boss     │    │
│         │                      │               └──────────────────┘    │
│         │                      │                                        │
│         ▼                      ▼                                        │
│  ┌─────────────────────────────────────────────────────┐               │
│  │               Configuration                          │               │
│  │  - API Key (stored in MCP config)                   │               │
│  │  - API URL (https://api.hilt-review.com)            │               │
│  │  - Source ID (agent's assigned source)              │               │
│  └─────────────────────────────────────────────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── mcp-server/                    # MCP server package (publishable)
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── server.ts             # MCP server setup
│   │   ├── tools/                # Tool implementations
│   │   │   ├── create-task.ts
│   │   │   ├── get-task.ts
│   │   │   ├── list-tasks.ts
│   │   │   └── poll-decision.ts
│   │   ├── api-client.ts         # HILT-Review API client
│   │   └── schemas.ts            # Shared Zod schemas
│   ├── package.json
│   └── README.md
```

---

## 3. MCP Tools

### Tool Definitions

The MCP server exposes these tools to agents:

| Tool | Purpose | Agent Use Case |
|------|---------|----------------|
| `hilt_create_task` | Submit a task for human review | Agent proposes an action |
| `hilt_get_task` | Get task details and status | Check if task was approved |
| `hilt_list_tasks` | List tasks by source/status | View pending/completed tasks |
| `hilt_poll_decision` | Wait for decision (long-poll) | Block until human decides |

### Tool: `hilt_create_task`

Submit a proposed action for human review.

```typescript
// Tool definition
{
  name: "hilt_create_task",
  description: `Submit a proposed action for human review. The human reviewer
    will see the content blocks, can edit them, and will approve or deny.
    Returns the task ID - use hilt_poll_decision to wait for the result.`,
  inputSchema: {
    type: "object",
    required: ["summary", "blocks"],
    properties: {
      summary: {
        type: "string",
        description: "Short description of what this action will do (max 200 chars)"
      },
      blocks: {
        type: "array",
        description: "Content blocks for reviewer to see/edit",
        items: {
          type: "object",
          required: ["type", "content"],
          properties: {
            type: {
              type: "string",
              enum: ["markdown", "plaintext", "json"],
              description: "Content type"
            },
            content: {
              type: "string",
              description: "Block content"
            },
            editable: {
              type: "boolean",
              default: true,
              description: "Whether reviewer can edit this block"
            }
          }
        }
      },
      priority: {
        type: "string",
        enum: ["LOW", "NORMAL", "HIGH"],
        default: "NORMAL"
      },
      execution_intent: {
        type: "object",
        description: "What will happen if approved (shown to reviewer)",
        properties: {
          action_type: {
            type: "string",
            description: "e.g., 'Send Email', 'Update Config', 'Run Command'"
          },
          target: {
            type: "string",
            description: "e.g., 'user@example.com', 'production database'"
          },
          warning: {
            type: "string",
            description: "Optional warning to show reviewer"
          }
        }
      },
      idempotency_key: {
        type: "string",
        description: "Unique key for safe retries"
      },
      metadata: {
        type: "object",
        description: "Arbitrary metadata (trace_id, context, etc.)"
      }
    }
  }
}

// Example invocation
{
  summary: "Send onboarding email to new user",
  blocks: [
    {
      type: "markdown",
      content: "# Welcome Email\n\nDear John,\n\nWelcome to our platform...",
      editable: true
    },
    {
      type: "json",
      content: JSON.stringify({
        to: "john@example.com",
        template: "onboarding-v2",
        variables: { name: "John" }
      }),
      editable: true
    }
  ],
  priority: "NORMAL",
  execution_intent: {
    action_type: "Send Email",
    target: "john@example.com"
  },
  idempotency_key: "email-john-onboarding-2024-01-15"
}

// Response
{
  task_id: "550e8400-e29b-41d4-a716-446655440000",
  status: "PENDING",
  created_at: "2024-01-15T10:30:00Z"
}
```

### Tool: `hilt_poll_decision`

Wait for human decision (long-polling).

```typescript
// Tool definition
{
  name: "hilt_poll_decision",
  description: `Wait for the human reviewer to approve or deny a task.
    Blocks until decision is made or timeout. Returns the decision
    and final (possibly edited) content.`,
  inputSchema: {
    type: "object",
    required: ["task_id"],
    properties: {
      task_id: {
        type: "string",
        description: "Task ID returned from hilt_create_task"
      },
      timeout_seconds: {
        type: "integer",
        default: 300,
        description: "Max seconds to wait (default 5 min, max 1 hour)"
      }
    }
  }
}

// Example invocation
{
  task_id: "550e8400-e29b-41d4-a716-446655440000",
  timeout_seconds: 600
}

// Response (approved)
{
  status: "APPROVED",
  decision: {
    type: "APPROVE",
    decided_at: "2024-01-15T10:35:00Z",
    decided_by: "reviewer@company.com"
  },
  blocks_final: [
    {
      type: "markdown",
      content: "# Welcome Email\n\nDear John,\n\nWelcome to our platform! [edited by reviewer]..."
    },
    {
      type: "json",
      content: "{\"to\":\"john@example.com\",...}"
    }
  ],
  has_changes: true
}

// Response (denied)
{
  status: "DENIED",
  decision: {
    type: "DENY",
    reason: "Wrong email template for this customer segment",
    decided_at: "2024-01-15T10:35:00Z"
  }
}

// Response (timeout)
{
  status: "PENDING",
  message: "Decision not yet made. Task is still pending review."
}
```

### Tool: `hilt_get_task`

Get current task status and details.

```typescript
{
  name: "hilt_get_task",
  description: "Get the current status and details of a review task.",
  inputSchema: {
    type: "object",
    required: ["task_id"],
    properties: {
      task_id: {
        type: "string",
        description: "Task ID to retrieve"
      }
    }
  }
}
```

### Tool: `hilt_list_tasks`

List tasks for the agent's source.

```typescript
{
  name: "hilt_list_tasks",
  description: "List review tasks. Filter by status to see pending, approved, or denied tasks.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["PENDING", "APPROVED", "DENIED"],
        description: "Filter by status"
      },
      limit: {
        type: "integer",
        default: 20,
        maximum: 100
      }
    }
  }
}
```

---

## 4. MCP Server Implementation

### Server Setup (TypeScript)

```typescript
// packages/mcp-server/src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HiltApiClient } from "./api-client.js";
import { createTaskTool } from "./tools/create-task.js";
import { pollDecisionTool } from "./tools/poll-decision.js";
import { getTaskTool } from "./tools/get-task.js";
import { listTasksTool } from "./tools/list-tasks.js";

export function createServer(config: {
  apiUrl: string;
  apiKey: string;
  sourceId: string;
}) {
  const client = new HiltApiClient(config);

  const server = new Server(
    {
      name: "hilt-review",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  const tools = [
    createTaskTool(client, config.sourceId),
    pollDecisionTool(client),
    getTaskTool(client),
    listTasksTool(client, config.sourceId),
  ];

  // Handle list_tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // Handle call_tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const result = await tool.execute(request.params.arguments);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}

// Entry point
async function main() {
  const config = {
    apiUrl: process.env.HILT_API_URL || "https://api.hilt-review.com",
    apiKey: process.env.HILT_API_KEY!,
    sourceId: process.env.HILT_SOURCE_ID!,
  };

  if (!config.apiKey || !config.sourceId) {
    console.error("HILT_API_KEY and HILT_SOURCE_ID environment variables required");
    process.exit(1);
  }

  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### API Client

```typescript
// packages/mcp-server/src/api-client.ts
import { z } from "zod";

export class HiltApiClient {
  constructor(private config: {
    apiUrl: string;
    apiKey: string;
  }) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `API error ${response.status}: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  async createTask(params: CreateTaskParams): Promise<ReviewTask> {
    return this.request("POST", "/review-tasks", params, {
      "Idempotency-Key": params.idempotency_key || crypto.randomUUID(),
    });
  }

  async getTask(taskId: string): Promise<ReviewTask> {
    return this.request("GET", `/review-tasks/${taskId}`);
  }

  async listTasks(sourceId: string, status?: string, limit = 20): Promise<TaskListResponse> {
    const params = new URLSearchParams({
      source_id: sourceId,
      limit: String(limit),
    });
    if (status) params.set("status", status);

    return this.request("GET", `/review-tasks?${params}`);
  }

  async pollForDecision(
    taskId: string,
    timeoutSeconds: number
  ): Promise<ReviewTask> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    const pollInterval = 2000; // 2 seconds

    while (Date.now() < deadline) {
      const task = await this.getTask(taskId);

      if (task.status !== "PENDING") {
        return task;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Return current state on timeout
    return this.getTask(taskId);
  }
}
```

### Create Task Tool

```typescript
// packages/mcp-server/src/tools/create-task.ts
import { z } from "zod";
import { HiltApiClient } from "../api-client.js";

const inputSchema = {
  type: "object" as const,
  required: ["summary", "blocks"],
  properties: {
    summary: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "content"],
        properties: {
          type: { type: "string", enum: ["markdown", "plaintext", "json"] },
          content: { type: "string" },
          editable: { type: "boolean", default: true },
        },
      },
    },
    priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH"], default: "NORMAL" },
    execution_intent: {
      type: "object",
      properties: {
        action_type: { type: "string" },
        target: { type: "string" },
        warning: { type: "string" },
      },
    },
    idempotency_key: { type: "string" },
    metadata: { type: "object" },
  },
};

export function createTaskTool(client: HiltApiClient, sourceId: string) {
  return {
    name: "hilt_create_task",
    description: `Submit a proposed action for human review. The human reviewer
      will see the content blocks, can edit them, and will approve or deny.
      Returns the task ID - use hilt_poll_decision to wait for the result.`,
    inputSchema,

    async execute(args: unknown) {
      const input = args as z.infer<typeof InputSchema>;

      // Map to API format
      const task = await client.createTask({
        source_id: sourceId,
        priority: input.priority || "NORMAL",
        blocks: input.blocks.map((b, i) => ({
          id: `block-${i}`,
          type: b.type,
          content: b.content,
          editable: b.editable ?? true,
        })),
        metadata: {
          ...input.metadata,
          summary: input.summary,
        },
        execution_intent: input.execution_intent ? {
          kind: "custom",
          display: input.execution_intent,
        } : undefined,
        idempotency_key: input.idempotency_key,
      });

      return {
        task_id: task.id,
        status: task.status,
        created_at: task.created_at,
      };
    },
  };
}
```

---

## 5. Installation & Configuration

### For Agents Using Claude Code / Claude Desktop

Add to `~/.claude/claude_desktop_config.json` (Claude Desktop) or MCP settings:

```json
{
  "mcpServers": {
    "hilt-review": {
      "command": "npx",
      "args": ["-y", "@hilt-review/mcp-server"],
      "env": {
        "HILT_API_URL": "https://api.hilt-review.com",
        "HILT_API_KEY": "hilt_live_key_xxxxxxxxxxxx",
        "HILT_SOURCE_ID": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

### For Agents Using Cursor

Add to Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "servers": {
    "hilt-review": {
      "command": "npx",
      "args": ["-y", "@hilt-review/mcp-server"],
      "env": {
        "HILT_API_URL": "https://api.hilt-review.com",
        "HILT_API_KEY": "hilt_live_key_xxxxxxxxxxxx",
        "HILT_SOURCE_ID": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

### For Custom Agents (HTTP Transport)

Run the MCP server with HTTP/SSE transport:

```bash
# Install globally
npm install -g @hilt-review/mcp-server

# Run with HTTP transport
HILT_API_KEY=xxx HILT_SOURCE_ID=xxx hilt-mcp-server --transport http --port 3100
```

Then connect from your agent:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const client = new Client({ name: "my-agent", version: "1.0.0" }, {});
const transport = new SSEClientTransport(new URL("http://localhost:3100/sse"));
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Create a task
const result = await client.callTool({
  name: "hilt_create_task",
  arguments: {
    summary: "Send notification",
    blocks: [{ type: "plaintext", content: "Hello world" }],
  },
});
```

---

## 6. Discovery & Documentation

### Tool Discovery

Agents discover tools via MCP's `list_tools` method. The server returns:

```json
{
  "tools": [
    {
      "name": "hilt_create_task",
      "description": "Submit a proposed action for human review...",
      "inputSchema": { ... }
    },
    {
      "name": "hilt_poll_decision",
      "description": "Wait for the human reviewer to approve or deny...",
      "inputSchema": { ... }
    },
    ...
  ]
}
```

### OpenAPI Integration

The MCP server tools map directly to OpenAPI endpoints:

| MCP Tool | OpenAPI Operation | Endpoint |
|----------|-------------------|----------|
| `hilt_create_task` | `createReviewTask` | `POST /review-tasks` |
| `hilt_get_task` | `getReviewTask` | `GET /review-tasks/{id}` |
| `hilt_list_tasks` | `listReviewTasks` | `GET /review-tasks` |
| `hilt_poll_decision` | `getReviewTask` (polling) | `GET /review-tasks/{id}` |

### NPM Package Documentation

The `@hilt-review/mcp-server` package includes:

```
README.md           # Setup instructions
docs/
  tools.md          # Detailed tool documentation
  examples.md       # Usage examples
  troubleshooting.md
```

---

## 7. Security Considerations

### API Key Management

```typescript
// MCP config stores credentials - ensure proper file permissions
// ~/.claude/claude_desktop_config.json should be readable only by owner

// For production agents, use environment variables or secret managers:
{
  "env": {
    "HILT_API_KEY": "${HILT_API_KEY}",  // From environment
  }
}
```

### Source Isolation

Each agent should have its own Source ID:

```
Agent A (email-bot)     → Source: src_email_bot_xxx
Agent B (deploy-bot)    → Source: src_deploy_bot_xxx
Agent C (data-pipeline) → Source: src_data_pipeline_xxx
```

This ensures:
- Tasks are grouped by agent
- API keys are scoped to specific sources
- Webhook delivery goes to the right executor

### Rate Limiting

MCP tools inherit the API's rate limits:

| Tool | Maps To | Limit |
|------|---------|-------|
| `hilt_create_task` | Task Creation | 100/min |
| `hilt_get_task` | Task Reads | 1000/min |
| `hilt_list_tasks` | Task Reads | 1000/min |
| `hilt_poll_decision` | Task Reads | 1000/min |

The MCP server should handle rate limit errors gracefully:

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After");
  throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
}
```

---

## 8. Architecture Impact Assessment

### Does MCP Require API Changes?

**No.** The existing REST API is sufficient. MCP is an additional interface layer.

| Concern | Impact | Notes |
|---------|--------|-------|
| API Endpoints | None | MCP wraps existing endpoints |
| Data Model | None | No schema changes needed |
| Authentication | None | Uses existing API keys |
| Database | None | No changes required |
| Webhooks | None | Decision delivery unchanged |

### Recommended API Additions (Optional)

These would enhance the MCP experience but aren't required:

1. **WebSocket for real-time decision updates**
   ```
   GET /review-tasks/{id}/subscribe
   ```
   Would enable true push notifications instead of polling.

2. **Batch task creation**
   ```
   POST /review-tasks/batch
   ```
   For agents that need to submit multiple tasks atomically.

3. **Task cancellation**
   ```
   DELETE /review-tasks/{id}
   ```
   Allow agents to cancel pending tasks.

### Package Architecture

```
hilt-review/
├── backend/                    # Existing backend (unchanged)
├── frontend/                   # Existing frontend (unchanged)
├── packages/
│   └── mcp-server/            # New MCP server package
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
└── package.json               # Workspace root
```

### Deployment

The MCP server runs **client-side** (with the agent), not as a hosted service:

```
┌──────────────────────────────────────┐
│        Agent's Machine               │
│  ┌─────────┐    ┌─────────────────┐ │
│  │ Claude  │───▶│ HILT MCP Server │ │
│  │ Desktop │    │ (local process) │ │
│  └─────────┘    └────────┬────────┘ │
└──────────────────────────┼──────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────┐
│        HILT-Review Cloud             │
│  ┌─────────────────────────────────┐ │
│  │      HILT-Review API            │ │
│  │  (api.hilt-review.com)          │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 9. MCP Server Deployment Options & Costs

There are **three deployment strategies** for the MCP server, each with different cost and operational characteristics.

### Option A: Client-Side MCP (stdio) — Recommended for Most Users

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Agent's Local Machine                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     stdio      ┌──────────────────┐                   │
│  │ Claude Code  │ ◀────────────▶ │ @hilt-review/    │                   │
│  │ / Desktop    │                │ mcp-server       │                   │
│  └──────────────┘                │ (npx process)    │                   │
│                                  └────────┬─────────┘                   │
│                                           │                              │
└───────────────────────────────────────────┼──────────────────────────────┘
                                            │ HTTPS
                                            ▼
                              ┌──────────────────────────┐
                              │  HILT-Review REST API    │
                              │  (existing deployment)   │
                              └──────────────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Additional Hosting Cost** | **$0** |
| **Uptime** | Depends on agent's machine |
| **Scaling** | Each agent runs own instance |
| **Setup** | User adds to MCP config |
| **Maintenance** | NPM package updates |

**How it works:**
- Agent host (Claude Desktop, Cursor) spawns MCP server as child process
- Communication via stdio (stdin/stdout)
- MCP server makes HTTPS calls to HILT-Review API
- No server to host or maintain

**Best for:** Individual developers, small teams, Claude Desktop/Cursor users

---

### Option B: Integrated MCP Endpoints (HTTP/SSE) — Recommended for Low-Cost Hosting

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Existing HILT-Review Backend                         │
│                        (Railway / Render)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Fastify Backend                               │    │
│  │                                                                  │    │
│  │  /review-tasks      ← REST API (existing)                       │    │
│  │  /sources           ← REST API (existing)                       │    │
│  │  /mcp/sse           ← MCP HTTP/SSE endpoint (new)               │    │
│  │  /mcp/messages      ← MCP message handler (new)                 │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Additional Hosting Cost** | **$0** (uses existing backend) |
| **Uptime** | Same as REST API (~99.9% on Railway/Render) |
| **Scaling** | Scales with existing backend |
| **Setup** | Point MCP client to hosted URL |
| **Maintenance** | Part of normal backend deploys |

**Implementation:**

```typescript
// backend/src/routes/mcp.ts
import { FastifyInstance } from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export async function mcpRoutes(app: FastifyInstance) {
  const mcpServer = createMcpServer(app);

  // SSE endpoint for MCP clients
  app.get('/mcp/sse', async (request, reply) => {
    // Authenticate via API key in query or header
    const apiKey = request.headers['x-api-key'] as string;
    const source = await authenticateApiKey(apiKey);
    if (!source) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // Handle MCP protocol over SSE
    const transport = new SSEServerTransport('/mcp/messages', reply.raw);
    await mcpServer.connect(transport);
  });

  // Message endpoint for MCP requests
  app.post('/mcp/messages', async (request, reply) => {
    // Route MCP messages to server
    return mcpServer.handleMessage(request.body);
  });
}
```

**Agent configuration:**

```json
{
  "mcpServers": {
    "hilt-review": {
      "transport": "sse",
      "url": "https://api.hilt-review.com/mcp/sse",
      "headers": {
        "X-API-Key": "hilt_live_key_xxx"
      }
    }
  }
}
```

**Best for:** Teams wanting centralized MCP without additional infrastructure

---

### Option C: Dedicated MCP Service — For High-Volume / Enterprise

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Dedicated MCP Service                             │
│                     (Separate Railway/Render app)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              MCP Gateway Service                                 │    │
│  │                                                                  │    │
│  │  - WebSocket support for persistent connections                 │    │
│  │  - Connection pooling to backend API                            │    │
│  │  - Per-agent rate limiting                                      │    │
│  │  - Metrics and observability                                    │    │
│  │  - Horizontal scaling                                           │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │ Internal network
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     HILT-Review Backend                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Additional Hosting Cost** | **$5-20/month** (Railway/Render instance) |
| **Uptime** | ~99.9% (same as platform) |
| **Scaling** | Independent scaling from API |
| **Setup** | Deploy separate service |
| **Maintenance** | Additional deployment pipeline |

**Best for:** High-volume agent traffic, enterprise deployments, strict isolation requirements

---

### Cost Comparison

| Option | Hosting Cost | Use Case | Uptime |
|--------|-------------|----------|--------|
| **A: Client-side (stdio)** | $0 | Individual devs, Claude Desktop | Agent-dependent |
| **B: Integrated (HTTP/SSE)** | $0 | Teams, centralized | ~99.9% |
| **C: Dedicated service** | $5-20/mo | Enterprise, high-volume | ~99.9% |

### Traffic Estimates (Option B - Integrated)

Option B adds minimal load to the existing backend:

| Traffic Level | Agents | Tasks/day | API Calls/day | Backend Impact |
|---------------|--------|-----------|---------------|----------------|
| Low | 1-5 | 10-50 | ~500 | Negligible |
| Medium | 5-20 | 50-500 | ~5,000 | <5% capacity |
| High | 20-100 | 500-5,000 | ~50,000 | 10-20% capacity |

**Recommendation:** Start with **Option B** (integrated). It's free and sufficient for most use cases. Only move to Option C if you have 100+ concurrent agents or need dedicated scaling.

---

### Option B Implementation Guide

#### 1. Add MCP Dependencies

```bash
npm install @modelcontextprotocol/sdk --workspace=backend
```

#### 2. Create MCP Routes

```typescript
// backend/src/routes/mcp/index.ts
import { FastifyInstance } from 'fastify';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createHiltMcpServer } from './server.js';

export async function registerMcpRoutes(app: FastifyInstance) {
  // Store active transports for cleanup
  const transports = new Map<string, SSEServerTransport>();

  app.get('/mcp/sse', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          source_id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;

    // Validate API key and get source
    const source = await app.services.auth.validateApiKey(apiKey);
    if (!source) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    // Create MCP server with source context
    const mcpServer = createHiltMcpServer({
      sourceId: source.id,
      services: app.services,
    });

    // Setup SSE transport
    const transport = new SSEServerTransport('/mcp/messages', reply.raw);
    transports.set(source.id, transport);

    request.raw.on('close', () => {
      transports.delete(source.id);
      transport.close();
    });

    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const source = await app.services.auth.validateApiKey(apiKey);

    if (!source) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    const transport = transports.get(source.id);
    if (!transport) {
      return reply.code(400).send({ error: 'No active SSE connection' });
    }

    await transport.handlePostMessage(request, reply);
  });
}
```

#### 3. MCP Server Implementation

```typescript
// backend/src/routes/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

interface McpServerConfig {
  sourceId: string;
  services: AppServices;
}

export function createHiltMcpServer(config: McpServerConfig) {
  const server = new Server(
    { name: 'hilt-review', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Tool definitions
  const tools = [
    {
      name: 'hilt_create_task',
      description: 'Submit a proposed action for human review',
      inputSchema: { /* ... */ },
      execute: async (args: any) => {
        const task = await config.services.tasks.create({
          source_id: config.sourceId,
          ...args,
        });
        return { task_id: task.id, status: task.status };
      },
    },
    // ... other tools
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
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);

    const result = await tool.execute(request.params.arguments);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}
```

#### 4. Health Check

```typescript
// Add to existing health routes
app.get('/mcp/health', async () => {
  return {
    status: 'ok',
    transport: 'sse',
    version: '1.0.0',
  };
});
```

---

### Uptime Guarantees

| Component | Platform | SLA | Notes |
|-----------|----------|-----|-------|
| Backend API | Railway | 99.9% | Auto-restarts on crash |
| Backend API | Render | 99.9% | Free tier has cold starts |
| MCP (Option B) | Same | Same | Shares backend uptime |
| Database | Neon | 99.95% | Serverless, auto-scaling |

**For production workloads:**
- Railway paid tier: $5/mo base + usage
- Render paid tier: $7/mo
- Both provide zero-downtime deploys

---

### Monitoring MCP Endpoints

```typescript
// Add metrics for MCP usage
app.addHook('onResponse', (request, reply, done) => {
  if (request.url.startsWith('/mcp/')) {
    metrics.increment('mcp.requests', {
      method: request.method,
      path: request.url,
      status: reply.statusCode,
    });
  }
  done();
});
```

---

## 10. Example Agent Workflow

### Email Approval Agent

```typescript
// Agent code (using Claude or similar)
async function sendEmailWithApproval(to: string, subject: string, body: string) {
  // 1. Create task for human review
  const createResult = await mcp.callTool({
    name: "hilt_create_task",
    arguments: {
      summary: `Send email to ${to}: ${subject}`,
      blocks: [
        {
          type: "markdown",
          content: `# Email to ${to}\n\n**Subject:** ${subject}\n\n---\n\n${body}`,
          editable: true,
        },
        {
          type: "json",
          content: JSON.stringify({ to, subject, body }, null, 2),
          editable: true,
        },
      ],
      priority: "NORMAL",
      execution_intent: {
        action_type: "Send Email",
        target: to,
      },
      idempotency_key: `email-${to}-${Date.now()}`,
    },
  });

  const { task_id } = JSON.parse(createResult.content[0].text);

  // 2. Wait for human decision
  const decisionResult = await mcp.callTool({
    name: "hilt_poll_decision",
    arguments: {
      task_id,
      timeout_seconds: 3600, // 1 hour
    },
  });

  const decision = JSON.parse(decisionResult.content[0].text);

  // 3. Act on decision
  if (decision.status === "APPROVED") {
    // Get possibly-edited content
    const emailBlock = decision.blocks_final.find(b => b.type === "json");
    const emailData = JSON.parse(emailBlock.content);

    // Actually send the email
    await sendEmail(emailData);
    return { sent: true, edited: decision.has_changes };
  } else if (decision.status === "DENIED") {
    return { sent: false, reason: decision.decision.reason };
  } else {
    return { sent: false, reason: "Timeout - no decision made" };
  }
}
```

---

## 11. Summary

| Question | Answer |
|----------|--------|
| **What is MCP?** | Open protocol for AI tools, standardizes discovery and invocation |
| **Why use it?** | Agents can discover and use HILT-Review without custom HTTP code |
| **Architecture impact?** | Minimal - add `/mcp/*` routes to existing backend (Option B) |
| **API changes needed?** | None to REST API; add MCP routes for Option B |
| **Hosting cost?** | **$0** for Options A & B; $5-20/mo for Option C |
| **Uptime?** | ~99.9% (same as REST API) for Options B & C |
| **How do users install?** | Add to MCP config with API key and URL |
| **How is it discoverable?** | MCP `list_tools` returns available operations |
| **Recommended option?** | **Option B** (integrated) for teams; Option A for individuals |

### Deployment Options Summary

| Option | Description | Cost | Best For |
|--------|-------------|------|----------|
| **A** | Client-side NPM package (stdio) | $0 | Individual devs |
| **B** | Integrated into backend (HTTP/SSE) | $0 | Teams, production |
| **C** | Dedicated MCP service | $5-20/mo | Enterprise, high-volume |

### Files to Create/Modify

**For Option A (client-side):**
1. `packages/mcp-server/` - Standalone NPM package
2. Publish to NPM as `@hilt-review/mcp-server`

**For Option B (integrated - recommended):**
1. `backend/src/routes/mcp/index.ts` - MCP route handlers
2. `backend/src/routes/mcp/server.ts` - MCP server implementation
3. Add `@modelcontextprotocol/sdk` dependency

### No Changes Required To

- OpenAPI spec (REST API unchanged)
- Frontend
- Database schema
- Existing REST endpoints
