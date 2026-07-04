import { isWeekdayIncluded, parseWeekdaysJson } from './weekday-helpers';

function normalizeWeekdaysForMatch(w: string | number[] | null | undefined): number[] | undefined {
  if (w == null) return undefined;
  if (Array.isArray(w)) return w.length ? w : undefined;
  return parseWeekdaysJson(w);
}

function timeStringToMinutes(t: string): number {
  const parts = String(t).trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0));
  return h * 60 + m;
}

function isNowInTimeRange(start: string, end: string, now: Date): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = timeStringToMinutes(start);
  const b = timeStringToMinutes(end);
  if (a <= b) return cur >= a && cur <= b;
  return cur >= a || cur <= b;
}

/** Row من جدول happy_hour أو كائن مُطبَّع */
export function happyHourRowMatchesNow(
  row: { time_start: string; time_end: string; weekdays?: string | number[] | null },
  now: Date = new Date(),
): boolean {
  const wd = normalizeWeekdaysForMatch(row.weekdays);
  if (!isWeekdayIncluded(wd, now)) return false;
  return isNowInTimeRange(row.time_start, row.time_end, now);
}
