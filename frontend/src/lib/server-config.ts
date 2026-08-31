/**
 * Server Configuration Module
 * Manages dynamic server URL configuration for multi-device support
 */

export type ServerMode = 'host' | 'client';

export interface ServerConfig {
  mode: ServerMode;
  serverUrl: string;
}

/** LAN API port (Fastify). */
export const LAN_API_PORT = 3333;

/** Previous migration port — auto-upgraded when reading stored config. */
const PREVIOUS_LAN_PORT = 3334;

const STORAGE_KEY = 'sufra_server_config';
const DEFAULT_SERVER_URL = `http://127.0.0.1:${LAN_API_PORT}`;

/** Upgrade stored URLs from the temporary Phase 2 port 3334 back to 3333. */
function migrateServerUrl(url: string): string {
  if (url.includes(`:${PREVIOUS_LAN_PORT}`)) {
    return url.replace(`:${PREVIOUS_LAN_PORT}`, `:${LAN_API_PORT}`);
  }
  return url;
}

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
      return `${protocol}//${hostname}:${LAN_API_PORT}`;
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
    return process.env.NEXT_PUBLIC_API_URL || DEFAULT_SERVER_URL;
  }

  const isElectron = typeof window.sufra !== 'undefined';

  // Electron desktop: always localhost on the Fastify LAN port
  if (isElectron) {
    return DEFAULT_SERVER_URL;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config: ServerConfig = JSON.parse(stored);
      if (config.serverUrl) {
        const migrated = migrateServerUrl(config.serverUrl);
        if (migrated !== config.serverUrl) {
          setServerConfig({ ...config, serverUrl: migrated });
        }
        return migrated;
      }
    }

    const autoDetected = getServerUrlFromLocation();
    if (autoDetected) {
      try {
        setServerConfig({
          mode: 'client',
          serverUrl: autoDetected,
        });
      } catch {
        // Ignore save errors, just use the detected URL
      }
      return autoDetected;
    }
  } catch (error) {
    console.error('Failed to read server config:', error);
  }

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

    const config = JSON.parse(stored) as ServerConfig;
    const migrated = migrateServerUrl(config.serverUrl);
    if (migrated !== config.serverUrl) {
      const updated = { ...config, serverUrl: migrated };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return config;
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...config,
        serverUrl: migrateServerUrl(config.serverUrl),
      }),
    );

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
    serverUrl: migrateServerUrl(url),
  });
}

/**
 * Subscribe to server configuration changes
 * Returns an unsubscribe function
 */
export function subscribeToServerUrlChanges(
  callback: (config: ServerConfig) => void,
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

  ip = ip.trim();

  if (ip.includes(':')) {
    return false;
  }

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return false;
  }

  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 10) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

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

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host;
  }

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

export interface LanAddressInfo {
  kind: 'wifi' | 'ethernet' | 'other';
  name: string;
  ipv4: string;
  url: string;
}

export interface LanAddressesResult {
  wifi: LanAddressInfo | null;
  ethernet: LanAddressInfo | null;
  other: LanAddressInfo[];
}

export async function getLanAddresses(): Promise<LanAddressesResult | null> {
  if (typeof window === 'undefined' || !window.sufra?.settings?.getLanAddresses) {
    return null;
  }
  try {
    return await window.sufra.settings.getLanAddresses();
  } catch (error) {
    console.error('Failed to list LAN addresses:', error);
    return null;
  }
}

export function preferredLanAddress(addrs: LanAddressesResult): LanAddressInfo | null {
  return addrs.ethernet ?? addrs.wifi ?? addrs.other[0] ?? null;
}

export async function detectLocalIP(): Promise<DetectIPResult> {
  const lan = await getLanAddresses();
  if (lan) {
    const preferred = preferredLanAddress(lan);
    if (preferred) {
      return { ip: preferred.ipv4 };
    }
    return { ip: null, warning: 'DETECTION_FAILED' };
  }

  return new Promise((resolve) => {
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
        const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (ipMatch) {
          const ip = ipMatch[0];
          if (ip !== '127.0.0.1' && ip !== '0.0.0.0') {
            pc.close();

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

    setTimeout(() => {
      pc.close();
      resolve({ ip: null, warning: 'DETECTION_FAILED' });
    }, 3000);
  });
}

/**
 * Test connection to a server URL
 */
export async function testServerConnection(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const testUrl = `${migrateServerUrl(url)}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
    }

    return {
      success: false,
      error: `Server returned status ${response.status}`,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Connection timeout',
      };
    }
    return {
      success: false,
      error: err.message || 'Failed to connect to server',
    };
  }
}
