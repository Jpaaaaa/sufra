/** User-facing product name — keep identical in UI, print, PDF, and window title. */
export const APP_BRAND_NAME = 'sufra pos';

/** Build-time version from Vite (`electron/package.json`). Prefer `resolveAppVersion()` at runtime. */
export function getBuildAppVersion(): string {
  const fromEnv = import.meta.env.VITE_APP_VERSION;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return '0.0.0';
}

/**
 * Prefer Electron/`/health` version when available (matches installed build);
 * otherwise use the Vite-injected package version.
 */
export async function resolveAppVersion(): Promise<string> {
  try {
    const { getServerUrl, fetchJson } = await import('../utils');
    const data = await fetchJson<{ electron?: { version?: string }; version?: string }>(
      `${getServerUrl()}/health`,
    );
    const fromHealth = data?.electron?.version || data?.version;
    if (typeof fromHealth === 'string' && fromHealth.trim()) return fromHealth.trim();
  } catch {
    // offline / web fallback
  }
  return getBuildAppVersion();
}
