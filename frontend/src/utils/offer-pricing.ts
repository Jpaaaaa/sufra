import type { Item } from '../hooks/useItems';
import type { HappyHour } from '../hooks/useOffers';
import { resolveEffectivePrice, isNowInTimeRange, isWeekdayIncluded } from '../lib/offers';

export { timeStringToMinutes, isNowInTimeRange } from '../lib/offers';

export function isHappyHourActiveNow(hh: HappyHour, now?: Date): boolean {
  if (hh.is_active !== 1) return false;
  if ((hh as { archived_at?: string | null }).archived_at) return false;
  const d = now ?? new Date();
  if (!isWeekdayIncluded(hh.weekdays, d)) return false;
  return isNowInTimeRange(hh.time_start, hh.time_end, d);
}

export interface OffersForPricing {
  getActiveDailyDeal: () =>
    | { id?: number; product_id: number; special_price: number; archived_at?: string | null }
    | undefined;
  getActiveScheduledOffers: () => Array<{
    id?: number;
    product_id: number | null | undefined;
    combo_id?: number | null;
    special_price: number;
    start_datetime?: string;
    end_datetime?: string;
    is_active?: number;
    archived_at?: string | null;
  }>;
  happyHours: HappyHour[];
  dailyDeals?: Array<{
    id: number;
    product_id: number;
    special_price: number;
    date: string;
    is_active?: number;
    archived_at?: string | null;
  }>;
}

/**
 * Applies active offers. Priority: daily → happy hour → scheduled → catalog.
 */
export function enrichItemWithOffers(item: Item, offers: OffersForPricing | undefined): Item {
  if (!offers) return item;
  if (item.id < 0 || (item as { _isCombo?: boolean })._isCombo) return item;
  if (item.id >= 1_000_000) return item;

  const daily = offers.getActiveDailyDeal();
  const result = resolveEffectivePrice({
    targetType: 'product',
    targetId: item.id,
    catalogPrice: item.original_price ?? item.price,
    dailyDeals: daily
      ? [
          {
            product_id: daily.product_id,
            special_price: daily.special_price,
            date: new Date().toISOString().slice(0, 10),
            is_active: 1,
            archived_at: daily.archived_at,
          },
        ]
      : offers.dailyDeals,
    happyHours: offers.happyHours.map((h) => ({
      product_id: h.product_id,
      happy_hour_price: h.happy_hour_price,
      time_start: h.time_start,
      time_end: h.time_end,
      weekdays: h.weekdays,
      is_active: h.is_active,
      archived_at: (h as { archived_at?: string | null }).archived_at,
    })),
    scheduledOffers: offers.getActiveScheduledOffers().map((so) => ({
      product_id: so.product_id,
      combo_id: so.combo_id,
      special_price: so.special_price,
      start_datetime: so.start_datetime || '1970-01-01T00:00:00',
      end_datetime: so.end_datetime || '2999-12-31T23:59:59',
      is_active: so.is_active ?? 1,
      archived_at: so.archived_at,
    })),
  });

  if (result.reason === 'catalog' || result.effectivePrice === result.basePrice) {
    return item;
  }
  return { ...item, price: result.effectivePrice, original_price: result.basePrice };
}

/** Effective combo tile/tray price including active scheduled override. */
export function resolveComboOfferPrice(
  comboId: number,
  comboPrice: number,
  offers: OffersForPricing | undefined,
  now = new Date(),
): number {
  if (!offers) return comboPrice;
  const scheduled = offers.getActiveScheduledOffers();
  const result = resolveEffectivePrice({
    targetType: 'combo',
    targetId: comboId,
    catalogPrice: comboPrice,
    dateTime: now,
    scheduledOffers: scheduled.map((so) => ({
      product_id: so.product_id,
      combo_id: so.combo_id,
      special_price: so.special_price,
      start_datetime: so.start_datetime || now.toISOString(),
      end_datetime: so.end_datetime || now.toISOString(),
      is_active: so.is_active ?? 1,
      archived_at: so.archived_at,
    })),
  });
  return result.effectivePrice;
}
