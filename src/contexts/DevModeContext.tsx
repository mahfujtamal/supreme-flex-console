import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type DevModeContextType = {
  isDevMode: boolean;
  toggleDevMode: () => void;
};

const DevModeContext = createContext<DevModeContextType>({
  isDevMode: true,
  toggleDevMode: () => {},
});

const STORAGE_KEY = "supremeflex_dev_mode";

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isDevMode));
  }, [isDevMode]);

  const toggleDevMode = () => setIsDevMode((prev) => !prev);

  return (
    <DevModeContext.Provider value={{ isDevMode, toggleDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  return useContext(DevModeContext);
}
