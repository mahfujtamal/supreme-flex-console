'use client';

import { Shield, ShieldOff, User } from 'lucide-react';
import { useDevMode } from '@/contexts/DevModeContext';

export function AppHeader() {
  const { isDevMode, toggleDevMode } = useDevMode();

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
        <button className="flex items-center gap-2 text-sm hover:bg-muted px-2 py-1 rounded">
          <User size={16} />
          <span>Admin</span>
        </button>
      </div>
    </header>
  );
}
