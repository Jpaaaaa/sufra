import i18n from '../i18n';

/** Matches JavaScript Date.getDay(): 0 = Sunday … 6 = Saturday */
export const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

/** If empty or undefined = all weekdays */
export function isWeekdayIncluded(weekdays: number[] | null | undefined, date: Date = new Date()): boolean {
  if (!weekdays || weekdays.length === 0) return true;
  const set = new Set(weekdays.filter((d) => d >= 0 && d <= 6));
  return set.has(date.getDay());
}

export function formatWeekdaysOffer(weekdays: number[] | null | undefined): string {
  if (!weekdays || weekdays.length === 0) return i18n.t('offers.weekdaysAll');
  const sorted = [...new Set(weekdays.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
  const sep = i18n.t('offers.weekdayListSep');
  return sorted.map((v) => i18n.t(`offers.weekday${v}`)).join(sep);
}

/** @deprecated Use formatWeekdaysOffer — kept for gradual migration */
export function formatWeekdaysAr(weekdays: number[] | null | undefined): string {
  return formatWeekdaysOffer(weekdays);
}

export function parseWeekdaysJson(raw: unknown): number[] | undefined {
  if (raw == null || raw === '') return undefined;
  if (Array.isArray(raw)) {
    const n = raw.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 6);
    return n.length ? n : undefined;
  }
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw) as unknown;
      return parseWeekdaysJson(arr);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
