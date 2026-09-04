import {
  isNowInTimeRange,
  isWeekdayIncluded,
  savingsFromPrices,
  toDateOnlyString,
  parseDateTimeLocal,
  isMultiProductOffer,
} from './offer-domain';

export type OfferTargetType = 'product' | 'combo';

export interface PricingProductRef {
  quantity?: number;
}

export interface PricingDailyDeal {
  product_id: number;
  special_price: number;
  date: string;
  is_active?: number;
  archived_at?: string | null;
  products?: PricingProductRef[];
}

export interface PricingHappyHour {
  product_id: number;
  happy_hour_price: number;
  time_start: string;
  time_end: string;
  weekdays?: number[] | null;
  is_active?: number;
  archived_at?: string | null;
  products?: PricingProductRef[];
}

export interface PricingScheduled {
  product_id?: number | null;
  combo_id?: number | null;
  special_price: number;
  start_datetime: string;
  end_datetime: string;
  is_active?: number;
  archived_at?: string | null;
  products?: PricingProductRef[];
}

export interface ResolveOfferPriceInput {
  targetType: OfferTargetType;
  targetId: number;
  catalogPrice: number;
  dateTime?: Date;
  dailyDeals?: PricingDailyDeal[];
  happyHours?: PricingHappyHour[];
  scheduledOffers?: PricingScheduled[];
}

export type OfferPriceReason = 'daily_deal' | 'happy_hour' | 'scheduled' | 'catalog';

export interface ResolveOfferPriceResult {
  basePrice: number;
  effectivePrice: number;
  offerId?: number;
  offerType?: OfferPriceReason;
  discountAmount: number;
  discountPercent: number;
  reason: OfferPriceReason;
}

function isActiveFlag(v: number | undefined): boolean {
  return v === undefined || v === 1;
}

function notArchived(archived_at?: string | null): boolean {
  return !archived_at;
}

/**
 * Product priority: Daily → Happy Hour → Scheduled → catalog.
 * Multi-product trays are excluded (POS shows them as locked trays).
 * Combo: only scheduled overrides combo base (catalogPrice = combo_price).
 */
export function resolveEffectivePrice(input: ResolveOfferPriceInput): ResolveOfferPriceResult {
  const now = input.dateTime ?? new Date();
  const basePrice = Math.max(0, Math.round(Number(input.catalogPrice) || 0));

  const finish = (
    effectivePrice: number,
    reason: OfferPriceReason,
    meta?: { offerId?: number; offerType?: OfferPriceReason },
  ): ResolveOfferPriceResult => {
    const { discountAmount, discountPercent } = savingsFromPrices(basePrice, effectivePrice);
    return {
      basePrice,
      effectivePrice,
      discountAmount,
      discountPercent,
      reason,
      offerId: meta?.offerId,
      offerType: meta?.offerType ?? reason,
    };
  };

  if (input.targetType === 'combo') {
    const scheduled = (input.scheduledOffers ?? []).find((so) => {
      if (!isActiveFlag(so.is_active) || !notArchived(so.archived_at)) return false;
      if (so.combo_id !== input.targetId) return false;
      const start = parseDateTimeLocal(so.start_datetime);
      const end = parseDateTimeLocal(so.end_datetime);
      if (!start || !end) return false;
      return now >= start && now <= end;
    });
    if (scheduled) {
      return finish(Math.round(scheduled.special_price), 'scheduled', {
        offerType: 'scheduled',
      });
    }
    return finish(basePrice, 'catalog');
  }

  // Product
  const today = toDateOnlyString(now);
  const daily = (input.dailyDeals ?? []).find(
    (d) =>
      d.product_id === input.targetId &&
      d.date === today &&
      isActiveFlag(d.is_active) &&
      notArchived(d.archived_at) &&
      !isMultiProductOffer(d.products),
  );
  if (daily) {
    return finish(Math.round(daily.special_price), 'daily_deal');
  }

  const hh = (input.happyHours ?? []).find((h) => {
    if (h.product_id !== input.targetId) return false;
    if (!isActiveFlag(h.is_active) || !notArchived(h.archived_at)) return false;
    if (isMultiProductOffer(h.products)) return false;
    if (!isWeekdayIncluded(h.weekdays, now)) return false;
    return isNowInTimeRange(h.time_start, h.time_end, now);
  });
  if (hh) {
    return finish(Math.round(hh.happy_hour_price), 'happy_hour');
  }

  const scheduled = (input.scheduledOffers ?? []).find((so) => {
    if (!isActiveFlag(so.is_active) || !notArchived(so.archived_at)) return false;
    if (so.product_id !== input.targetId) return false;
    if (isMultiProductOffer(so.products)) return false;
    const start = parseDateTimeLocal(so.start_datetime);
    const end = parseDateTimeLocal(so.end_datetime);
    if (!start || !end) return false;
    return now >= start && now <= end;
  });
  if (scheduled) {
    return finish(Math.round(scheduled.special_price), 'scheduled');
  }

  return finish(basePrice, 'catalog');
}
