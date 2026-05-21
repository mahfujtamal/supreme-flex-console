'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { phpApi } from '@/lib/api';

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
  /** Called after a successful OTP verify response — stores token in memory, sets user */
  login: (accessToken: string, user: AuthUser) => void;
  /** Calls the logout endpoint (revokes jti), clears in-memory state */
  logout: () => Promise<void>;
  /** Returns the current in-memory access token for attaching to API calls */
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Module-level store so api.ts interceptors can read the token without a React dep
let _accessToken: string | null = null;
export function getAccessTokenGlobal() { return _accessToken; }
export function setAccessTokenGlobal(t: string | null) { _accessToken = t; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef              = useRef<string | null>(null);

  // On mount: try to restore session via the httpOnly refresh cookie
  useEffect(() => {
    phpApi.post<{ access_token: string }>('/auth/refresh')
      .then(res => {
        tokenRef.current = res.data.access_token;
        setAccessTokenGlobal(res.data.access_token);
        return phpApi.get<AuthUser>('/auth/me');
      })
      .then(res => setUser(res.data))
      .catch(() => { /* No valid refresh cookie — user must log in */ })
      .finally(() => setLoading(false));
  }, []);

  function login(accessToken: string, userObj: AuthUser) {
    tokenRef.current = accessToken;
    setAccessTokenGlobal(accessToken);
    setUser(userObj);
  }

  async function logout() {
    try {
      await phpApi.post('/auth/logout');
    } catch {
      // Best-effort — clear state regardless
    }
    tokenRef.current = null;
    setAccessTokenGlobal(null);
    setUser(null);
  }

  function getAccessToken() {
    return tokenRef.current;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
