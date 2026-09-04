/** Parses globalDiscount from an order (handles string JSON). */
export function parseDiscountFromOrder(order: any): { percent: number; amount: number } | null {
  const d = order.globalDiscount;
  if (!d) return null;
  const parsed = typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch { return null; } })() : d;
  if (parsed?.percent == null || parsed?.amount == null) return null;
  // Use full table discount for UI when available; amount may be a per-order share.
  const amount = parsed.table_discount_total ?? parsed.amount;
  return { percent: parsed.percent, amount };
}

/** Returns orders that have a valid globalDiscount, sorted by created_at desc. */
export function getOrdersWithDiscount(orders: any[]) {
  return orders
    .filter((o) => parseDiscountFromOrder(o))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
