# HILT-Review Full MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete human-in-the-loop review system where AI agents propose actions and humans approve/deny them before execution.

**Architecture:** Monorepo with npm workspaces. Backend is Fastify + TypeScript + Drizzle ORM + pg-boss. Frontend is React + Vite + TypeScript. PostgreSQL 15+ for data. Card-based UI with service icons, action types, and risk-level color bands.

**Tech Stack:** Node.js 20 LTS, Fastify 4.x, Drizzle ORM, pg-boss, React, Vite, Zod, TypeScript 5.x, PostgreSQL 15+, Vitest

---

## Phase 1: Foundation (Tasks 1-6)

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create root package.json**

```json
{
  "name": "hilt-review",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:migrate": "npm run db:migrate --workspace=backend",
    "db:generate": "npm run db:generate --workspace=backend",
    "generate:types": "./scripts/generate-types.sh"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.turbo/
.DS_Store
coverage/
```

**Step 4: Create .env.example**

```
# Database
DATABASE_URL=postgresql://hilt:localdev@localhost:5432/hilt_review

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# Session
SESSION_SECRET=your-session-secret-min-32-characters-long

# Optional
ALLOWED_DOMAINS=["yourdomain.com"]
CORS_ORIGIN=http://localhost:5173
```

**Step 5: Install root dependencies**

Run: `npm install`
Expected: Creates node_modules and package-lock.json

**Step 6: Commit**

```bash
git add package.json turbo.json .gitignore .env.example
git commit -m "chore: initialize monorepo structure"
```

---

### Task 2: Create Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@hilt-review/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/shared/src/types.ts**

```typescript
// Core domain types aligned with OpenAPI v2.0.0

export type Priority = 'LOW' | 'NORMAL' | 'HIGH';
export type ReviewTaskStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'DISPATCHED' | 'ARCHIVED';
export type DecisionType = 'APPROVE' | 'DENY';
export type BlockType = 'markdown' | 'plaintext' | 'json';
export type DeliveryMode = 'WEBHOOK_ONLY' | 'PULL_ONLY' | 'WEBHOOK_AND_PULL';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionType = 'send' | 'reply' | 'post' | 'create' | 'update' | 'delete' | 'archive' | 'schedule' | 'transfer' | 'notify';

export interface ServiceIdentifier {
  id: string;
  name: string;
  icon?: string;
}

export interface ActionIdentifier {
  type: ActionType;
  verb: string;
  icon?: string;
}

export interface ArtifactBlock {
  id: string;
  label?: string;
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
  source_name: string;
  status: ReviewTaskStatus;
  priority: Priority;
  title: string;
  preview?: string;
  service: ServiceIdentifier;
  source_service?: ServiceIdentifier;
  action: ActionIdentifier;
  risk_level: RiskLevel;
  risk_warning?: string;
  interaction_schema?: InteractionSchema;
  blocks_original: ArtifactBlock[];
  blocks_working: ArtifactBlock[];
  blocks_final?: ArtifactBlock[];
  diff?: DecisionDiff;
  decision?: ReviewDecision;
  execution_intent?: ExecutionIntent;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface ReviewTaskListItem {
  id: string;
  source_id: string;
  source_name: string;
  status: ReviewTaskStatus;
  priority: Priority;
  title: string;
  preview?: string;
  service: ServiceIdentifier;
  source_service?: ServiceIdentifier;
  action: ActionIdentifier;
  risk_level: RiskLevel;
  risk_warning?: string;
  block_count?: number;
  has_changes?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewDecision {
  type: DecisionType;
  reason?: string;
  decided_at: string;
  decided_by?: string;
}

export interface ExecutionIntent {
  kind: 'command_template' | 'mcp_tool_call' | 'http_request' | 'custom';
  template_id?: string;
  display?: {
    action_type?: string;
    target?: string;
    warning?: string;
    icon?: string;
  };
}

export interface InteractionSchema {
  type: 'edit' | 'confirm' | 'choice' | 'external';
  guidance?: Record<string, unknown>;
  options?: ChoiceOption[];
  deny_reasons?: DenyReason[];
  external_url?: string;
  require_confirmation?: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
  patches?: BlockPatch[];
}

export interface DenyReason {
  id: string;
  label: string;
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

export interface DecisionEvent {
  event_id: string;
  source_id: string;
  task_id: string;
  decision: ReviewDecision;
  original: ArtifactBlock[];
  final: ArtifactBlock[];
  diff: DecisionDiff;
  metadata?: Record<string, unknown>;
  occurred_at: string;
}

export interface Source {
  id: string;
  name: string;
  description?: string;
  delivery: SourceDeliveryConfig;
  created_at: string;
}

export interface SourceDeliveryConfig {
  mode: DeliveryMode;
  webhook: {
    enabled: boolean;
    url?: string;
    secret?: string;
    timeout_ms?: number;
    max_attempts?: number;
    retry_backoff_seconds?: number;
  };
}

// API Request/Response types
export interface CreateReviewTaskRequest {
  source_id: string;
  title: string;
  service: ServiceIdentifier;
  source_service?: ServiceIdentifier;
  action: ActionIdentifier;
  risk_level: RiskLevel;
  risk_warning?: string;
  priority?: Priority;
  interaction_schema?: InteractionSchema;
  blocks: ArtifactBlock[];
  metadata?: Record<string, unknown>;
}

export interface PatchBlocksRequest {
  blocks_working: ArtifactBlock[];
}

export interface SubmitDecisionRequest {
  decision: DecisionType;
  reason?: string;
}

export interface ReviewTaskListResponse {
  items: ReviewTaskListItem[];
  total_count: number;
  next_cursor?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}
```

