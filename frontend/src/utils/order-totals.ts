import { parseDiscountFromOrder } from '../hooks/useOrderModalDiscountUtils';

/** Reconstruct receipt totals from stored order values (avoids drift if catalog prices change). */
export function getOrderReceiptTotals(order: {
  total: number;
  discount?: number;
  globalDiscount?: unknown;
  items: Array<{ price?: number; quantity?: number }>;
}) {
  const parsedDiscount = parseOrderDiscountForReceipt(order);
  const discountAmount = parsedDiscount?.amount ?? 0;
  const subtotal = (order.total || 0) + discountAmount;

  return {
    subtotal,
    discount: order.discount || 0,
    globalDiscount: parsedDiscount,
    total: order.total || subtotal,
  };
}

/** Per-order discount share for receipts (uses proportional amount). */
export function parseOrderDiscountForReceipt(order: {
  globalDiscount?: unknown;
}): { percent: number; amount: number } | null {
  const tableDiscount = parseDiscountFromOrder(order);
  if (!tableDiscount) return null;

  const raw = order.globalDiscount;
  const parsed = typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
    : raw;

  // For receipts show this order's deducted share, not the full table discount.
  const amount = parsed?.table_discount_total != null ? parsed.amount : tableDiscount.amount;

  return {
    percent: tableDiscount.percent,
    amount,
  };
}
