import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { UserProfile, AuthStatus } from '@shared/types';

interface AuthContextType {
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setupOwner: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const res = await api.get<AuthStatus>('/api/auth/status');
      setIsConfigured(res.isConfigured);
      setIsAuthenticated(res.isAuthenticated);
      setUser(res.user);
    } catch (err) {
      console.error('Failed to check auth status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ user: UserProfile }>('/api/auth/login', { username, password });
    setUser(res.user);
    setIsAuthenticated(true);
    setIsConfigured(true);
  };

  const setupOwner = async (username: string, password: string) => {
    const res = await api.post<{ user: UserProfile }>('/api/auth/setup', { username, password });
    setUser(res.user);
    setIsAuthenticated(true);
    setIsConfigured(true);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isConfigured,
        isAuthenticated,
        user,
        isLoading,
        checkAuth,
        login,
        setupOwner,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
