import type {
  ReviewTask,
  ReviewTaskStatus,
  RiskLevel,
  ActionType,
  DecisionType,
} from '@hilt-review/shared';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

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

export { ApiError };
