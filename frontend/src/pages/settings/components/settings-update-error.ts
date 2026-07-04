import type { TFunction } from 'i18next';

/** Map noisy electron-updater errors to a short localized line (e.g. missing latest.yml on platform). */
export function humanizeUpdateErrorMessage(raw: string | null | undefined, t: TFunction): string | null {
  if (!raw?.trim()) return null;
  const low = raw.toLowerCase();
  if (
    low.includes('404') &&
    (low.includes('latest.yml') || low.includes('latest-mac.yml') || low.includes('/updates/'))
  ) {
    return t('settings.updatesErrManifest404');
  }
  if (low.includes('enetunreach') || low.includes('econnrefused') || low.includes('network error')) {
    return t('settings.updatesErrNetwork');
  }
  return null;
}
