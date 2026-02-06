import type {
  ReviewTask,
  ReviewTaskStatus,
  RiskLevel,
  ActionType,
  DecisionType,
  Source,
  DeliveryMode,
} from '@hilt-review/shared';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error?.message || `HTTP ${response.status}`,
      response.status,
      error.error?.code
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Review Tasks API
export interface ListReviewTasksParams {
  source_id?: string;
  status?: ReviewTaskStatus;
  risk_level?: RiskLevel;
  service_id?: string;
  action_type?: ActionType;
  limit?: number;
  cursor?: string;
}

export interface ListReviewTasksResponse {
  items: ReviewTask[];
  total_count: number;
  next_cursor?: string;
}

export async function listReviewTasks(
  params: ListReviewTasksParams = {}
): Promise<ListReviewTasksResponse> {
  const searchParams = new URLSearchParams();

  if (params.source_id) searchParams.set('source_id', params.source_id);
  if (params.status) searchParams.set('status', params.status);
  if (params.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params.service_id) searchParams.set('service_id', params.service_id);
  if (params.action_type) searchParams.set('action_type', params.action_type);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.cursor) searchParams.set('cursor', params.cursor);

  const query = searchParams.toString();
  return request<ListReviewTasksResponse>(
    `/review-tasks${query ? `?${query}` : ''}`
  );
}

export async function getReviewTask(id: string): Promise<ReviewTask> {
  return request<ReviewTask>(`/review-tasks/${id}`);
}

export interface SubmitDecisionParams {
  decision: DecisionType;
  reason?: string;
}

export async function submitDecision(
  taskId: string,
  params: SubmitDecisionParams
): Promise<ReviewTask> {
  return request<ReviewTask>(`/review-tasks/${taskId}/decision`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface PatchBlocksParams {
  blocks: Array<{
    id: string;
    content: string | Record<string, unknown>;
  }>;
}

export async function patchBlocks(
  taskId: string,
  params: PatchBlocksParams
): Promise<ReviewTask> {
  return request<ReviewTask>(`/review-tasks/${taskId}/blocks`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

// Auth API
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export async function getCurrentUser(): Promise<{ user: User } | null> {
  try {
    return await request<{ user: User }>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return null;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

// Admin API helper (uses admin key from localStorage)
const ADMIN_KEY_STORAGE_KEY = 'hilt_admin_key';

export function getStoredAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE_KEY);
}

export function setStoredAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}

export function clearStoredAdminKey(): void {
  localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
}

async function adminRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const adminKey = getStoredAdminKey();
  if (!adminKey) {
    throw new ApiError('Admin key not configured', 401, 'ADMIN_KEY_MISSING');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error?.message || `HTTP ${response.status}`,
      response.status,
      error.error?.code
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Sources API (no auth required for now)
export interface CreateSourceParams {
  name: string;
  description?: string;
  delivery: {
    mode: DeliveryMode;
    webhook?: {
      enabled: boolean;
      url?: string;
      secret?: string;
      timeout_ms?: number;
      max_attempts?: number;
      retry_backoff_seconds?: number;
    };
  };
}

export async function listSources(): Promise<Source[]> {
  return request<Source[]>('/sources');
}

export async function getSource(id: string): Promise<Source> {
  return request<Source>(`/sources/${id}`);
}

export async function createSource(params: CreateSourceParams): Promise<Source> {
  return request<Source>('/sources', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateSource(
  id: string,
  params: Partial<CreateSourceParams>
): Promise<Source> {
  return request<Source>(`/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function deleteSource(id: string): Promise<void> {
  return request<void>(`/sources/${id}`, { method: 'DELETE' });
}

// Admin API - API Key Management
export interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  source_id: string | null;
  key_type: 'source' | 'admin';
  environment: 'live' | 'test';
  name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface GenerateApiKeyParams {
  source_id?: string;
  key_type: 'source' | 'admin';
  environment: 'live' | 'test';
  name?: string;
}

export interface GenerateApiKeyResponse {
  key: string; // Full key - only shown once!
  id: string;
  source_id: string | null;
  key_type: 'source' | 'admin';
  environment: 'live' | 'test';
  name: string | null;
}

export async function generateApiKey(
  params: GenerateApiKeyParams
): Promise<GenerateApiKeyResponse> {
  return adminRequest<GenerateApiKeyResponse>('/admin/api-keys', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listApiKeysForSource(
  sourceId: string
): Promise<{ items: ApiKeyInfo[] }> {
  return adminRequest<{ items: ApiKeyInfo[] }>(
    `/admin/sources/${sourceId}/api-keys`
  );
}

export async function revokeApiKey(id: string): Promise<void> {
  return adminRequest<void>(`/admin/api-keys/${id}`, { method: 'DELETE' });
}

export interface AdminStats {
  tasks: {
    by_status: Record<string, number>;
    total: number;
  };
  sources: {
    total: number;
  };
  decision_events: {
    pending_delivery: number;
  };
  api_keys: {
    active: number;
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  return adminRequest<AdminStats>('/admin/stats');
}

export { ApiError };
