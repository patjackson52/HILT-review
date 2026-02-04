# HILT-Review Backend Specification

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Language** | TypeScript | 5.x | Type safety, IDE support |
| **Framework** | Fastify | 4.x | Fast HTTP server, schema validation |
| **Database** | PostgreSQL | 15+ | Primary data store |
| **DB Client** | Drizzle ORM | latest | Type-safe queries, migrations |
| **Queue** | pg-boss | 9.x | Background jobs (Postgres-backed) |
| **Validation** | Zod | 3.x | Runtime validation, OpenAPI alignment |
| **Auth** | @fastify/oauth2 | latest | Google OAuth integration |
| **Session** | @fastify/session | latest | Server-side sessions |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── app.ts                   # Fastify app configuration
│   ├── config/
│   │   ├── index.ts             # Environment configuration
│   │   └── constants.ts         # Application constants
│   │
│   ├── routes/
│   │   ├── index.ts             # Route registration
│   │   ├── sources.ts           # /sources endpoints
│   │   ├── review-tasks.ts      # /review-tasks endpoints
│   │   ├── decision-events.ts   # /sources/:id/decision-events
│   │   └── auth.ts              # /auth endpoints
│   │
│   ├── services/
│   │   ├── review-task.service.ts
│   │   ├── source.service.ts
│   │   ├── decision.service.ts
│   │   ├── diff.service.ts      # Text/JSON diffing
│   │   └── webhook.service.ts   # Webhook delivery
│   │
│   ├── domain/
│   │   ├── types.ts             # Core domain types
│   │   ├── errors.ts            # Custom error classes
│   │   └── schemas.ts           # Zod schemas (aligned with OpenAPI)
│   │
│   ├── db/
│   │   ├── index.ts             # Database connection
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   └── queries/
│   │       ├── review-tasks.ts
│   │       ├── sources.ts
│   │       └── decision-events.ts
│   │
│   ├── workers/
│   │   ├── index.ts             # Worker registration
│   │   ├── decision-dispatcher.ts  # Webhook delivery worker
│   │   └── archiver.ts          # 7-day archive worker
│   │
│   ├── middleware/
│   │   ├── auth.ts              # API key & session auth
│   │   ├── rate-limit.ts        # Rate limiting
│   │   └── error-handler.ts     # Global error handling
│   │
│   └── utils/
│       ├── crypto.ts            # HMAC, hashing utilities
│       ├── idempotency.ts       # Idempotency key handling
│       └── pagination.ts        # Cursor pagination helpers
│
├── drizzle/
│   └── migrations/              # Database migrations
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── Dockerfile
```

---

## Core Dependencies

### package.json

```json
{
  "name": "hilt-review-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^4.26.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.0.0",
    "@fastify/oauth2": "^7.0.0",
    "@fastify/session": "^10.0.0",
    "@fastify/cookie": "^9.0.0",
    "@fastify/rate-limit": "^9.0.0",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "pg-boss": "^9.0.0",
    "zod": "^3.22.0",
    "diff": "^5.2.0",
    "fast-json-patch": "^3.1.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "drizzle-kit": "^0.20.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.2.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  }
}
```

---

## Application Configuration

### src/config/index.ts

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_REDIRECT_URI: z.string().url(),

  // Session
  SESSION_SECRET: z.string().min(32),

  // Optional: Domain restriction
  ALLOWED_DOMAINS: z.string().transform(s => JSON.parse(s)).pipe(z.array(z.string())).optional(),

  // CORS
  CORS_ORIGIN: z.string().url().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

---

## Fastify Application

### src/app.ts

```typescript
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import session from '@fastify/session';

import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { registerRoutes } from './routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Security
  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN || true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-api-key'] as string || req.ip,
  });

  // Session
  await app.register(cookie);
  await app.register(session, {
    secret: config.SESSION_SECRET,
    cookie: {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  });

  // Error handling
  app.setErrorHandler(errorHandler);

  // Routes
  await registerRoutes(app);

  return app;
}
```

---

## Domain Types

### src/domain/types.ts

```typescript
// Aligned with OpenAPI spec

