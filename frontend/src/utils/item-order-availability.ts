import type { Item } from '../hooks/useItems';

export type UnavailableReason = 'stock' | 'hidden' | 'category_inactive';

export function getItemOrderAvailability(
  item: Item,
  categoryMenuActiveById: Map<number, boolean> | undefined,
): { available: boolean; reason: UnavailableReason | null } {
  if (item.is_out_of_stock) return { available: false, reason: 'stock' };
  if (item.hidden_from_menu) return { available: false, reason: 'hidden' };
  const cid = item.categoryId;
  if (cid != null && categoryMenuActiveById?.has(cid)) {
    const active = categoryMenuActiveById.get(cid);
    if (active === false) return { available: false, reason: 'category_inactive' };
  }
  return { available: true, reason: null };
}

export function toastMessageForUnavailable(reason: UnavailableReason): string {
  switch (reason) {
    case 'stock':
      return 'هذا الصنف غير متوفر (نفد المخزون)';
    case 'hidden':
      return 'هذا الصنف غير متوفر للطلب';
    case 'category_inactive':
      return 'الفئة غير متاحة للطلب حالياً';
    default:
      return 'هذا الصنف غير متوفر للطلب';
  }
}

/** Build from categories list (API / normalized rows). */
export function buildCategoryMenuActiveMap(
  categories: ReadonlyArray<{ id: number; is_menu_active?: boolean | number }>,
): Map<number, boolean> {
  const m = new Map<number, boolean>();
  for (const c of categories) {
    const v = c.is_menu_active;
    m.set(c.id, v !== false && v !== 0);
  }
  return m;
}
