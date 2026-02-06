import { useState, useEffect, useCallback } from 'react';
import type { Source } from '@hilt-review/shared';
import {
  listSources,
  createSource,
  deleteSource,
  CreateSourceParams,
  ApiKeyInfo,
  listApiKeysForSource,
  generateApiKey,
  GenerateApiKeyParams,
  GenerateApiKeyResponse,
  revokeApiKey,
} from '../api/client';

interface UseSourcesResult {
  sources: Source[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createSource: (params: CreateSourceParams) => Promise<Source>;
  deleteSource: (id: string) => Promise<void>;
}

export function useSources(): UseSourcesResult {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listSources();
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateSource = useCallback(
    async (params: CreateSourceParams): Promise<Source> => {
      const source = await createSource(params);
      setSources((prev) => [...prev, source]);
      return source;
    },
    []
  );

  const handleDeleteSource = useCallback(async (id: string): Promise<void> => {
    await deleteSource(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  return {
    sources,
    isLoading,
    error,
    refresh: fetchSources,
    createSource: handleCreateSource,
    deleteSource: handleDeleteSource,
  };
}

// Hook for managing API keys for a specific source
interface UseApiKeysResult {
  keys: ApiKeyInfo[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  generateKey: (params: Omit<GenerateApiKeyParams, 'source_id'>) => Promise<GenerateApiKeyResponse>;
  revokeKey: (id: string) => Promise<void>;
}

export function useApiKeys(sourceId: string | null): UseApiKeysResult {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!sourceId) {
      setKeys([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await listApiKeysForSource(sourceId);
      setKeys(response.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  const handleGenerateKey = useCallback(
    async (params: Omit<GenerateApiKeyParams, 'source_id'>): Promise<GenerateApiKeyResponse> => {
      if (!sourceId) {
        throw new Error('No source selected');
      }
      const response = await generateApiKey({ ...params, source_id: sourceId });
      // Refresh key list after generation
      await fetchKeys();
      return response;
    },
    [sourceId, fetchKeys]
  );

  const handleRevokeKey = useCallback(
    async (id: string): Promise<void> => {
      await revokeApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    },
    []
  );

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  return {
    keys,
    isLoading,
    error,
    refresh: fetchKeys,
    generateKey: handleGenerateKey,
    revokeKey: handleRevokeKey,
  };
}
