export type ComboPricingMode = 'fixed' | 'sum';

export interface ComboLineInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

/** Merge duplicate product_ids by summing quantities (qty >= 1). */
export function mergeComboItems(
  items: Array<{ product_id: number; quantity?: number }>,
): Array<{ product_id: number; quantity: number }> {
  const map = new Map<number, number>();
  for (const row of items) {
    const id = Number(row.product_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    map.set(id, (map.get(id) ?? 0) + qty);
  }
  return [...map.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

/** Integer-safe sum of catalog unit × qty. */
export function sumComboContentsPrice(lines: ComboLineInput[]): number {
  return lines.reduce((sum, line) => {
    const unit = Math.max(0, Math.round(Number(line.unit_price) || 0));
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    return sum + unit * qty;
  }, 0);
}

export function resolveComboPrice(opts: {
  pricing_mode: ComboPricingMode;
  combo_price?: number | null;
  lines: ComboLineInput[];
}): number {
  if (opts.pricing_mode === 'sum') {
    return sumComboContentsPrice(opts.lines);
  }
  const price = Math.round(Number(opts.combo_price));
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Combo price must be a non-negative integer');
  }
  return price;
}
