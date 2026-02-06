import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOAuthEnabled: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || '';

// Development mode: auto-login with mock user when backend allows it
const DEV_MODE = import.meta.env.DEV;
const MOCK_USER: User = {
  id: 'dev-user',
  email: 'dev@example.com',
  name: 'Developer',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOAuthEnabled, setIsOAuthEnabled] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // Check auth status first
      const statusResponse = await fetch(`${API_BASE}/api/v1/auth/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setIsOAuthEnabled(status.oauth_enabled);
      }

      // Try to get current user
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else if (DEV_MODE) {
        // In dev mode, if not authenticated, use mock user
        setUser(MOCK_USER);
      }
    } catch {
      // Not authenticated - in dev mode, use mock user
      if (DEV_MODE) {
        setUser(MOCK_USER);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function login() {
    if (DEV_MODE && !isOAuthEnabled) {
      // Dev mode without OAuth - use mock user
      setUser(MOCK_USER);
      return;
    }
    // Redirect to OAuth login
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      if (!DEV_MODE) {
        window.location.href = '/login';
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isOAuthEnabled, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