export type Priority = 'LOW' | 'NORMAL' | 'HIGH';
export type ReviewTaskStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'DISPATCHED' | 'ARCHIVED';
export type DecisionType = 'APPROVE' | 'DENY';
export type BlockType = 'markdown' | 'plaintext' | 'json';
export type DeliveryMode = 'WEBHOOK_ONLY' | 'PULL_ONLY' | 'WEBHOOK_AND_PULL';

export interface ArtifactBlock {
  id: string;
  type: BlockType;
  content: string | Record<string, unknown>;
  editable: boolean;
  render_hints?: {
    preview?: boolean;
    syntax_highlighting?: boolean;
  };
}

export interface ReviewTask {
  id: string;
  source_id: string;
  status: ReviewTaskStatus;
  priority: Priority;
  interaction_schema?: InteractionSchema;
  blocks_original: ArtifactBlock[];
  blocks_working: ArtifactBlock[];
  blocks_final?: ArtifactBlock[];
  diff?: DecisionDiff;
  decision?: ReviewDecision;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  archived_at?: Date;
}

export interface ReviewDecision {
  type: DecisionType;
  reason?: string;
  decided_at: Date;
  decided_by?: string;
}

export interface DecisionEvent {
  event_id: string;
  source_id: string;
  task_id: string;
  decision: ReviewDecision;
  original: ArtifactBlock[];
  final: ArtifactBlock[];
  diff: DecisionDiff;
  metadata?: Record<string, unknown>;
  occurred_at: Date;
}

export interface InteractionSchema {
  type: 'edit' | 'confirm' | 'choice' | 'external';
  guidance?: Record<string, unknown>;
  options?: ChoiceOption[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  patches?: BlockPatch[];
}

export interface BlockPatch {
  block_id: string;
  op: 'replace';
  value: string | Record<string, unknown>;
}

export interface DecisionDiff {
  text_diffs?: TextDiff[];
  json_patches?: JsonPatch[];
}

export interface TextDiff {
  block_id: string;
  unified_diff: string;
}

export interface JsonPatch {
  block_id: string;
  patch: JsonPatchOperation[];
}

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  from?: string;
  value?: unknown;
}
```

---

## Database Schema (Drizzle)

### src/db/schema.ts

```typescript
import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const reviewTaskStatusEnum = pgEnum('review_task_status', [
  'PENDING', 'APPROVED', 'DENIED', 'DISPATCHED', 'ARCHIVED'
]);
export const priorityEnum = pgEnum('priority_level', ['LOW', 'NORMAL', 'HIGH']);
export const decisionTypeEnum = pgEnum('decision_type', ['APPROVE', 'DENY']);
export const deliveryModeEnum = pgEnum('delivery_mode', [
  'WEBHOOK_ONLY', 'PULL_ONLY', 'WEBHOOK_AND_PULL'
]);

// Tables
export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  deliveryMode: deliveryModeEnum('delivery_mode').notNull().default('WEBHOOK_AND_PULL'),
  webhookEnabled: boolean('webhook_enabled').notNull().default(true),
  webhookUrl: text('webhook_url'),
  webhookSecret: text('webhook_secret'),
  webhookTimeoutMs: integer('webhook_timeout_ms').default(5000),
  webhookMaxAttempts: integer('webhook_max_attempts').default(10),
  webhookRetryBackoffSeconds: integer('webhook_retry_backoff_seconds').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reviewTasks = pgTable('review_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id).notNull(),
  status: reviewTaskStatusEnum('status').notNull().default('PENDING'),
  priority: priorityEnum('priority').notNull().default('NORMAL'),
  interactionSchema: jsonb('interaction_schema'),
  blocksOriginal: jsonb('blocks_original').notNull(),
  blocksWorking: jsonb('blocks_working').notNull(),
  blocksFinal: jsonb('blocks_final'),
  diff: jsonb('diff'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  archivedAt: timestamp('archived_at'),
});

