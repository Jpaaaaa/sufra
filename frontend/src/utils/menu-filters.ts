import type { Item } from '../hooks/useItems';
import type { Category } from '../hooks/useCategories';

export function normalizeCategoryRow(c: any): Category {
  return {
    id: c.id,
    name: c.name,
    sort_order: c.sort_order ?? c.id,
    item_count: Number(c.item_count ?? 0),
    is_menu_active: c.is_menu_active !== 0 && c.is_menu_active !== false,
  };
}

export function normalizeItemRow(i: any): Item {
  return {
    ...i,
    hidden_from_menu: Boolean(i.hidden_from_menu),
    is_out_of_stock: Boolean(i.is_out_of_stock),
    has_options: Boolean(i.has_options),
    option_groups: i.option_groups ?? [],
  };
}

export function filterCategoriesForMenu<T extends { is_menu_active: boolean }>(cats: T[]): T[] {
  return cats.filter((c) => c.is_menu_active);
}

export function filterItemsForMenu<T extends { categoryId?: number | null; hidden_from_menu?: boolean }>(
  list: T[],
  activeCategoryIds: Set<number>,
): T[] {
  return list.filter((i) => {
    if (i.hidden_from_menu) return false;
    if (i.categoryId != null && !activeCategoryIds.has(i.categoryId)) return false;
    return true;
  });
}

/** POS: show every category tab; inactive ones styled in CategoryTabs. */
export function sortCategoriesForOrderMenu<T extends { sort_order?: number; id: number }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
}
