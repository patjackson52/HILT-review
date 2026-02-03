-- HILT-Review PostgreSQL Schema (MVP)
-- Purpose: Durable storage for async human-in-the-loop gatekeeper
-- Assumes PostgreSQL 14+

BEGIN;

-- ---------- ENUMS ----------
CREATE TYPE review_task_status AS ENUM (
  'PENDING',
  'APPROVED',
  'DENIED',
  'DISPATCHED',
  'ARCHIVED'
);

CREATE TYPE decision_type AS ENUM (
  'APPROVE',
  'DENY'
);

CREATE TYPE priority_level AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH'
);

CREATE TYPE block_type AS ENUM (
  'markdown',
  'plaintext',
  'json'
);

CREATE TYPE delivery_mode AS ENUM (
  'WEBHOOK_ONLY',
  'PULL_ONLY',
  'WEBHOOK_AND_PULL'
);

-- ---------- SOURCES ----------
-- Represents upstream integrations and their downstream delivery config
CREATE TABLE sources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  delivery_mode delivery_mode NOT NULL,

  webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_timeout_ms INTEGER NOT NULL DEFAULT 5000,
  webhook_max_attempts INTEGER NOT NULL DEFAULT 10,
  webhook_retry_backoff_seconds INTEGER NOT NULL DEFAULT 30,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- REVIEW TASKS ----------
CREATE TABLE review_tasks (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

  status review_task_status NOT NULL,
  priority priority_level NOT NULL DEFAULT 'NORMAL',

  interaction_schema JSONB,

  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_review_tasks_status ON review_tasks(status);
CREATE INDEX idx_review_tasks_source ON review_tasks(source_id);
CREATE INDEX idx_review_tasks_created ON review_tasks(created_at DESC);

-- ---------- ARTIFACT BLOCKS ----------
-- Blocks are versioned implicitly by task state (original / working / final)
CREATE TABLE artifact_blocks (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES review_tasks(id) ON DELETE CASCADE,

  block_key TEXT NOT NULL,
  block_type block_type NOT NULL,

  original_content JSONB NOT NULL,
  working_content JSONB NOT NULL,
  final_content JSONB,

  editable BOOLEAN NOT NULL DEFAULT TRUE,
  render_hints JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(task_id, block_key)
);

CREATE INDEX idx_blocks_task ON artifact_blocks(task_id);

-- ---------- DECISIONS ----------
CREATE TABLE review_decisions (
  task_id UUID PRIMARY KEY REFERENCES review_tasks(id) ON DELETE CASCADE,

  decision decision_type NOT NULL,
  reason TEXT,

  decided_by TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- DIFFS ----------
CREATE TABLE review_diffs (
  task_id UUID PRIMARY KEY REFERENCES review_tasks(id) ON DELETE CASCADE,

  text_diffs JSONB,
  json_patches JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- DECISION EVENTS (OUTBOX) ----------
-- Used for at-least-once delivery via webhook and/or pull API
CREATE TABLE decision_events (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES review_tasks(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

  decision decision_type NOT NULL,

  payload JSONB NOT NULL,

  delivered BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_events_source ON decision_events(source_id, created_at);
CREATE INDEX idx_decision_events_undelivered ON decision_events(delivered) WHERE delivered = false;

-- ---------- IDEMPOTENCY ----------
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- TRIGGERS ----------
-- Update updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sources_updated
BEFORE UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated
BEFORE UPDATE ON review_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_blocks_updated
BEFORE UPDATE ON artifact_blocks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ---------- NOTES ----------
-- 1. review_tasks.status drives the gatekeeper behavior
-- 2. artifact_blocks store original, working, and final content explicitly
-- 3. decision_events acts as an outbox for reliable delivery
-- 4. downstream consumers must dedupe using decision_events.id
-- 5. archive job should move terminal tasks to ARCHIVED after 7 days