export const reviewDecisions = pgTable('review_decisions', {
  taskId: uuid('task_id').primaryKey().references(() => reviewTasks.id),
  decision: decisionTypeEnum('decision').notNull(),
  reason: text('reason'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at').defaultNow().notNull(),
});

export const decisionEvents = pgTable('decision_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => reviewTasks.id).notNull(),
  sourceId: uuid('source_id').references(() => sources.id).notNull(),
  decision: decisionTypeEnum('decision').notNull(),
  payload: jsonb('payload').notNull(),
  delivered: boolean('delivered').default(false),
  deliveryAttempts: integer('delivery_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id),
  keyPrefix: text('key_prefix').notNull().unique(),
  keyHash: text('key_hash').notNull(),
  keyType: text('key_type').notNull(), // 'source' | 'admin'
  environment: text('environment').notNull(), // 'live' | 'test'
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  revokedAt: timestamp('revoked_at'),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  pictureUrl: text('picture_url'),
  googleSub: text('google_sub').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});
```

---

## Route Example

### src/routes/review-tasks.ts

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reviewTaskService } from '../services/review-task.service';
import { CreateReviewTaskSchema, PatchBlocksSchema, SubmitDecisionSchema } from '../domain/schemas';
import { requireApiKey, requireSession } from '../middleware/auth';

export async function reviewTaskRoutes(app: FastifyInstance) {
  // POST /review-tasks - Create task (API key auth)
  app.post('/', {
    preHandler: requireApiKey,
    schema: {
      body: CreateReviewTaskSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    const task = await reviewTaskService.create(request.body, idempotencyKey);
    return reply.status(201).send(task);
  });

  // GET /review-tasks - List tasks (Session auth for reviewers)
  app.get('/', {
    preHandler: requireSession,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { source_id, status, limit, cursor } = request.query as any;
    const result = await reviewTaskService.list({ source_id, status, limit, cursor });
    return reply.send(result);
  });

  // GET /review-tasks/:id - Get task
  app.get('/:task_id', {
    preHandler: requireSession,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { task_id } = request.params as { task_id: string };
    const task = await reviewTaskService.getById(task_id);
    return reply.send(task);
  });

  // PATCH /review-tasks/:id/blocks - Update working blocks
  app.patch('/:task_id/blocks', {
    preHandler: requireSession,
    schema: {
      body: PatchBlocksSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { task_id } = request.params as { task_id: string };
    const etag = request.headers['if-match'] as string | undefined;
    const task = await reviewTaskService.updateBlocks(task_id, request.body, etag);
    return reply.send(task);
  });

  // POST /review-tasks/:id/decision - Submit decision
  app.post('/:task_id/decision', {
    preHandler: requireSession,
    schema: {
      body: SubmitDecisionSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { task_id } = request.params as { task_id: string };
    const userId = request.session.get('userId');
    const task = await reviewTaskService.submitDecision(task_id, request.body, userId);
    return reply.send(task);
  });
}
```

---

## Background Workers

### src/workers/decision-dispatcher.ts

```typescript
import PgBoss from 'pg-boss';
import { config } from '../config';
import { webhookService } from '../services/webhook.service';
import { db } from '../db';
import { decisionEvents, sources } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const DECISION_DISPATCH_QUEUE = 'decision-dispatch';

export async function setupDecisionDispatcher(boss: PgBoss) {
  await boss.work(DECISION_DISPATCH_QUEUE, async (job) => {
    const { eventId } = job.data as { eventId: string };

    // Fetch event and source
    const event = await db.query.decisionEvents.findFirst({
      where: eq(decisionEvents.id, eventId),
    });

    if (!event || event.delivered) return;

    const source = await db.query.sources.findFirst({
      where: eq(sources.id, event.sourceId),
    });

    if (!source?.webhookEnabled || !source.webhookUrl) return;

    // Attempt delivery
    const success = await webhookService.deliver(
      source.webhookUrl,
      source.webhookSecret!,
      event.payload,
      source.webhookTimeoutMs!
    );

    // Update event
    await db.update(decisionEvents)
      .set({
        delivered: success,
        deliveryAttempts: event.deliveryAttempts + 1,
        lastAttemptAt: new Date(),
      })
      .where(eq(decisionEvents.id, eventId));

    // Retry if failed
    if (!success && event.deliveryAttempts < source.webhookMaxAttempts!) {
      const backoffSeconds = source.webhookRetryBackoffSeconds! * Math.pow(2, event.deliveryAttempts);
      await boss.send(DECISION_DISPATCH_QUEUE, { eventId }, {
        startAfter: backoffSeconds,
      });
    }
  });
}
```

### src/workers/archiver.ts

```typescript
import PgBoss from 'pg-boss';
import { db } from '../db';
import { reviewTasks } from '../db/schema';
import { and, lt, inArray, isNull } from 'drizzle-orm';
import { subDays } from 'date-fns';

export const ARCHIVE_QUEUE = 'archive-tasks';

export async function setupArchiver(boss: PgBoss) {
  // Schedule daily
  await boss.schedule(ARCHIVE_QUEUE, '0 2 * * *'); // 2 AM daily

  await boss.work(ARCHIVE_QUEUE, async () => {
    const sevenDaysAgo = subDays(new Date(), 7);

    await db.update(reviewTasks)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
      })
      .where(and(
        inArray(reviewTasks.status, ['APPROVED', 'DENIED', 'DISPATCHED']),
        lt(reviewTasks.updatedAt, sevenDaysAgo),
        isNull(reviewTasks.archivedAt)
      ));
  });
}
```

---

## Error Handling

### src/domain/errors.ts

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resourceType: string, resourceId: string) {
    super('NOT_FOUND', `${resourceType} not found`, 404, { resource_type: resourceType, resource_id: resourceId });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid or missing credentials') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('IDEMPOTENCY_MISMATCH', message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', `Too many requests. Retry after ${retryAfter} seconds.`, 429, { retry_after_seconds: retryAfter });
  }
}
```

### src/middleware/error-handler.ts

```typescript
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../domain/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          fields: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    });
  }

  // Custom app errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        ...(error.statusCode >= 500 && { request_id: request.id }),
      },
    });
  }

  // Unknown errors
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      request_id: request.id,
    },
  });
}
```

---

## Testing

### tests/integration/review-tasks.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';

describe('Review Tasks API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a review task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/review-tasks',
      headers: {
        'X-API-Key': 'test_api_key',
        'Idempotency-Key': 'test-idempotency-key',
      },
      payload: {
        source_id: 'test-source-id',
        priority: 'HIGH',
        blocks: [
          {
            id: 'email_body',
            type: 'markdown',
            content: '# Hello\n\nThis is a test.',
            editable: true,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: 'PENDING',
      priority: 'HIGH',
    });
  });

  it('should return 409 for idempotency mismatch', async () => {
    // First request
    await app.inject({
      method: 'POST',
      url: '/review-tasks',
      headers: {
        'X-API-Key': 'test_api_key',
        'Idempotency-Key': 'same-key',
      },
      payload: { source_id: 'source1', blocks: [] },
    });

    // Second request with same key but different body
    const response = await app.inject({
      method: 'POST',
      url: '/review-tasks',
      headers: {
        'X-API-Key': 'test_api_key',
        'Idempotency-Key': 'same-key',
      },
      payload: { source_id: 'source2', blocks: [] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('IDEMPOTENCY_MISMATCH');
  });
});
```

