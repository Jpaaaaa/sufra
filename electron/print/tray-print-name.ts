/**
 * Presentation-only tray label for thermal prints.
 * Does not change stored trayName / DB values.
 */

export function parseTrayNumberFromPrintName(name?: string | null): number | null {
  if (!name) return null;
  const m = /(?:مجموعة|صينية|Group|کۆمەڵە)\s+(\d+)/.exec(name);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getTrayPrintName(
  trayNumber?: number | null,
  fallbackName?: string | null,
): string {
  const n =
    trayNumber != null && trayNumber > 0
      ? trayNumber
      : parseTrayNumberFromPrintName(fallbackName ?? null);
  if (n != null) return `صينية ${n}`;
  const raw = (fallbackName || '').trim();
  if (raw) {
    return raw.replace(/^مجموعة(\s+)/, 'صينية$1').replace(/^Group(\s+)/i, 'صينية$1');
  }
  return 'صينية';
}
