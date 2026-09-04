import type { Item } from '../../hooks/useItems';
import type { useOffers } from '../../hooks/useOffers';
import { isWeekdayIncluded } from '../../utils/weekdays';
import { isHappyHourActiveNow, resolveComboOfferPrice } from '../../utils/offer-pricing';
import { OFFERS_CATEGORY_ID } from '../../components/orders/CategoryTabs';
import { isMultiProductOffer } from '@sufra-offers';

type OffersApi = ReturnType<typeof useOffers>;

type BundleSource = {
  id: number;
  name: string;
  price: number;
  pricing_mode?: string;
  products?: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    kitchen_id?: number | null;
  }>;
};

/** Synthetic negative ids: combos keep -id; daily/hh/scheduled use namespaces. */
const DAILY_TRAY_OFFSET = 1_000_000;
const HH_TRAY_OFFSET = 2_000_000;
const SCHED_TRAY_OFFSET = 3_000_000;

function toTrayItem(
  source: BundleSource,
  syntheticId: number,
  menuItems: Item[],
): any {
  const productList = (source.products || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price || 0,
    quantity: Math.max(1, Number(p.quantity) || 1),
    kitchen_id: p.kitchen_id ?? menuItems.find((i) => i.id === p.id)?.kitchen_id ?? null,
  }));
  const contentsTotal = productList.reduce(
    (sum, p) => sum + (p.price || 0) * (p.quantity || 1),
    0,
  );
  return {
    id: syntheticId,
    name: source.name,
    price: source.price,
    categoryId: OFFERS_CATEGORY_ID,
    kitchen_id: null,
    original_price: contentsTotal > source.price ? contentsTotal : undefined,
    is_featured: false,
    _comboProducts: productList,
    _isCombo: true,
    _pricingMode: source.pricing_mode || 'fixed',
  };
}

function labelFromProducts(
  products?: Array<{ name: string; quantity?: number }>,
  fallback = 'عرض',
): string {
  if (!products?.length) return fallback;
  return products
    .map((p) => {
      const q = Math.max(1, Number(p.quantity) || 1);
      return q > 1 ? `${q}× ${p.name}` : p.name;
    })
    .join(' · ');
}

/** Shared Offers-category menu builder for dine-in / pickup / delivery. */
export function buildOffersCategoryItems(
  menuItems: Item[],
  offers: OffersApi,
): Item[] {
  const allOffersItems: any[] = [];

  const activeDailyDeal = offers.getActiveDailyDeal();
  const activeScheduledOffers = offers.getActiveScheduledOffers();
  const activeHappyHours = offers.happyHours.filter(
    (hh) => isHappyHourActiveNow(hh) && !(hh as { archived_at?: string | null }).archived_at,
  );

  const offerItemIds = new Set<number>();
  if (
    activeDailyDeal &&
    !(activeDailyDeal as { archived_at?: string | null }).archived_at &&
    !isMultiProductOffer(activeDailyDeal.products)
  ) {
    offerItemIds.add(activeDailyDeal.product_id);
  }
  activeScheduledOffers.forEach((so) => {
    if (so.product_id && !isMultiProductOffer(so.products) && !so.combo_id) {
      offerItemIds.add(so.product_id);
    }
  });
  activeHappyHours.forEach((hh) => {
    if (!isMultiProductOffer(hh.products)) offerItemIds.add(hh.product_id);
  });

  allOffersItems.push(...menuItems.filter((item) => offerItemIds.has(item.id)));

  // Multi-product daily / happy hour / scheduled as trays
  if (
    activeDailyDeal &&
    !(activeDailyDeal as { archived_at?: string | null }).archived_at &&
    isMultiProductOffer(activeDailyDeal.products)
  ) {
    allOffersItems.push(
      toTrayItem(
        {
          id: activeDailyDeal.id,
          name: labelFromProducts(activeDailyDeal.products, activeDailyDeal.product_name),
          price: activeDailyDeal.special_price,
          pricing_mode: activeDailyDeal.pricing_mode,
          products: activeDailyDeal.products,
        },
        -(DAILY_TRAY_OFFSET + activeDailyDeal.id),
        menuItems,
      ),
    );
  }

  for (const hh of activeHappyHours) {
    if (!isMultiProductOffer(hh.products)) continue;
    allOffersItems.push(
      toTrayItem(
        {
          id: hh.id,
          name: labelFromProducts(hh.products, hh.product_name),
          price: hh.happy_hour_price,
          pricing_mode: hh.pricing_mode,
          products: hh.products,
        },
        -(HH_TRAY_OFFSET + hh.id),
        menuItems,
      ),
    );
  }

  for (const so of activeScheduledOffers) {
    if (!isMultiProductOffer(so.products)) continue;
    allOffersItems.push(
      toTrayItem(
        {
          id: so.id,
          name: labelFromProducts(so.products, so.product_name || so.combo_name),
          price: so.special_price,
          pricing_mode: so.pricing_mode,
          products: so.products,
        },
        -(SCHED_TRAY_OFFSET + so.id),
        menuItems,
      ),
    );
  }

  const activeCombos = offers.combos.filter(
    (c) =>
      c.is_active === 1 &&
      !(c as { archived_at?: string | null }).archived_at &&
      isWeekdayIncluded(c.weekdays),
  );

  const comboItems: any[] = activeCombos.map((combo) => {
    const productList = (
      combo.products?.length
        ? combo.products
        : (combo.product_ids || []).map((pid: number) => {
            const it = menuItems.find((i) => i.id === pid);
            return {
              id: pid,
              name: it?.name ?? '?',
              price: it?.price ?? 0,
              quantity: 1,
              kitchen_id: it?.kitchen_id ?? null,
            };
          })
    ).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price || 0,
      quantity: Math.max(1, Number(p.quantity) || 1),
      kitchen_id: p.kitchen_id ?? menuItems.find((i) => i.id === p.id)?.kitchen_id ?? null,
    }));

    const contentsTotal = productList.reduce(
      (sum: number, p: any) => sum + (p.price || 0) * (p.quantity || 1),
      0,
    );

    const effectivePrice = resolveComboOfferPrice(combo.id, combo.combo_price, {
      getActiveDailyDeal: () => offers.getActiveDailyDeal(),
      getActiveScheduledOffers: () =>
        offers.getActiveScheduledOffers().map((so) => ({
          ...so,
          start_datetime: so.start_datetime,
          end_datetime: so.end_datetime,
        })),
      happyHours: offers.happyHours,
    });

    return {
      id: -combo.id,
      name: combo.combo_name,
      price: effectivePrice,
      categoryId: OFFERS_CATEGORY_ID,
      kitchen_id: null,
      original_price: contentsTotal > effectivePrice ? contentsTotal : undefined,
      is_featured: false,
      _comboProducts: productList,
      _isCombo: true,
      _pricingMode: combo.pricing_mode || 'fixed',
    };
  });
  allOffersItems.push(...comboItems);

  const uniqueItems = Array.from(
    new Map(allOffersItems.map((item) => [item.id, item])).values(),
  );
  uniqueItems.sort((a, b) => {
    const aCombo = a.id < 0;
    const bCombo = b.id < 0;
    if (!aCombo && bCombo) return -1;
    if (aCombo && !bCombo) return 1;
    return a.name.localeCompare(b.name, 'ar');
  });

  return uniqueItems;
}
