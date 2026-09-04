/** Restaurant-facing daily ticket number; falls back to DB id for legacy rows. */
export function orderDisplayNumber(order: {
  id: number;
  display_number?: number | null;
}): number {
  const n = Number(order.display_number);
  if (Number.isFinite(n) && n > 0) return n;
  return order.id;
}

export function formatOrderDisplayLabel(order: {
  id: number;
  display_number?: number | null;
}): string {
  return `#${orderDisplayNumber(order)}`;
}
