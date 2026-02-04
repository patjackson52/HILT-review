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