**Step 4: Create packages/shared/src/index.ts**

```typescript
export * from './types.js';
```

**Step 5: Install dependencies and build**

Run: `npm install && npm run build --workspace=@hilt-review/shared`
Expected: Creates packages/shared/dist/ with compiled JS and types

**Step 6: Commit**

```bash
git add packages/
git commit -m "feat: add shared types package"
```

---

### Task 3: Create Backend Foundation

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/config/index.ts`

**Step 1: Create backend/package.json**

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
    "@hilt-review/shared": "*",
    "fastify": "^4.26.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.0.0",
    "@fastify/cookie": "^9.0.0",
    "@fastify/session": "^10.0.0",
    "@fastify/oauth2": "^7.0.0",
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
    "@types/diff": "^5.0.0",
    "vitest": "^1.2.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

**Step 2: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Create backend/src/config/index.ts**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_REDIRECT_URI: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_DOMAINS: z.string().transform(s => {
    try { return JSON.parse(s); } catch { return undefined; }
  }).pipe(z.array(z.string()).optional()).optional(),
  CORS_ORIGIN: z.string().url().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

**Step 4: Create backend/src/app.ts**

```typescript
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN || true,
    credentials: true,
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}
```

**Step 5: Create backend/src/index.ts**

```typescript
import { buildApp } from './app.js';
import { config } from './config/index.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`Server running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
```

**Step 6: Install backend dependencies**

Run: `npm install --workspace=backend`
Expected: Installs all dependencies in backend/node_modules

**Step 7: Verify it compiles**

Run: `npm run typecheck --workspace=backend`
Expected: No errors

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: add backend foundation with Fastify"
```

---

### Task 4: Create Docker Compose for Local Development

**Files:**
- Create: `docker-compose.yml`
- Create: `scripts/dev-up.sh`
- Create: `scripts/dev-down.sh`

**Step 1: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: hilt_review
      POSTGRES_USER: hilt
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hilt -d hilt_review"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Step 2: Create scripts/dev-up.sh**

```bash
#!/bin/bash
set -e

echo "Starting PostgreSQL..."
docker-compose up -d postgres

echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U hilt -d hilt_review; do
  sleep 1
done

echo "Running migrations..."
npm run db:migrate --workspace=backend || echo "No migrations yet"

echo "Starting development servers..."
npm run dev
```

**Step 3: Create scripts/dev-down.sh**

```bash
#!/bin/bash
docker-compose down
```

**Step 4: Make scripts executable**

Run: `chmod +x scripts/*.sh`

**Step 5: Start Postgres and verify**

Run: `docker-compose up -d postgres`
Expected: PostgreSQL container starts

Run: `docker-compose ps`
Expected: postgres service is "healthy"

**Step 6: Commit**

```bash
git add docker-compose.yml scripts/
git commit -m "chore: add Docker Compose for local development"
```

---

