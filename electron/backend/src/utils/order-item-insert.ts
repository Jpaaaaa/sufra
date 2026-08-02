/** Shelf lines use shelf_item_id; item_id is null (no menu items FK). */
export function resolveOrderItemInsertId(
  itemId: number | null | undefined,
  shelfItemId: number | null | undefined,
): number | null {
  if (shelfItemId != null && shelfItemId > 0) return null;
  return itemId ?? null;
}