---

## Dockerfile

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (with hot reload)
npm run dev

# Run database migrations
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

---

## Key Design Decisions

### Why Fastify over Express?

| Factor | Fastify | Express |
|--------|---------|---------|
| Performance | 2-3x faster | Baseline |
| Schema validation | Built-in (JSON Schema) | Manual |
| TypeScript | First-class support | Requires setup |
| Async/await | Native | Requires wrapper |
| Plugin system | Encapsulated | Global middleware |

### Why Drizzle over Prisma?

| Factor | Drizzle | Prisma |
|--------|---------|--------|
| Bundle size | ~50KB | ~2MB |
| Query style | SQL-like, explicit | ORM abstraction |
| Type safety | Full SQL types | Good |
| Performance | Faster (no runtime) | Good |
| Migrations | SQL-based | Schema-based |

### Why pg-boss over BullMQ?

| Factor | pg-boss | BullMQ |
|--------|---------|--------|
| Infrastructure | Postgres only | Requires Redis |
| Transactions | Same DB transaction | Separate system |
| Simplicity | Single data store | Two systems |
| Scaling | Good for moderate load | Better for high scale |

---

## OpenAPI Code Generation

Generate types from the OpenAPI spec:

```bash
# Install openapi-typescript
npm install -D openapi-typescript

# Generate types
npx openapi-typescript ./openapi/hilt-review-openapi.yaml -o ./src/generated/api-types.ts
```

This ensures backend types stay aligned with the API contract.
