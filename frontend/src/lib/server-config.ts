/**
 * Server Configuration Module
 * Manages dynamic server URL configuration for multi-device support
 */

export type ServerMode = 'host' | 'client';

export interface ServerConfig {
  mode: ServerMode;
  serverUrl: string;
}

const STORAGE_KEY = 'sufra_server_config';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:3333';

/**
 * Auto-detect server URL from current browser location
 * Used when accessing from mobile/tablet browsers
 */
function getServerUrlFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const { protocol, hostname } = window.location;
    
    // Only auto-detect if not localhost (mobile/tablet accessing via LAN IP)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // Use the same hostname and protocol
      // API is always on port 3333 (same as the HTTP server serving the frontend)
      return `${protocol}//${hostname}:3333`;
    }
  } catch (error) {
    console.error('Failed to detect server URL from location:', error);
  }

  return null;
}

/**
 * Get the current server URL
 * Falls back to default if no configuration exists
 * Auto-detects from browser location for mobile/tablet access
 */
export function getServerUrl(): string {
  if (typeof window === 'undefined') {
    // SSR fallback
    return process.env.NEXT_PUBLIC_API_URL || DEFAULT_SERVER_URL;
  }

  // Check if running in Electron (IPC mode)
  const isElectron = typeof window.sufra !== 'undefined';
  
  // In Electron, ALWAYS use localhost for socket connections (same machine)
  // Don't use stored LAN IP - socket.io needs to connect to localhost
  if (isElectron) {
    return DEFAULT_SERVER_URL; // Always use http://127.0.0.1:3333 in Electron
  }

  // In browser mode (mobile/tablet): try auto-detection first
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config: ServerConfig = JSON.parse(stored);
      if (config.serverUrl) {
        return config.serverUrl;
      }
    }
    
    // No stored config: auto-detect from current location
    const autoDetected = getServerUrlFromLocation();
    if (autoDetected) {
      // Save auto-detected URL for future use
      try {
        setServerConfig({
          mode: 'client',
          serverUrl: autoDetected,
        });
      } catch (error) {
        // Ignore save errors, just use the detected URL
      }
      return autoDetected;
    }
  } catch (error) {
    console.error('Failed to read server config:', error);
  }

  // Fallback to default (shouldn't happen in browser mode with proper URL)
  return DEFAULT_SERVER_URL;
}

/**
 * Get the full server configuration
 */
export function getServerConfig(): ServerConfig {
  if (typeof window === 'undefined') {
    return {
      mode: 'host',
      serverUrl: process.env.NEXT_PUBLIC_API_URL || DEFAULT_SERVER_URL,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        mode: 'host',
        serverUrl: DEFAULT_SERVER_URL,
      };
    }

    return JSON.parse(stored) as ServerConfig;
  } catch (error) {
    console.error('Failed to read server config:', error);
    return {
      mode: 'host',
      serverUrl: DEFAULT_SERVER_URL,
    };
  }
}

/**
 * Set the server configuration
 */
export function setServerConfig(config: ServerConfig): void {
  if (typeof window === 'undefined') {
    console.warn('Cannot set server config in SSR context');
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    
    // Dispatch custom event for components that need to react to changes
    window.dispatchEvent(new CustomEvent('serverConfigChanged', { detail: config }));
  } catch (error) {
    console.error('Failed to save server config:', error);
    throw new Error('Failed to save server configuration');
  }
}

/**
 * Set only the server URL (preserves mode)
 */
export function setServerUrl(url: string): void {
  const current = getServerConfig();
  setServerConfig({
    ...current,
    serverUrl: url,
  });
}

/**
 * Subscribe to server configuration changes
 * Returns an unsubscribe function
 */
export function subscribeToServerUrlChanges(
  callback: (config: ServerConfig) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: CustomEvent<ServerConfig>) => {
    callback(event.detail);
  };

  window.addEventListener('serverConfigChanged', handler as EventListener);

  return () => {
    window.removeEventListener('serverConfigChanged', handler as EventListener);
  };
}

/**
 * Check if an IP address is a private LAN address
 * Returns true only for:
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * 
 * Returns false for:
 * - Public IPs
 * - APIPA (169.254.x.x)
 * - IPv6 addresses
 * - localhost (127.0.0.1)
 */
export function isPrivateLAN(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // Remove any whitespace
  ip = ip.trim();

  // Reject IPv6 addresses (contain colons)
  if (ip.includes(':')) {
    return false;
  }

  // Reject hostnames (not IPs)
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return false;
  }

  const parts = ip.split('.').map(Number);

  // Validate IP format (4 parts, each 0-255)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 192.168.0.0/16
  if (a === 192 && b === 168) {
    return true;
  }

  // 10.0.0.0/8
  if (a === 10) {
    return true;
  }

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  // Everything else is not private LAN (including 169.254.x.x APIPA, public IPs, etc.)
  return false;
}

/**
 * Extract IP address from a URL or hostname
 * Returns null if not a valid IP
 */
export function extractIPFromHost(host: string): string | null {
  if (!host || typeof host !== 'string') {
    return null;
  }

  host = host.trim();

  // Check if it's already an IP
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host;
  }

  // Try to extract from URL
  try {
    const url = new URL(host.startsWith('http') ? host : `http://${host}`);
    const hostname = url.hostname;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return hostname;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

/**
 * Detect local IPv4 address (for host mode)
 * Returns object with ip and warning if not private LAN
 */
export interface DetectIPResult {
  ip: string | null;
  warning?: 'NOT_LAN' | 'DETECTION_FAILED';
}

export async function detectLocalIP(): Promise<DetectIPResult> {
  return new Promise((resolve) => {
    // Try using RTCPeerConnection to detect local IP
    const RTCPeerConnection = 
      (window as any).RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection;

    if (!RTCPeerConnection) {
      resolve({ ip: null, warning: 'DETECTION_FAILED' });
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.createDataChannel('');

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        // Match IPv4 addresses
        const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (ipMatch) {
          const ip = ipMatch[0];
          // Filter out localhost and invalid IPs
          if (ip !== '127.0.0.1' && ip !== '0.0.0.0') {
            pc.close();
            
            // Validate if it's a private LAN IP
            if (isPrivateLAN(ip)) {
              resolve({ ip });
            } else {
              resolve({ ip: null, warning: 'NOT_LAN' });
            }
            return;
          }
        }
      }
    };

    pc.createOffer()
      .then((offer: RTCSessionDescriptionInit) => pc.setLocalDescription(offer))
      .catch(() => {
        pc.close();
        resolve({ ip: null, warning: 'DETECTION_FAILED' });
      });

    // Timeout after 3 seconds
    setTimeout(() => {
      pc.close();
      resolve({ ip: null, warning: 'DETECTION_FAILED' });
    }, 3000);
  });
}

/**
 * Test connection to a server URL
 */
export async function testServerConnection(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use health endpoint for connection testing
    const testUrl = `${url}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `Server returned status ${response.status}`,
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Connection timeout',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to connect to server',
    };
  }
}

