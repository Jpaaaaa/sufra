import type { Item } from '../hooks/useItems';
import type { HappyHour } from '../hooks/useOffers';
import { isWeekdayIncluded } from './weekdays';

/** Parse "HH:MM" or "HH:MM:SS" to minutes from midnight. */
export function timeStringToMinutes(t: string): number {
  const parts = String(t).trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0));
  return h * 60 + m;
}

/** Inclusive range; supports overnight (e.g. 22:00–02:00). */
export function isNowInTimeRange(start: string, end: string, now: Date = new Date()): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = timeStringToMinutes(start);
  const b = timeStringToMinutes(end);
  if (a <= b) return cur >= a && cur <= b;
  return cur >= a || cur <= b;
}

export function isHappyHourActiveNow(hh: HappyHour, now?: Date): boolean {
  if (hh.is_active !== 1) return false;
  const d = now ?? new Date();
  if (!isWeekdayIncluded(hh.weekdays, d)) return false;
  return isNowInTimeRange(hh.time_start, hh.time_end, d);
}

export interface OffersForPricing {
  getActiveDailyDeal: () => { product_id: number; special_price: number } | undefined;
  getActiveScheduledOffers: () => Array<{ product_id: number | null | undefined; special_price: number }>;
  happyHours: HappyHour[];
}

/**
 * Applies active daily deal / happy hour / scheduled price to a menu item so the card and cart use offer price.
 * Priority matches ItemSelector: daily deal → happy hour → scheduled.
 */
export function enrichItemWithOffers(item: Item, offers: OffersForPricing | undefined): Item {
  if (!offers) return item;
  if (item.id < 0 || (item as { _isCombo?: boolean })._isCombo) return item;
  if (item.id >= 1_000_000) return item;

  const basePrice = item.price;

  const daily = offers.getActiveDailyDeal();
  if (daily && daily.product_id === item.id) {
    if (daily.special_price === basePrice) return { ...item };
    return { ...item, price: daily.special_price, original_price: basePrice };
  }

  const hh = offers.happyHours.find((h) => h.product_id === item.id && isHappyHourActiveNow(h));
  if (hh) {
    if (hh.happy_hour_price === basePrice) return { ...item };
    return { ...item, price: hh.happy_hour_price, original_price: basePrice };
  }

  const scheduled = offers.getActiveScheduledOffers().find((so) => so.product_id === item.id);
  if (scheduled) {
    if (scheduled.special_price === basePrice) return { ...item };
    return { ...item, price: scheduled.special_price, original_price: basePrice };
  }

  return item;
}
