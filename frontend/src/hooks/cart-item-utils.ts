import type { Item } from './useItems';
import type { ShelfItem } from './useShelves';
import type { CartItem } from './useOrderModalTypes';
import {
  formatItemDisplayName,
  selectionsToSnapshots,
  snapshotsToSelections,
  parseOptionsJson,
  calculateLinePrice,
  selectionSignature,
  type SelectedItemOptions,
} from '../lib/item-options';

/** Works on insecure HTTP (tablet LAN) where crypto.randomUUID is unavailable. */
export function createCartLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface AddItemExtras {
  shelfItem?: ShelfItem;
  offerDisplayName?: string;
  selectedOptions?: SelectedItemOptions;
  cartLineId?: string;
}

export function getCartLineKey(
  itemId: number,
  shelfItemId: number | undefined,
  selected: SelectedItemOptions,
): string {
  return `${itemId}|${shelfItemId ?? 0}|${selectionSignature(selected)}`;
}

export function buildCartItem(
  item: Item,
  extras: AddItemExtras = {},
  orderType: 'dine-in' | 'pickup' = 'dine-in',
): CartItem {
  const selectedOptions = extras.selectedOptions ?? [];
  const linePrice = calculateLinePrice(item.price, item.option_groups ?? [], selectedOptions);
  return {
    cartLineId: extras.cartLineId ?? createCartLineId(),
    item,
    quantity: 1,
    selectedOptions,
    linePrice,
    order_type: orderType,
    shelfItem: extras.shelfItem,
    offerDisplayName: extras.offerDisplayName,
  };
}

export function mergeCartItem(prev: CartItem[], next: CartItem): CartItem[] {
  const key = getCartLineKey(next.item.id, next.shelfItem?.id, next.selectedOptions);
  const existing = prev.find(
    (si) =>
      getCartLineKey(si.item.id, si.shelfItem?.id, si.selectedOptions) === key,
  );
  if (existing) {
    if (next.shelfItem && existing.quantity + 1 > next.shelfItem.quantity) {
      return prev;
    }
    return prev.map((si) =>
      si.cartLineId === existing.cartLineId ? { ...si, quantity: si.quantity + 1 } : si,
    );
  }
  return [...prev, next];
}

export function updateCartLine(
  prev: CartItem[],
  cartLineId: string,
  patch: Partial<Pick<CartItem, 'quantity' | 'order_type' | 'selectedOptions' | 'linePrice'>>,
): CartItem[] {
  return prev.map((si) => {
    if (si.cartLineId !== cartLineId) return si;
    const updated = { ...si, ...patch };
    if (patch.selectedOptions) {
      updated.linePrice = calculateLinePrice(
        si.item.price,
        si.item.option_groups ?? [],
        patch.selectedOptions,
      );
    }
    return updated;
  });
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, si) => sum + si.linePrice * si.quantity, 0);
}

export function mapCartItemToOrderPayload(si: CartItem) {
  const displayName = si.offerDisplayName ?? si.item.name;
  return {
    item_id: si.shelfItem?.id ? null : si.item.id,
    item_name: formatItemDisplayName(displayName, si.selectedOptions),
    quantity: si.quantity,
    price: si.linePrice,
    options_json: selectionsToSnapshots(si.selectedOptions),
    kitchen_id: si.item.kitchen_id ?? null,
    service_type: si.order_type || 'dine-in',
    shelf_item_id: si.shelfItem?.id ?? null,
  };
}

export function orderItemToCartLine(item: any, menuItems: import('./useItems').Item[]): CartItem | null {
  const snapshots = Array.isArray(item.options_json)
    ? item.options_json
    : parseOptionsJson(item.options_json);
  const selectedOptions: SelectedItemOptions = snapshotsToSelections(snapshots);
  const itemId = item.item_id ?? item.id;
  const menuItem = menuItems.find((i) => i.id === itemId);
  const baseItem: import('./useItems').Item = menuItem ?? {
    id: itemId ?? 0,
    name: item.item_name?.split(' — ')[0] ?? item.item_name ?? 'صنف',
    price: item.price ?? 0,
    categoryId: null,
    kitchen_id: item.kitchen_id ?? null,
  };
  return {
    cartLineId: createCartLineId(),
    item: baseItem,
    quantity: item.quantity ?? 1,
    selectedOptions,
    linePrice: item.price ?? 0,
    order_type: item.service_type === 'pickup' ? 'pickup' : 'dine-in',
    shelfItem: item.shelf_item_id ? ({ id: item.shelf_item_id } as any) : undefined,
  };
}
