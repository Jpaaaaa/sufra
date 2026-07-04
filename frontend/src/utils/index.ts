// Re-export server config functions for convenience
export { getServerUrl, getServerConfig, setServerConfig, setServerUrl } from '../lib/server-config';

// Legacy constant - use getServerUrl() instead for dynamic server URL
// Kept for backward compatibility during migration
export const API_BASE_URL = 'http://127.0.0.1:3333';

export interface Hall {
  id: number;
  name: string;
  number: number;
  floor_id?: number | null;
  floor?: {
    id: number;
    name: string;
    number: number;
  } | null;
  tablesCount?: number;
  // Aggregate order flags for this hall based on its tables
  hasPendingOrders?: boolean;
  hasPrintedOrders?: boolean;
}

export interface TableEntity {
  id: number;
  number: number;
  hall_id: number | null;
  name?: string | null;
}

export interface Kitchen {
  id: number;
  name: string;
  description?: string;
  floor_id?: number | null;
  floor?: {
    id: number;
    name: string;
    number: number;
  } | null;
  is_active: boolean;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  // In Electron mode: IPC ONLY - NO HTTP FALLBACK
  if (typeof window !== 'undefined' && typeof input === 'string') {
    const isElectron = typeof window.sufra !== 'undefined';
    
    if (isElectron) {
      // Electron mode: use IPC only
      const { fetchViaIPC } = await import('../lib/ipc-api-client');
      const method = init?.method || 'GET';
      const body = init?.body ? (typeof init.body === 'string' ? JSON.parse(init.body) : init.body) : undefined;
      
      // Extract endpoint from URL (remove server URL if present)
      let endpoint = input;
      if (typeof input === 'string' && input.startsWith('http')) {
        try {
          const url = new URL(input);
          endpoint = url.pathname + url.search;
        } catch {
          // If URL parsing fails, use as-is
        }
      }
      
      try {
        const ipcResult = await fetchViaIPC(endpoint, method, body);
        if (ipcResult !== null) {
          // IPC call succeeded, return result
          return ipcResult as T;
        }
        // If IPC returns null, endpoint may be unmapped or legitimately return null
        const pathOnly = endpoint.split('?')[0].replace(/^\//, '').toLowerCase().replace(/^api\//, '');
        const isShiftsActive = pathOnly === 'shifts/active' || pathOnly === 'api/shifts/active';
        if (method === 'GET' && isShiftsActive) {
          // /shifts/active returns Shift | null, not array
          return null as T;
        }
        // POST /finance/revenue/sync and /finance/cashflow/sync can legitimately return null
        if (method === 'POST' && (pathOnly === 'finance/revenue/sync' || pathOnly === 'finance/cashflow/sync')) {
          return null as T;
        }
        // Endpoint is not mapped
        console.warn(`[fetchJson] IPC endpoint not mapped: ${endpoint} ${method}`);
        if (method === 'GET') {
          // For GET requests, return empty array as fallback
          return [] as T;
        }
        // For other methods, throw error indicating endpoint not implemented
        throw new Error(`Endpoint not implemented via IPC: ${endpoint} ${method}`);
      } catch (error: any) {
        // Handle auth errors
        if (error.message && error.message.includes('Invalid credentials') || error.message.includes('Unauthorized')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sufra_auth_token');
            localStorage.removeItem('sufra_auth_user');
            if (window.location.pathname !== '/login' && window.location.hash !== '#/login') {
              window.location.hash = '#/login';
            }
          }
        }
        throw error;
      }
      // Fall through to HTTP if IPC returned null (for unmapped endpoints)
    }
  }
  
  // Web mode: use HTTP (or fallback from Electron IPC)
  // Import retry utility
  const { fetchWithRetry } = await import('../lib/api-retry');
  
  // Automatically add auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('sufra_auth_token') : null;
  
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Use retry logic for network errors
  const res = await fetchWithRetry(
    input,
    {
      ...init,
      headers,
    },
    {
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 5000,
    }
  );
  
  if (!res.ok) {
    // If unauthorized, clear token and redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sufra_auth_token');
      localStorage.removeItem('sufra_auth_user');
      if (window.location.pathname !== '/login' && window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    
    const text = await res.text().catch(() => '');
    throw new Error(
      `Request failed with status ${res.status}: ${
        text || res.statusText || 'Unknown error'
      }`,
    );
  }
  const text = await res.text();
  if (!text) {
    // No content (e.g. 204 from DELETE/PATCH) – return undefined as T
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('Failed to parse JSON response', err);
    throw err;
  }
}

