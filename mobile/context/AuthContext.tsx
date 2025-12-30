import React, { createContext, useContext, useEffect, useState } from 'react';
import { login as apiLogin, getCurrentUser, clearTokens, getTokens } from '@/lib/api';
import { clearStoredCredentials } from '@/lib/biometric-auth';

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  roles?: any[];
  is_superuser?: boolean;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app startup, always require an explicit login.
    // Clear any persisted tokens and do NOT auto-log the user in.
    (async () => {
      try {
        await clearTokens();
      } finally {
        setUser(null);
        setLoading(false);
      }
    })();
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    setLoading(true);
    try {
      await apiLogin(email, password);
      const me = await getCurrentUser<User>();
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const login = loginWithCredentials;

  const logout = async () => {
    await clearTokens();
    await clearStoredCredentials();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        loginWithCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