### Task 5: Create Drizzle Schema and Migrations

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/schema.ts`

**Step 1: Create backend/drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 2: Create backend/src/db/schema.ts**

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
export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high', 'critical']);
export const actionTypeEnum = pgEnum('action_type', [
  'send', 'reply', 'post', 'create', 'update', 'delete', 'archive', 'schedule', 'transfer', 'notify'
]);

// Sources table
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Review tasks table
export const reviewTasks = pgTable('review_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  status: reviewTaskStatusEnum('status').notNull().default('PENDING'),
  priority: priorityEnum('priority').notNull().default('NORMAL'),
  title: text('title').notNull(),
  preview: text('preview'),
  service: jsonb('service').notNull(),
  sourceService: jsonb('source_service'),
  action: jsonb('action').notNull(),
  riskLevel: riskLevelEnum('risk_level').notNull(),
  riskWarning: text('risk_warning'),
  interactionSchema: jsonb('interaction_schema'),
  blocksOriginal: jsonb('blocks_original').notNull(),
  blocksWorking: jsonb('blocks_working').notNull(),
  blocksFinal: jsonb('blocks_final'),
  diff: jsonb('diff'),
  executionIntent: jsonb('execution_intent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

// Review decisions table
export const reviewDecisions = pgTable('review_decisions', {
  taskId: uuid('task_id').primaryKey().references(() => reviewTasks.id, { onDelete: 'cascade' }),
  decision: decisionTypeEnum('decision').notNull(),
  reason: text('reason'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
});

// Decision events table (outbox)
export const decisionEvents = pgTable('decision_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => reviewTasks.id, { onDelete: 'cascade' }).notNull(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  decision: decisionTypeEnum('decision').notNull(),
  payload: jsonb('payload').notNull(),
  delivered: boolean('delivered').default(false),
  deliveryAttempts: integer('delivery_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Idempotency keys table
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// API keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }),
  keyPrefix: text('key_prefix').notNull().unique(),
  keyHash: text('key_hash').notNull(),
  keyType: text('key_type').notNull(), // 'source' | 'admin'
  environment: text('environment').notNull(), // 'live' | 'test'
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  pictureUrl: text('picture_url'),
  googleSub: text('google_sub').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
```

**Step 3: Create backend/src/db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/index.js';
import * as schema from './schema.js';

const client = postgres(config.DATABASE_URL);
export const db = drizzle(client, { schema });
```

**Step 4: Generate initial migration**

Run: `DATABASE_URL=postgresql://hilt:localdev@localhost:5432/hilt_review npm run db:generate --workspace=backend`
Expected: Creates migration files in backend/drizzle/migrations/

**Step 5: Run migration**

Run: `DATABASE_URL=postgresql://hilt:localdev@localhost:5432/hilt_review npm run db:migrate --workspace=backend`
Expected: Tables created in database

**Step 6: Commit**

```bash
git add backend/drizzle.config.ts backend/src/db/ backend/drizzle/
git commit -m "feat: add Drizzle schema and migrations"
```

---

### Task 6: Create Error Handling and Domain Types

**Files:**
- Create: `backend/src/domain/errors.ts`
- Create: `backend/src/domain/schemas.ts`
- Create: `backend/src/middleware/error-handler.ts`

**Step 1: Create backend/src/domain/errors.ts**

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
    super('CONFLICT', message, 409, details);
  }
}

export class IdempotencyError extends AppError {
  constructor() {
    super('IDEMPOTENCY_MISMATCH', 'Idempotency key was used with different request body', 409);
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_STATE_TRANSITION', message, 422, details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', `Too many requests. Retry after ${retryAfter} seconds.`, 429, { retry_after_seconds: retryAfter });
  }
}
```

**Step 2: Create backend/src/domain/schemas.ts**

```typescript
import { z } from 'zod';

// Enums
export const PrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ActionTypeSchema = z.enum(['send', 'reply', 'post', 'create', 'update', 'delete', 'archive', 'schedule', 'transfer', 'notify']);
export const DecisionTypeSchema = z.enum(['APPROVE', 'DENY']);
export const BlockTypeSchema = z.enum(['markdown', 'plaintext', 'json']);

// Service and Action identifiers
export const ServiceIdentifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
});

export const ActionIdentifierSchema = z.object({
  type: ActionTypeSchema,
  verb: z.string(),
  icon: z.string().optional(),
});

// Artifact Block
export const ArtifactBlockSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: BlockTypeSchema,
  content: z.union([z.string(), z.record(z.unknown())]),
  editable: z.boolean(),
  render_hints: z.object({
    preview: z.boolean().optional(),
    syntax_highlighting: z.boolean().optional(),
  }).optional(),
});

