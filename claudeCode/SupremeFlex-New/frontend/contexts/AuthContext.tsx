'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  user_name: string;
  contact_number: string;
  staff_type: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sf_token');
    const stored = localStorage.getItem('sf_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('sf_token');
        localStorage.removeItem('sf_user');
      }
    }
    setLoading(false);
  }, []);

  function login(token: string, userObj: AuthUser) {
    localStorage.setItem('sf_token', token);
    localStorage.setItem('sf_user', JSON.stringify(userObj));
    setUser(userObj);
  }

  function logout() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
