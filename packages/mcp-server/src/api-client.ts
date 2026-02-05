export interface ReviewTask {
  id: string;
  source_id: string;
  status: string;
  title: string;
  preview?: string;
  blocks_original: ArtifactBlock[];
  blocks_working: ArtifactBlock[];
  blocks_final?: ArtifactBlock[];
  diff?: unknown;
  decision?: {
    type: string;
    reason?: string;
    decided_at: string;
    decided_by?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ArtifactBlock {
  id: string;
  label?: string;
  type: 'markdown' | 'plaintext' | 'json';
  content: string | Record<string, unknown>;
  editable: boolean;
}

export interface TaskListResponse {
  items: ReviewTask[];
  total_count: number;
  next_cursor?: string;
}

export interface CreateTaskParams {
  source_id: string;
  title: string;
  service: { id: string; name: string };
  action: { type: string; verb: string };
  risk_level: string;
  priority?: string;
  blocks: ArtifactBlock[];
  execution_intent?: {
    kind: string;
    display?: {
      action_type?: string;
      target?: string;
      warning?: string;
    };
  };
  metadata?: Record<string, unknown>;
}

export class HiltApiClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: { apiUrl: string; apiKey: string }) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        `HILT API error ${response.status}: ${error.error?.message || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async createTask(
    params: CreateTaskParams,
    idempotencyKey?: string
  ): Promise<ReviewTask> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }
    return this.request('POST', '/review-tasks', params, headers);
  }

  async getTask(taskId: string): Promise<ReviewTask> {
    return this.request('GET', `/review-tasks/${taskId}`);
  }

  async listTasks(
    sourceId: string,
    status?: string,
    limit = 20
  ): Promise<TaskListResponse> {
    const params = new URLSearchParams({
      source_id: sourceId,
      limit: String(limit),
    });
    if (status) params.set('status', status);

    return this.request('GET', `/review-tasks?${params}`);
  }

  async pollForDecision(
    taskId: string,
    timeoutSeconds: number
  ): Promise<ReviewTask> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    const pollInterval = 2000;

    while (Date.now() < deadline) {
      const task = await this.getTask(taskId);

      if (task.status !== 'PENDING') {
        return task;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Return current state on timeout
    return this.getTask(taskId);
  }
}
