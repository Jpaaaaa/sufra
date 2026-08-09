/** Pure offer domain helpers — shared conceptually between FE and BE. */

export type OfferType = 'daily_deal' | 'combo' | 'scheduled' | 'happy_hour';

/** True when the offer is a multi-line tray (not a single unit of one product). */
export function isMultiProductOffer(
  products?: Array<{ quantity?: number }> | null,
): boolean {
  if (!products || products.length === 0) return false;
  if (products.length > 1) return true;
  return Math.max(1, Math.floor(Number(products[0]?.quantity) || 1)) > 1;
}

export type OfferStatusCode =
  | 'active_now'
  | 'scheduled'
  | 'inactive'
  | 'expired'
  | 'outside_time'
  | 'invalid';

export function isWeekdayIncluded(weekdays: number[] | null | undefined, date: Date = new Date()): boolean {
  if (!weekdays || weekdays.length === 0) return true;
  const set = new Set(weekdays.filter((d) => d >= 0 && d <= 6));
  return set.has(date.getDay());
}

export function timeStringToMinutes(t: string): number {
  const parts = String(t).trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0));
  return h * 60 + m;
}

/** Inclusive; supports overnight (e.g. 22:00–02:00). */
export function isNowInTimeRange(start: string, end: string, now: Date = new Date()): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = timeStringToMinutes(start);
  const b = timeStringToMinutes(end);
  if (a <= b) return cur >= a && cur <= b;
  return cur >= a || cur <= b;
}

export function happyHourCrossesMidnight(start: string, end: string): boolean {
  return timeStringToMinutes(start) > timeStringToMinutes(end);
}

export function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateTimeLocal(raw: string): Date | null {
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface OfferStatusInput {
  type: OfferType;
  isActive: boolean;
  archivedAt?: string | null;
  /** daily deal date YYYY-MM-DD */
  date?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  weekdays?: number[] | null;
}

export function resolveOfferStatus(input: OfferStatusInput, now: Date = new Date()): OfferStatusCode {
  if (input.archivedAt) return 'expired';
  if (!input.isActive) return 'inactive';

  switch (input.type) {
    case 'daily_deal': {
      if (!input.date) return 'invalid';
      const today = toDateOnlyString(now);
      if (input.date === today) return 'active_now';
      if (input.date > today) return 'scheduled';
      return 'expired';
    }
    case 'scheduled': {
      const start = input.startAt ? parseDateTimeLocal(input.startAt) : null;
      const end = input.endAt ? parseDateTimeLocal(input.endAt) : null;
      if (!start || !end || start >= end) return 'invalid';
      if (now < start) return 'scheduled';
      if (now > end) return 'expired';
      return 'active_now';
    }
    case 'happy_hour': {
      if (!input.timeStart || !input.timeEnd) return 'invalid';
      if (!isWeekdayIncluded(input.weekdays, now)) return 'outside_time';
      if (isNowInTimeRange(input.timeStart, input.timeEnd, now)) return 'active_now';
      return 'outside_time';
    }
    case 'combo':
      if (!isWeekdayIncluded(input.weekdays, now)) return 'outside_time';
      return 'active_now';
    default:
      return 'invalid';
  }
}

export function savingsFromPrices(basePrice: number, offerPrice: number): {
  discountAmount: number;
  discountPercent: number;
} {
  const base = Math.max(0, Math.round(basePrice));
  const offer = Math.max(0, Math.round(offerPrice));
  const discountAmount = Math.max(0, base - offer);
  const discountPercent = base > 0 ? Math.round((discountAmount / base) * 1000) / 10 : 0;
  return { discountAmount, discountPercent };
}
