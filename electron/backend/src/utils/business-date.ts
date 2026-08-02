export const DEFAULT_SHIFT_START = '18:00';
export const DEFAULT_SHIFT_END = '03:00';
export const DEFAULT_BUSINESS_DAY_START = '03:00';

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidHHmm(value: string): boolean {
  return HH_MM.test(value);
}

/** Parse minutes since midnight from "HH:mm" or "HH:mm:ss". */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Subtract one calendar day from YYYY-MM-DD. */
function previousDate(datePart: string): string {
  const d = new Date(`${datePart}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Compute business date from a local timestamp and shift start cutoff.
 * createdAt: SQLite localtime "YYYY-MM-DD HH:MM:SS" (or ISO-like with T).
 */
export function computeBusinessDate(
  createdAt: string,
  shiftStartTime: string = DEFAULT_SHIFT_START,
): string {
  const normalized = createdAt.replace('T', ' ').replace('Z', '');
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  const minutes = timeToMinutes(timePart);
  const startMinutes = timeToMinutes(shiftStartTime);

  if (minutes >= startMinutes) return datePart;
  return previousDate(datePart);
}

/** Current local timestamp as SQLite-style string. */
export function getLocalNowString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

export function getCurrentBusinessDate(
  shiftStartTime: string = DEFAULT_SHIFT_START,
): string {
  return computeBusinessDate(getLocalNowString(), shiftStartTime);
}
