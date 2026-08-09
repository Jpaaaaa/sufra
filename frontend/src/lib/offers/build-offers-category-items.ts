import type { Item } from '../../hooks/useItems';
import type { useOffers } from '../../hooks/useOffers';
import { isWeekdayIncluded } from '../../utils/weekdays';
import { isHappyHourActiveNow, resolveComboOfferPrice } from '../../utils/offer-pricing';
import { OFFERS_CATEGORY_ID } from '../../components/orders/CategoryTabs';

type OffersApi = ReturnType<typeof useOffers>;

/** Shared Offers-category menu builder for dine-in / pickup / delivery. */
export function buildOffersCategoryItems(
  menuItems: Item[],
  offers: OffersApi,
): Item[] {
  const allOffersItems: any[] = [];

  const featuredItemIds = new Set(
    offers.featuredItems
      .filter((fi) => !(fi as { archived_at?: string | null }).archived_at)
      .map((fi) => fi.product_id),
  );
  const featuredItems = menuItems.filter((item) => featuredItemIds.has(item.id));
  allOffersItems.push(
    ...featuredItems.map((item) => ({ ...item, is_featured: true })),
  );

  const activeDailyDeal = offers.getActiveDailyDeal();
  const activeScheduledOffers = offers.getActiveScheduledOffers();
  const activeHappyHours = offers.happyHours.filter(
    (hh) => isHappyHourActiveNow(hh) && !(hh as { archived_at?: string | null }).archived_at,
  );

  const offerItemIds = new Set<number>();
  if (activeDailyDeal && !(activeDailyDeal as { archived_at?: string | null }).archived_at) {
    offerItemIds.add(activeDailyDeal.product_id);
  }
  activeScheduledOffers.forEach((so) => {
    if (so.product_id) offerItemIds.add(so.product_id);
  });
  activeHappyHours.forEach((hh) => offerItemIds.add(hh.product_id));

  const offerItems = menuItems.filter(
    (item) => offerItemIds.has(item.id) && !featuredItemIds.has(item.id),
  );
  allOffersItems.push(...offerItems);

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
    const aFeatured = a.is_featured || false;
    const bFeatured = b.is_featured || false;
    const aCombo = a.id < 0;
    const bCombo = b.id < 0;
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;
    if (!aCombo && bCombo) return -1;
    if (aCombo && !bCombo) return 1;
    return a.name.localeCompare(b.name, 'ar');
  });

  return uniqueItems;
}
