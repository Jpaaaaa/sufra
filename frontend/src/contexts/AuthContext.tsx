'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getServerUrl } from '../lib/server-config';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'sufra_auth_token';
const USER_KEY = 'sufra_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token and user from localStorage
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        // Verify token by calling /auth/me
        verifyToken(storedToken);
      } catch (e) {
        console.error('Failed to parse stored user', e);
        clearAuth();
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      // Use IPC if available (Electron), otherwise use HTTP
      if (window.sufra?.auth?.verifyToken) {
        try {
          const userData = await window.sufra.auth.verifyToken(tokenToVerify);
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          setIsLoading(false);
          return;
        } catch (ipcError: any) {
          console.error('IPC token verification failed', ipcError);
          clearAuth();
          return;
        }
      }
      
      // Fallback to HTTP (for web version)
      // Add timeout to prevent hanging on mobile browsers
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Token verification timeout')), 10000); // 10 second timeout
      });

      const { fetchWithRetry } = await import('../lib/api-retry');
      const serverUrl = getServerUrl();
      
      const fetchPromise = fetchWithRetry(`${serverUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
        },
      }, {
        maxRetries: 2, // Fewer retries for token verification (faster failure on mobile)
        initialDelay: 1000, // Start with 1 second delay
        maxDelay: 3000, // Max 3 seconds between retries
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setIsLoading(false);
        
        // Ensure business day exists on app load (best-effort, don't block)
        ensureBusinessDayExists(tokenToVerify);
      } else {
        // Token invalid, clear auth
        clearAuth();
      }
    } catch (error) {
      console.error('Token verification failed', error);
      // Always clear loading state, even on error
      clearAuth();
    }
  };

  // Ensure a business day exists (prevents orphaned orders)
  const ensureBusinessDayExists = async (accessToken: string) => {
    try {
      console.log('[AUTH] Ensuring business day exists...');

      if (window.sufra?.['business-day']?.ensure) {
        const businessDay = await window.sufra['business-day'].ensure();
        console.log('[AUTH] Business day ensured, ID:', businessDay?.id);
        return;
      }

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/business-day/ensure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (response.ok) {
        const businessDay = await response.json();
        console.log('[AUTH] Business day ensured, ID:', businessDay.id);
      } else {
        console.warn('[AUTH] Failed to ensure business day:', response.status);
      }
    } catch (error) {
      // Don't throw - business day ensure is best-effort
      console.warn('[AUTH] Error ensuring business day:', error);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Use IPC if available (Electron), otherwise use HTTP
      if (window.sufra?.auth?.login) {
        try {
          const data = await window.sufra.auth.login(username, password);
          
          // IPC login returns { access_token, user }
          const accessToken = data.access_token;
          const userData = data.user;

          // Store token and user
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          setToken(accessToken);
          setUser(userData);
          
          // Ensure business day exists (best-effort, don't block login)
          ensureBusinessDayExists(accessToken);
          return;
        } catch (ipcError: any) {
          // Transform IPC errors to user-friendly messages
          if (ipcError.message && ipcError.message.includes('Invalid credentials')) {
            throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
          }
          throw ipcError;
        }
      }
      
      // Fallback to HTTP (for web version)
      const { fetchWithRetry } = await import('../lib/api-retry');
      const serverUrl = getServerUrl();
      
      // Retry login request with exponential backoff
      const response = await fetchWithRetry(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      }, {
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 5000,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Invalid credentials' }));
        throw new Error(error.message || 'Invalid credentials');
      }

      const data = await response.json();
      const accessToken = data.access_token;

      // Get user info with retry
      const userResponse = await fetchWithRetry(`${serverUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }, {
        maxRetries: 3,
        initialDelay: 500,
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();

      // Store token and user
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setToken(accessToken);
      setUser(userData);
      
      // Ensure business day exists (best-effort, don't block login)
      ensureBusinessDayExists(accessToken);
    } catch (error: any) {
      // Transform connection errors to user-friendly messages
      if (error.message && (
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Network request failed')
      )) {
        const serverUrl = getServerUrl();
        throw new Error(`لا يمكن الاتصال بالخادم (${serverUrl}). تأكد من أن التطبيق يعمل على الكمبيوتر الرئيسي.`);
      }
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
    // Use window.location.hash for navigation since AuthProvider is outside Router context
    // HashRouter uses hash-based URLs
    window.location.hash = '#/login';
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

