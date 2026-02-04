DO $$ BEGIN
 CREATE TYPE "action_type" AS ENUM('send', 'reply', 'post', 'create', 'update', 'delete', 'archive', 'schedule', 'transfer', 'notify');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "decision_type" AS ENUM('APPROVE', 'DENY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "delivery_mode" AS ENUM('WEBHOOK_ONLY', 'PULL_ONLY', 'WEBHOOK_AND_PULL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "priority_level" AS ENUM('LOW', 'NORMAL', 'HIGH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "review_task_status" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'DISPATCHED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "risk_level" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_type" text NOT NULL,
	"environment" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_prefix_unique" UNIQUE("key_prefix")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"decision" "decision_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"delivered" boolean DEFAULT false,
	"delivery_attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_decisions" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"decision" "decision_type" NOT NULL,
	"reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "review_task_status" DEFAULT 'PENDING' NOT NULL,
	"priority" "priority_level" DEFAULT 'NORMAL' NOT NULL,
	"title" text NOT NULL,
	"preview" text,
	"service" jsonb NOT NULL,
	"source_service" jsonb,
	"action" jsonb NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"risk_warning" text,
	"interaction_schema" jsonb,
	"blocks_original" jsonb NOT NULL,
	"blocks_working" jsonb NOT NULL,
	"blocks_final" jsonb,
	"diff" jsonb,
	"execution_intent" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"delivery_mode" "delivery_mode" DEFAULT 'WEBHOOK_AND_PULL' NOT NULL,
	"webhook_enabled" boolean DEFAULT true NOT NULL,
	"webhook_url" text,
	"webhook_secret" text,
	"webhook_timeout_ms" integer DEFAULT 5000,
	"webhook_max_attempts" integer DEFAULT 10,
	"webhook_retry_backoff_seconds" integer DEFAULT 30,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture_url" text,
	"google_sub" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_task_id_review_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "review_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_task_id_review_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "review_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
