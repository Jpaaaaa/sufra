/** Backend-local copy of electron/shared/types/item-options.ts (keep in sync). */
export type ItemOptionPricingMode = 'replace' | 'inherit' | 'add';

export interface ItemOption {
  id?: number;
  group_id?: number;
  name: string;
  price: number;
  is_default?: boolean;
  is_out_of_stock?: boolean;
  sort_order?: number;
}

export interface ItemOptionGroup {
  id?: number;
  item_id?: number;
  name: string;
  pricing_mode: ItemOptionPricingMode;
  min_select: number;
  max_select: number;
  sort_order?: number;
  options: ItemOption[];
}

export interface SelectedItemOption {
  group_id: number;
  group_name: string;
  option_id: number;
  option_name: string;
  pricing_mode: ItemOptionPricingMode;
  price: number;
}

export type SelectedItemOptions = SelectedItemOption[];

export interface OrderItemOptionSnapshot {
  group_id: number;
  group_name: string;
  option_id: number;
  option_name: string;
  pricing_mode: ItemOptionPricingMode;
  price_effect: number;
}

export function calculateLinePrice(
  basePrice: number,
  _groups: ItemOptionGroup[],
  selected: SelectedItemOptions,
): number {
  let replacePrice: number | null = null;
  let addTotal = 0;

  for (const sel of selected) {
    if (sel.pricing_mode === 'replace') {
      replacePrice = sel.price;
    } else if (sel.pricing_mode === 'add') {
      addTotal += sel.price;
    }
  }

  if (replacePrice !== null) {
    return replacePrice + addTotal;
  }
  return basePrice + addTotal;
}

export function snapshotsToSelections(snapshots: OrderItemOptionSnapshot[]): SelectedItemOptions {
  return snapshots.map((s) => ({
    group_id: s.group_id,
    group_name: s.group_name,
    option_id: s.option_id,
    option_name: s.option_name,
    pricing_mode: s.pricing_mode,
    price: s.price_effect,
  }));
}
