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
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development mode: auto-login with mock user
const DEV_MODE = import.meta.env.DEV;
const MOCK_USER: User = {
  id: 'dev-user',
  email: 'dev@example.com',
  name: 'Developer',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    // In dev mode, auto-login with mock user
    if (DEV_MODE) {
      setUser(MOCK_USER);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch {
      // Not authenticated
    } finally {
      setIsLoading(false);
    }
  }

  function login() {
    if (DEV_MODE) {
      setUser(MOCK_USER);
      return;
    }
    // Redirect to OAuth login
    window.location.href = '/api/v1/auth/google';
  }

  async function logout() {
    if (DEV_MODE) {
      setUser(null);
      return;
    }
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
