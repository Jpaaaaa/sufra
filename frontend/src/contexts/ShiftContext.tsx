'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getServerUrl, fetchJson } from '../utils';

export interface Shift {
  id: number;
  started_by: number;
  ended_by: number | null;
  start_time: string;
  end_time: string | null;
  status: 'open' | 'closed';
  total_sales: number;
  total_orders: number;
  total_items_sold: number;
  payment_breakdown: string | null;
  created_at: string;
}

interface ShiftContextType {
  activeShift: Shift | null;
  isLoading: boolean;
  isShiftOpen: boolean;
  refreshShift: () => Promise<void>;
  openShift: () => Promise<Shift>;
  closeShift: () => Promise<Shift>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated, user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveShift = useCallback(async () => {
    if (!token) {
      setActiveShift(null);
      setIsLoading(false);
      return;
    }

    try {
      const serverUrl = getServerUrl();
      const shift = await fetchJson<Shift | null>(`${serverUrl}/shifts/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveShift(shift);
    } catch (error) {
      // No active shift or error - this is normal when no shift is open
      setActiveShift(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Fetch shift on mount and when token changes
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchActiveShift();
    } else {
      setActiveShift(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, token, fetchActiveShift]);

  // Refresh shift status when window regains focus to catch external changes
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const handleFocus = () => {
      // Debounce focus events - don't refresh too frequently
      fetchActiveShift();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, token, fetchActiveShift]);

  const refreshShift = async () => {
    setIsLoading(true);
    await fetchActiveShift();
  };

  const openShift = async (): Promise<Shift> => {
    if (!token || !user) {
      throw new Error('Not authenticated');
    }

    const serverUrl = getServerUrl();
    const newShift = await fetchJson<Shift>(`${serverUrl}/shifts/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    });

    setActiveShift(newShift);
    return newShift;
  };

  const closeShift = async (): Promise<Shift> => {
    if (!token || !user) {
      throw new Error('Not authenticated');
    }

    const serverUrl = getServerUrl();
    
    try {
      const closedShift = await fetchJson<Shift>(`${serverUrl}/shifts/finish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      setActiveShift(null);
      return closedShift;
    } catch (error: any) {
      // If backend says no active shift, sync our state with backend
      const errorMessage = error?.message || '';
      if (errorMessage.includes('No active shift') || errorMessage.includes('no active shift')) {
        console.warn('[ShiftContext] Backend says no active shift - syncing state');
        setActiveShift(null);
      }
      throw error;
    }
  };

  const value: ShiftContextType = {
    activeShift,
    isLoading,
    isShiftOpen: activeShift !== null,
    refreshShift,
    openShift,
    closeShift,
  };

  return (
    <ShiftContext.Provider value={value}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
}

/**
 * Hook to check if orders can be created.
 * Returns true if a shift is open, false otherwise.
 */
export function useCanCreateOrders(): boolean {
  const { isShiftOpen, isLoading } = useShift();
  // While loading, assume orders can be created to avoid blocking UI
  if (isLoading) return true;
  return isShiftOpen;
}
