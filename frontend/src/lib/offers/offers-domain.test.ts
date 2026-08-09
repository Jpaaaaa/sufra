import { describe, expect, it } from 'vitest';
import {
  resolveOfferStatus,
  isNowInTimeRange,
  happyHourCrossesMidnight,
  isWeekdayIncluded,
  savingsFromPrices,
  resolveEffectivePrice,
  mergeComboItems,
  resolveComboPrice,
  sumComboContentsPrice,
} from '@sufra-offers';

describe('resolveOfferStatus', () => {
  const noon = new Date('2026-08-09T12:00:00');

  it('marks archived as expired', () => {
    expect(
      resolveOfferStatus(
        { type: 'combo', isActive: true, archivedAt: '2026-08-01T00:00:00' },
        noon,
      ),
    ).toBe('expired');
  });

  it('daily deal: today / future / past', () => {
    expect(
      resolveOfferStatus(
        { type: 'daily_deal', isActive: true, date: '2026-08-09' },
        noon,
      ),
    ).toBe('active_now');
    expect(
      resolveOfferStatus(
        { type: 'daily_deal', isActive: true, date: '2026-08-10' },
        noon,
      ),
    ).toBe('scheduled');
    expect(
      resolveOfferStatus(
        { type: 'daily_deal', isActive: true, date: '2026-08-08' },
        noon,
      ),
    ).toBe('expired');
  });

  it('scheduled window', () => {
    expect(
      resolveOfferStatus(
        {
          type: 'scheduled',
          isActive: true,
          startAt: '2026-08-09T10:00:00',
          endAt: '2026-08-09T18:00:00',
        },
        noon,
      ),
    ).toBe('active_now');
    expect(
      resolveOfferStatus(
        {
          type: 'scheduled',
          isActive: true,
          startAt: '2026-08-10T10:00:00',
          endAt: '2026-08-10T18:00:00',
        },
        noon,
      ),
    ).toBe('scheduled');
  });

  it('happy hour weekday + time', () => {
    expect(
      resolveOfferStatus(
        {
          type: 'happy_hour',
          isActive: true,
          timeStart: '11:00',
          timeEnd: '14:00',
          weekdays: [0],
        },
        noon,
      ),
    ).toBe('active_now');
    expect(
      resolveOfferStatus(
        {
          type: 'happy_hour',
          isActive: true,
          timeStart: '11:00',
          timeEnd: '14:00',
          weekdays: [1],
        },
        noon,
      ),
    ).toBe('outside_time');
  });

  it('inactive', () => {
    expect(resolveOfferStatus({ type: 'combo', isActive: false }, noon)).toBe('inactive');
  });
});

describe('happy hour time range', () => {
  it('supports overnight windows', () => {
    expect(happyHourCrossesMidnight('22:00', '02:00')).toBe(true);
    const late = new Date('2026-08-09T23:30:00');
    const early = new Date('2026-08-09T01:00:00');
    expect(isNowInTimeRange('22:00', '02:00', late)).toBe(true);
    expect(isNowInTimeRange('22:00', '02:00', early)).toBe(true);
    expect(isNowInTimeRange('22:00', '02:00', new Date('2026-08-09T12:00:00'))).toBe(false);
  });

  it('weekday empty means all days', () => {
    expect(isWeekdayIncluded([], new Date('2026-08-09T12:00:00'))).toBe(true);
    expect(isWeekdayIncluded(null, new Date('2026-08-09T12:00:00'))).toBe(true);
  });
});

describe('resolveEffectivePrice priority', () => {
  const now = new Date('2026-08-09T12:00:00');

  it('Daily → Happy Hour → Scheduled → catalog', () => {
    const daily = {
      product_id: 1,
      special_price: 1000,
      date: '2026-08-09',
      is_active: 1 as const,
    };
    const hh = {
      product_id: 1,
      happy_hour_price: 2000,
      time_start: '10:00',
      time_end: '14:00',
      is_active: 1 as const,
    };
    const scheduled = {
      product_id: 1,
      special_price: 3000,
      start_datetime: '2026-08-09T00:00:00',
      end_datetime: '2026-08-09T23:59:59',
      is_active: 1 as const,
    };

    expect(
      resolveEffectivePrice({
        targetType: 'product',
        targetId: 1,
        catalogPrice: 5000,
        dateTime: now,
        dailyDeals: [daily],
        happyHours: [hh],
        scheduledOffers: [scheduled],
      }).reason,
    ).toBe('daily_deal');

    expect(
      resolveEffectivePrice({
        targetType: 'product',
        targetId: 1,
        catalogPrice: 5000,
        dateTime: now,
        happyHours: [hh],
        scheduledOffers: [scheduled],
      }).effectivePrice,
    ).toBe(2000);

    expect(
      resolveEffectivePrice({
        targetType: 'product',
        targetId: 1,
        catalogPrice: 5000,
        dateTime: now,
        scheduledOffers: [scheduled],
      }).effectivePrice,
    ).toBe(3000);

    expect(
      resolveEffectivePrice({
        targetType: 'product',
        targetId: 1,
        catalogPrice: 5000,
        dateTime: now,
      }).reason,
    ).toBe('catalog');
  });

  it('scheduled combo overrides combo catalog price', () => {
    const r = resolveEffectivePrice({
      targetType: 'combo',
      targetId: 9,
      catalogPrice: 15000,
      dateTime: now,
      scheduledOffers: [
        {
          combo_id: 9,
          special_price: 9999,
          start_datetime: '2026-08-09T00:00:00',
          end_datetime: '2026-08-09T23:59:59',
          is_active: 1,
        },
      ],
    });
    expect(r.effectivePrice).toBe(9999);
    expect(r.reason).toBe('scheduled');
  });

  it('ignores archived offers', () => {
    const r = resolveEffectivePrice({
      targetType: 'product',
      targetId: 1,
      catalogPrice: 5000,
      dateTime: now,
      dailyDeals: [
        {
          product_id: 1,
          special_price: 1000,
          date: '2026-08-09',
          is_active: 1,
          archived_at: '2026-08-01',
        },
      ],
    });
    expect(r.reason).toBe('catalog');
  });
});

describe('combo price', () => {
  it('merges duplicate product ids', () => {
    expect(
      mergeComboItems([
        { product_id: 1, quantity: 2 },
        { product_id: 1, quantity: 3 },
        { product_id: 2, quantity: 1 },
      ]),
    ).toEqual([
      { product_id: 1, quantity: 5 },
      { product_id: 2, quantity: 1 },
    ]);
  });

  it('sum vs fixed', () => {
    const lines = [
      { product_id: 1, quantity: 2, unit_price: 1000 },
      { product_id: 2, quantity: 1, unit_price: 500 },
    ];
    expect(sumComboContentsPrice(lines)).toBe(2500);
    expect(resolveComboPrice({ pricing_mode: 'sum', lines })).toBe(2500);
    expect(resolveComboPrice({ pricing_mode: 'fixed', combo_price: 1999, lines })).toBe(1999);
  });
});

describe('savingsFromPrices', () => {
  it('computes integer-safe discount', () => {
    expect(savingsFromPrices(10000, 7500)).toEqual({
      discountAmount: 2500,
      discountPercent: 25,
    });
  });
});