// Interaction Schema
export const InteractionSchemaSchema = z.object({
  type: z.enum(['edit', 'confirm', 'choice', 'external']),
  guidance: z.record(z.unknown()).optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    patches: z.array(z.object({
      block_id: z.string(),
      op: z.literal('replace'),
      value: z.union([z.string(), z.record(z.unknown())]),
    })).optional(),
  })).optional(),
  deny_reasons: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })).optional(),
  external_url: z.string().url().optional(),
  require_confirmation: z.boolean().optional(),
});

// Create Review Task Request
export const CreateReviewTaskSchema = z.object({
  source_id: z.string().uuid(),
  title: z.string().max(200),
  service: ServiceIdentifierSchema,
  source_service: ServiceIdentifierSchema.optional(),
  action: ActionIdentifierSchema,
  risk_level: RiskLevelSchema,
  risk_warning: z.string().optional(),
  priority: PrioritySchema.optional().default('NORMAL'),
  interaction_schema: InteractionSchemaSchema.optional(),
  blocks: z.array(ArtifactBlockSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
});

// Patch Blocks Request
export const PatchBlocksSchema = z.object({
  blocks_working: z.array(ArtifactBlockSchema),
});

// Submit Decision Request
export const SubmitDecisionSchema = z.object({
  decision: DecisionTypeSchema,
  reason: z.string().optional(),
});

// Source Delivery Config
export const SourceDeliveryConfigSchema = z.object({
  mode: z.enum(['WEBHOOK_ONLY', 'PULL_ONLY', 'WEBHOOK_AND_PULL']),
  webhook: z.object({
    enabled: z.boolean(),
    url: z.string().url().optional(),
    secret: z.string().optional(),
    timeout_ms: z.number().int().positive().optional().default(5000),
    max_attempts: z.number().int().positive().optional().default(10),
    retry_backoff_seconds: z.number().int().positive().optional().default(30),
  }),
});

// Create Source Request
export const CreateSourceSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  delivery: SourceDeliveryConfigSchema,
});

// List query params
export const ListReviewTasksQuerySchema = z.object({
  source_id: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'DISPATCHED', 'ARCHIVED']).optional(),
  risk_level: RiskLevelSchema.optional(),
  service_id: z.string().optional(),
  action_type: ActionTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export type CreateReviewTaskInput = z.infer<typeof CreateReviewTaskSchema>;
