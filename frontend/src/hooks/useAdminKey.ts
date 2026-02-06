import { useState, useCallback } from 'react';
import {
  getStoredAdminKey,
  setStoredAdminKey,
  clearStoredAdminKey,
} from '../api/client';

export interface UseAdminKeyResult {
  adminKey: string | null;
  isConfigured: boolean;
  setAdminKey: (key: string) => void;
  clearAdminKey: () => void;
}

export function useAdminKey(): UseAdminKeyResult {
  const [adminKey, setAdminKeyState] = useState<string | null>(() =>
    getStoredAdminKey()
  );

  const setAdminKey = useCallback((key: string) => {
    setStoredAdminKey(key);
    setAdminKeyState(key);
  }, []);

  const clearAdminKey = useCallback(() => {
    clearStoredAdminKey();
    setAdminKeyState(null);
  }, []);

  return {
    adminKey,
    isConfigured: adminKey !== null,
    setAdminKey,
    clearAdminKey,
  };
}
