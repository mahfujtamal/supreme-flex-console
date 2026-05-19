'use client';

import { useRouter } from 'next/navigation';
import { Shield, ShieldOff, User, LogOut } from 'lucide-react';
import { useDevMode } from '@/contexts/DevModeContext';
import { useAuth } from '@/contexts/AuthContext';

export function AppHeader() {
  const { isDevMode, toggleDevMode } = useDevMode();
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-background">
      <div className="text-sm font-medium text-muted-foreground">
        GPFI — Grameenphone Fixed Internet
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDevMode}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
          title={isDevMode ? 'Dev mode: RBAC bypassed' : 'Secure mode: RBAC enforced'}
        >
          {isDevMode ? <ShieldOff size={14} /> : <Shield size={14} />}
          {isDevMode ? 'DEV' : 'SECURE'}
        </button>
        <div className="flex items-center gap-2 text-sm px-2 py-1">
          <User size={16} />
          <span>{user?.user_name ?? '—'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors text-muted-foreground"
          title="Log out"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
