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

const AUTH_TOKEN_KEY = 'hilt_auth_token';

// Development mode: auto-login with mock user when backend allows it
const DEV_MODE = import.meta.env.DEV;
const MOCK_USER: User = {
  id: 'dev-user',
  email: 'dev@example.com',
  name: 'Developer',
};

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOAuthEnabled, setIsOAuthEnabled] = useState(false);

  useEffect(() => {
    // Check for token in URL (from OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      // Clean the token from the URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // Check auth status first
      const statusResponse = await fetch('/api/v1/auth/status');
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setIsOAuthEnabled(status.oauth_enabled);
      }

      // Try to get current user using stored token
      const authToken = getAuthToken();
      if (!authToken && !DEV_MODE) {
        return;
      }

      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/v1/auth/me', { headers });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid or expired - clear it
        localStorage.removeItem(AUTH_TOKEN_KEY);
        if (DEV_MODE) {
          setUser(MOCK_USER);
        }
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
    window.location.href = '/api/v1/auth/google';
  }

  async function logout() {
    try {
      const authToken = getAuthToken();
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      await fetch('/api/v1/auth/logout', { method: 'POST', headers });
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
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
