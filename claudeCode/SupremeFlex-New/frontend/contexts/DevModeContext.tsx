'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextType>({ isDevMode: true, toggleDevMode: () => {} });

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('supremeflex_dev_mode');
    if (stored !== null) setIsDevMode(stored === 'true');
  }, []);

  const toggleDevMode = () => {
    setIsDevMode(prev => {
      localStorage.setItem('supremeflex_dev_mode', String(!prev));
      return !prev;
    });
  };

  return <DevModeContext.Provider value={{ isDevMode, toggleDevMode }}>{children}</DevModeContext.Provider>;
}

export const useDevMode = () => useContext(DevModeContext);
