import type { Category } from '../hooks/useCategories';
import type { Item } from '../hooks/useItems';

/** Inactive / hidden-from-menu categories first, then by saved order. */
export function sortCategoriesAdminDisplay(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const aOff = a.is_menu_active ? 1 : 0;
    const bOff = b.is_menu_active ? 1 : 0;
    if (aOff !== bOff) return aOff - bOff;
    return a.sort_order - b.sort_order || a.id - b.id;
  });
}

/** Hidden or out-of-stock items first, then Arabic name. */
export function sortItemsAdminDisplay(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const aUnavail =
      !!(a.hidden_from_menu || a.is_out_of_stock) ? 0 : 1;
    const bUnavail =
      !!(b.hidden_from_menu || b.is_out_of_stock) ? 0 : 1;
    if (aUnavail !== bUnavail) return aUnavail - bUnavail;
    return a.name.localeCompare(b.name, 'ar');
  });
}
