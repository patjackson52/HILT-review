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

// Execution Intent
export const ExecutionIntentSchema = z.object({
  kind: z.enum(['command_template', 'mcp_tool_call', 'http_request', 'custom']),
  template_id: z.string().optional(),
  display: z.object({
    action_type: z.string().optional(),
    target: z.string().optional(),
    warning: z.string().optional(),
    icon: z.string().optional(),
  }).optional(),
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
  execution_intent: ExecutionIntentSchema.optional(),
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
