import { useState, useEffect, useCallback } from 'react';
import type { ReviewTask, ReviewTaskStatus, RiskLevel, ActionType } from '@hilt-review/shared';
import { listReviewTasks, ListReviewTasksParams } from '../api/client';

interface UseReviewTasksOptions {
  source_id?: string;
  status?: ReviewTaskStatus;
  risk_level?: RiskLevel;
  service_id?: string;
  action_type?: ActionType;
  limit?: number;
}

interface UseReviewTasksResult {
  tasks: ReviewTask[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useReviewTasks(
  options: UseReviewTasksOptions = {}
): UseReviewTasksResult {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const fetchTasks = useCallback(async (params: ListReviewTasksParams, append = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listReviewTasks(params);

      if (append) {
        setTasks(prev => [...prev, ...response.items]);
      } else {
        setTasks(response.items);
      }

      setCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setCursor(undefined);
    await fetchTasks(options);
  }, [fetchTasks, options]);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    await fetchTasks({ ...options, cursor }, true);
  }, [fetchTasks, options, cursor, isLoading]);

  useEffect(() => {
    fetchTasks(options);
  }, [
    options.source_id,
    options.status,
    options.risk_level,
    options.service_id,
    options.action_type,
    options.limit,
  ]);

  return { tasks, isLoading, error, hasMore, loadMore, refresh };
}
