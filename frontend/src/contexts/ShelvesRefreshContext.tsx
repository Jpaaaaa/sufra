'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';

interface ShelvesRefreshContextType {
  triggerRefresh: () => void;
  subscribe: (callback: () => void) => () => void;
}

const ShelvesRefreshContext = createContext<ShelvesRefreshContextType | undefined>(undefined);

let refreshCallbacks: (() => void)[] = [];

export function ShelvesRefreshProvider({ children }: { children: ReactNode }) {
  const triggerRefresh = useCallback(() => {
    refreshCallbacks.forEach((callback) => callback());
  }, []);

  const subscribe = useCallback((callback: () => void) => {
    refreshCallbacks.push(callback);
    return () => {
      refreshCallbacks = refreshCallbacks.filter((cb) => cb !== callback);
    };
  }, []);

  return (
    <ShelvesRefreshContext.Provider value={{ triggerRefresh, subscribe }}>
      {children}
    </ShelvesRefreshContext.Provider>
  );
}

export function useShelvesRefresh() {
  const context = useContext(ShelvesRefreshContext);
  if (context === undefined) {
    throw new Error('useShelvesRefresh must be used within a ShelvesRefreshProvider');
  }
  return context;
}

