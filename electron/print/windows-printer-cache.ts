import type { WindowsPrinterInfo } from './windows-spooler-worker';

const LIST_TTL_MS = 120_000;

let cachedList: WindowsPrinterInfo[] | null = null;
let cachedListAt = 0;
const resolvedNames = new Map<string, string>();

export function getCachedWindowsPrinterList(): WindowsPrinterInfo[] | null {
  if (!cachedList) return null;
  if (Date.now() - cachedListAt > LIST_TTL_MS) {
    cachedList = null;
    return null;
  }
  return cachedList;
}

export function setCachedWindowsPrinterList(list: WindowsPrinterInfo[]): void {
  cachedList = list;
  cachedListAt = Date.now();
}

export function invalidateWindowsPrinterCache(): void {
  cachedList = null;
  cachedListAt = 0;
  resolvedNames.clear();
}

/**
 * Resolve a user-facing printer name to an installed queue name (exact / case-insensitive).
 * Falls back to the input name if list is unavailable.
 */
export function resolveWindowsPrinterName(
  requested: string,
  list?: WindowsPrinterInfo[] | null,
): string {
  const name = (requested || '').trim();
  if (!name) return '';

  const cached = resolvedNames.get(name.toLowerCase());
  if (cached) return cached;

  const printers = list ?? getCachedWindowsPrinterList();
  if (!printers || printers.length === 0) {
    return name;
  }

  const exact = printers.find((p) => p.name === name);
  if (exact) {
    resolvedNames.set(name.toLowerCase(), exact.name);
    return exact.name;
  }

  const lower = name.toLowerCase();
  const ci = printers.find((p) => p.name.toLowerCase() === lower);
  if (ci) {
    resolvedNames.set(name.toLowerCase(), ci.name);
    return ci.name;
  }

  // Prefix match: "POS-80" vs "POS-80 — USB001"
  const prefix = printers.find(
    (p) =>
      p.name.toLowerCase().startsWith(lower) ||
      lower.startsWith(p.name.toLowerCase()),
  );
  if (prefix) {
    resolvedNames.set(name.toLowerCase(), prefix.name);
    return prefix.name;
  }

  resolvedNames.set(name.toLowerCase(), name);
  return name;
}

export function rememberResolvedPrinterName(requested: string, actual: string): void {
  if (!requested?.trim() || !actual?.trim()) return;
  resolvedNames.set(requested.trim().toLowerCase(), actual.trim());
}
