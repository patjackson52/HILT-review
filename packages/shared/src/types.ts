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