export type PatchBlocksInput = z.infer<typeof PatchBlocksSchema>;
export type SubmitDecisionInput = z.infer<typeof SubmitDecisionSchema>;
export type CreateSourceInput = z.infer<typeof CreateSourceSchema>;
export type ListReviewTasksQuery = z.infer<typeof ListReviewTasksQuerySchema>;
```

**Step 3: Create backend/src/middleware/error-handler.ts**

```typescript
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../domain/errors.js';
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

  // Fastify errors (validation, etc.)
  if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: {
        code: 'REQUEST_ERROR',
        message: error.message,
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

**Step 4: Update app.ts to use error handler**

In `backend/src/app.ts`, add after the cors registration:

```typescript
import { errorHandler } from './middleware/error-handler.js';

// ... existing code ...

// Add after cors registration:
app.setErrorHandler(errorHandler);
```

**Step 5: Verify it compiles**

Run: `npm run typecheck --workspace=backend`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/domain/ backend/src/middleware/ backend/src/app.ts
git commit -m "feat: add error handling and Zod schemas"
```

---

## Phase 2: Backend Core (Tasks 7-14)

This phase implements the core API endpoints. Each task follows TDD.

### Task 7: Implement Sources CRUD

**Files:**
- Create: `backend/src/services/source.service.ts`
- Create: `backend/src/routes/sources.ts`
- Create: `backend/src/routes/index.ts`
- Create: `backend/tests/integration/sources.test.ts`

*TDD: Write failing tests first, then implement.*

### Task 8: Implement API Key Authentication Middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/services/api-key.service.ts`
- Create: `backend/tests/unit/auth.test.ts`

### Task 9: Implement Review Task Creation

**Files:**
- Create: `backend/src/services/review-task.service.ts`
- Create: `backend/src/routes/review-tasks.ts`
- Create: `backend/tests/integration/review-tasks.test.ts`

### Task 10: Implement Review Task Listing with Filters

Add filtering by status, risk_level, service_id, action_type to the list endpoint.

### Task 11: Implement Block Editing (PATCH)

Implement the PATCH /review-tasks/:id/blocks endpoint.

### Task 12: Implement Decision Submission

Implement POST /review-tasks/:id/decision with diff calculation.

### Task 13: Implement Diff Service

**Files:**
- Create: `backend/src/services/diff.service.ts`
- Create: `backend/tests/unit/diff.service.test.ts`

### Task 14: Implement Decision Events Pull API

**Files:**
- Create: `backend/src/routes/decision-events.ts`

---

## Phase 3: Background Workers (Tasks 15-16)

### Task 15: Implement Decision Dispatcher Worker

**Files:**
- Create: `backend/src/workers/index.ts`
- Create: `backend/src/workers/decision-dispatcher.ts`
- Create: `backend/src/services/webhook.service.ts`

### Task 16: Implement Archiver Worker

**Files:**
- Create: `backend/src/workers/archiver.ts`

---

## Phase 4: OAuth Authentication (Tasks 17-18)

### Task 17: Implement Google OAuth Flow

**Files:**
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/services/user.service.ts`

### Task 18: Implement Session Middleware

Add session-based auth for reviewer endpoints.

---

## Phase 5: Frontend Foundation (Tasks 19-22)

### Task 19: Initialize Frontend with Vite + React

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

### Task 20: Set Up React Router and Layout

**Files:**
- Create: `frontend/src/pages/Layout.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/ReviewQueue.tsx`
- Create: `frontend/src/pages/ReviewTask.tsx`

### Task 21: Create API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useAuth.ts`

### Task 22: Implement Auth Context and Protected Routes

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`

---

## Phase 6: Frontend UI Components (Tasks 23-30)

### Task 23: Create Design System Components

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/index.ts`

### Task 24: Create Task Card Component

**Files:**
- Create: `frontend/src/components/TaskCard.tsx`

Card with risk band, service icon, action icon, title, preview.

### Task 25: Create Review Queue Page

**Files:**
- Modify: `frontend/src/pages/ReviewQueue.tsx`
- Create: `frontend/src/components/QueueFilters.tsx`
- Create: `frontend/src/hooks/useReviewTasks.ts`

### Task 26: Create Task Header Component

**Files:**
- Create: `frontend/src/components/TaskHeader.tsx`

### Task 27: Create Execution Intent Panel

**Files:**
- Create: `frontend/src/components/ExecutionIntentPanel.tsx`

### Task 28: Create Block Editors

**Files:**
- Create: `frontend/src/components/editors/PlaintextEditor.tsx`
- Create: `frontend/src/components/editors/MarkdownEditor.tsx`
- Create: `frontend/src/components/editors/JsonEditor.tsx`
- Create: `frontend/src/components/editors/BlockEditor.tsx`

### Task 29: Create Decision Controls

**Files:**
- Create: `frontend/src/components/DecisionControls.tsx`
- Create: `frontend/src/components/DenyModal.tsx`
- Create: `frontend/src/components/ApproveModal.tsx`

### Task 30: Create Review Task Detail Page

**Files:**
- Modify: `frontend/src/pages/ReviewTask.tsx`
- Create: `frontend/src/hooks/useReviewTask.ts`

---

## Phase 7: Testing & Polish (Tasks 31-34)

### Task 31: Add Backend Integration Tests

**Files:**
- Create: `backend/tests/setup.ts`
- Create: `backend/tests/integration/review-workflow.test.ts`

### Task 32: Add Frontend Component Tests

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/components/TaskCard.test.tsx`
- Create: `frontend/tests/components/DecisionControls.test.tsx`

### Task 33: Add E2E Test Setup

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/review-flow.spec.ts`

### Task 34: Final Integration and Documentation

- Update README.md with setup instructions
- Verify full flow works end-to-end
- Final commit

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-6 | Foundation (monorepo, DB, config) |
| 2 | 7-14 | Backend Core (CRUD, auth, APIs) |
| 3 | 15-16 | Workers (dispatcher, archiver) |
| 4 | 17-18 | OAuth (Google auth, sessions) |
| 5 | 19-22 | Frontend Foundation (Vite, router) |
| 6 | 23-30 | Frontend UI (cards, editors, controls) |
| 7 | 31-34 | Testing & Polish |

**Total Tasks:** 34
**Estimated Implementation Time:** Tasks are 2-5 minutes each when following TDD
