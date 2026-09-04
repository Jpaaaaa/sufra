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

export interface ItemOptionGroupDraft {
  id?: number;
  name: string;
  pricing_mode: ItemOptionPricingMode;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: Array<{
    id?: number;
    name: string;
    price: string;
    is_default: boolean;
    is_out_of_stock: boolean;
    sort_order: number;
  }>;
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

export function formatOptionsSuffix(selected: SelectedItemOptions): string {
  if (!selected.length) return '';
  return selected.map((s) => s.option_name).join(' · ');
}

export function formatItemDisplayName(itemName: string, selected: SelectedItemOptions): string {
  const suffix = formatOptionsSuffix(selected);
  return suffix ? `${itemName} — ${suffix}` : itemName;
}

export function getMinReplacePrice(groups: ItemOptionGroup[]): number | null {
  let min: number | null = null;
  for (const g of groups) {
    if (g.pricing_mode !== 'replace') continue;
    for (const o of g.options) {
      if (o.is_out_of_stock) continue;
      if (min === null || o.price < min) min = o.price;
    }
  }
  return min;
}

export function itemHasOptionGroups(item: {
  has_options?: boolean;
  option_groups?: ItemOptionGroup[];
}): boolean {
  return Boolean(item.has_options || (item.option_groups && item.option_groups.length > 0));
}

export function getDefaultSelections(groups: ItemOptionGroup[]): SelectedItemOptions {
  const selected: SelectedItemOptions = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (!group.options.length) continue;

    const available = group.options.filter((o) => !o.is_out_of_stock);
    if (!available.length) continue;

    const defaults = available.filter((o) => o.is_default);
    const isSingleSelect = group.max_select === 1;
    const groupId = group.id ?? -(gi + 1);

    if (isSingleSelect && group.min_select >= 1) {
      const pick = defaults[0] ?? available[0];
      if (pick) {
        const pickIndex = group.options.indexOf(pick);
        selected.push({
          group_id: groupId,
          group_name: group.name,
          option_id: pick.id ?? -(pickIndex + 1),
          option_name: pick.name,
          pricing_mode: group.pricing_mode,
          price: pick.price,
        });
      }
    } else if (defaults.length > 0) {
      for (const pick of defaults.slice(0, group.max_select)) {
        const pickIndex = group.options.indexOf(pick);
        selected.push({
          group_id: groupId,
          group_name: group.name,
          option_id: pick.id ?? -(pickIndex + 1),
          option_name: pick.name,
          pricing_mode: group.pricing_mode,
          price: pick.price,
        });
      }
    }
  }

  return selected;
}

export function selectionSignature(selected: SelectedItemOptions): string {
  return selected
    .slice()
    .sort((a, b) => a.group_id - b.group_id || a.option_id - b.option_id)
    .map((s) => `${s.group_id}:${s.option_id}`)
    .join('|');
}

export function selectionsToSnapshots(selected: SelectedItemOptions): OrderItemOptionSnapshot[] {
  return selected.map((s) => ({
    group_id: s.group_id,
    group_name: s.group_name,
    option_id: s.option_id,
    option_name: s.option_name,
    pricing_mode: s.pricing_mode,
    price_effect: s.price,
  }));
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

export function isSelectionValid(groups: ItemOptionGroup[], selected: SelectedItemOptions): boolean {
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupKey = group.id ?? -(gi + 1);
    const count = selected.filter((s) => s.group_id === groupKey || (group.id != null && s.group_id === group.id)).length;
    if (count < group.min_select) return false;
    if (count > group.max_select) return false;
  }
  return true;
}

export function parseOptionsJson(raw: string | null | undefined): OrderItemOptionSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeOrderItemOptions(
  options_json: unknown[] | string | null | undefined,
): OrderItemOptionSnapshot[] {
  if (!options_json) return [];
  if (Array.isArray(options_json)) return options_json as OrderItemOptionSnapshot[];
  return parseOptionsJson(options_json);
}

export function formatOrderItemBaseName(
  itemName: string,
  options_json?: unknown[] | string | null,
): string {
  const opts = normalizeOrderItemOptions(options_json);
  if (!opts.length) return itemName;
  const idx = itemName.indexOf(' — ');
  return idx >= 0 ? itemName.slice(0, idx) : itemName;
}

export function formatOrderOptionSubLines(
  options_json: unknown[] | string | null | undefined,
): string[] {
  return normalizeOrderItemOptions(options_json)
    .map((opt) => {
      if (opt.group_name) return `${opt.group_name}: ${opt.option_name}`;
      return opt.option_name;
    })
    .filter(Boolean);
}

export function draftGroupsToApi(groups: ItemOptionGroupDraft[]): ItemOptionGroup[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    pricing_mode: g.pricing_mode,
    min_select: g.min_select,
    max_select: g.max_select,
    sort_order: g.sort_order,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      price: g.pricing_mode === 'inherit' ? 0 : Number(o.price) || 0,
      is_default: o.is_default,
      is_out_of_stock: o.is_out_of_stock,
      sort_order: o.sort_order,
    })),
  }));
}

export function apiGroupsToDraft(groups: ItemOptionGroup[] | undefined): ItemOptionGroupDraft[] {
  if (!groups?.length) return [];
  return groups.map((g, gi) => ({
    id: g.id,
    name: g.name,
    pricing_mode: g.pricing_mode,
    min_select: g.min_select,
    max_select: g.max_select,
    sort_order: g.sort_order ?? gi,
    options: (g.options ?? []).map((o, oi) => ({
      id: o.id,
      name: o.name,
      price: String(o.price ?? 0),
      is_default: Boolean(o.is_default),
      is_out_of_stock: Boolean(o.is_out_of_stock),
      sort_order: o.sort_order ?? oi,
    })),
  }));
}

export function createTemplateGroup(
  template: 'sizes' | 'flavors' | 'extras',
  sortOrder: number,
  t: (key: string) => string,
): ItemOptionGroupDraft {
  if (template === 'sizes') {
    return {
      name: t('catalog.templateSizesName'),
      pricing_mode: 'replace',
      min_select: 1,
      max_select: 1,
      sort_order: sortOrder,
      options: [
        { name: t('catalog.templateSizeSmall'), price: '', is_default: false, is_out_of_stock: false, sort_order: 0 },
        { name: t('catalog.templateSizeMedium'), price: '', is_default: true, is_out_of_stock: false, sort_order: 1 },
        { name: t('catalog.templateSizeLarge'), price: '', is_default: false, is_out_of_stock: false, sort_order: 2 },
      ],
    };
  }
  if (template === 'flavors') {
    return {
      name: t('catalog.templateFlavorsName'),
      pricing_mode: 'inherit',
      min_select: 1,
      max_select: 1,
      sort_order: sortOrder,
      options: [
        { name: '', price: '0', is_default: true, is_out_of_stock: false, sort_order: 0 },
      ],
    };
  }
  return {
    name: t('catalog.templateExtrasName'),
    pricing_mode: 'add',
    min_select: 0,
    max_select: 5,
    sort_order: sortOrder,
    options: [
      { name: '', price: '', is_default: false, is_out_of_stock: false, sort_order: 0 },
    ],
  };
}
