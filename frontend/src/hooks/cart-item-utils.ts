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

export function trayUnitPrice(children: CartItem[]): number {
  return children.reduce((sum, c) => sum + c.linePrice * c.quantity, 0);
}

/** Effective sale unit price for a tray line (locked combos use header linePrice). */
export function traySaleUnitPrice(tray: CartItem): number {
  if (tray.trayLocked) return tray.linePrice;
  return trayUnitPrice(tray.children ?? []);
}

export function isComboMenuItem(item: Item): boolean {
  return Boolean((item as Item & { _isCombo?: boolean })._isCombo) || item.id < 0;
}

/** Build a locked tray cart line from a combo menu tile (negative id / _comboProducts). */
export function buildLockedComboTrayCartItem(
  item: Item,
  orderType: 'dine-in' | 'pickup' = 'dine-in',
  extras: AddItemExtras = {},
): CartItem {
  const comboId = Math.abs(item.id);
  const products =
    (item as Item & {
      _comboProducts?: Array<{
        id: number;
        name: string;
        price: number;
        quantity?: number;
        kitchen_id?: number | null;
      }>;
    })._comboProducts ?? [];

  const children: CartItem[] = products.map((p) => {
    const childItem: Item = {
      id: p.id,
      name: p.name,
      price: p.price,
      categoryId: null,
      kitchen_id: p.kitchen_id ?? null,
    };
    return {
      cartLineId: createCartLineId(),
      lineKind: 'item' as const,
      item: childItem,
      quantity: Math.max(1, Math.floor(p.quantity ?? 1)),
      selectedOptions: [],
      // Catalog unit price kept for kitchen/validation; sale total is tray header only.
      linePrice: p.price,
      order_type: orderType,
    };
  });

  return {
    cartLineId: extras.cartLineId ?? createCartLineId(),
    lineKind: 'tray',
    trayName: item.name,
    trayLocked: true,
    comboId,
    item: {
      id: -comboId,
      name: item.name,
      price: item.price,
      categoryId: null,
      kitchen_id: null,
    },
    quantity: 1,
    selectedOptions: [],
    linePrice: item.price,
    order_type: orderType,
    children,
    offerDisplayName: extras.offerDisplayName,
  };
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
    lineKind: 'item',
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
      si.lineKind !== 'tray' &&
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

/** Merge a product into a tray's children (or bump qty if same key). */
export function mergeIntoTrayChildren(children: CartItem[], next: CartItem): CartItem[] {
  const key = getCartLineKey(next.item.id, next.shelfItem?.id, next.selectedOptions);
  const existing = children.find(
    (si) => getCartLineKey(si.item.id, si.shelfItem?.id, si.selectedOptions) === key,
  );
  if (existing) {
    if (next.shelfItem && existing.quantity + 1 > next.shelfItem.quantity) {
      return children;
    }
    return children.map((si) =>
      si.cartLineId === existing.cartLineId ? { ...si, quantity: si.quantity + 1 } : si,
    );
  }
  return [...children, next];
}

export function updateCartLine(
  prev: CartItem[],
  cartLineId: string,
  patch: Partial<Pick<CartItem, 'quantity' | 'order_type' | 'selectedOptions' | 'linePrice' | 'trayName'>>,
): CartItem[] {
  return prev.map((si) => {
    if (si.cartLineId === cartLineId) {
      const updated = { ...si, ...patch };
      if (patch.selectedOptions) {
        updated.linePrice = calculateLinePrice(
          si.item.price,
          si.item.option_groups ?? [],
          patch.selectedOptions,
        );
      }
      return updated;
    }
    if (si.lineKind === 'tray' && Array.isArray(si.children)) {
      if (si.trayLocked) {
        // Locked combo trays: never mutate children or reprice from contents.
        return si;
      }
      const children = updateCartLine(si.children, cartLineId, patch);
      if (children !== si.children) {
        return { ...si, children, linePrice: trayUnitPrice(children) };
      }
    }
    return si;
  });
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, si) => {
    if (si.lineKind === 'tray') {
      return sum + traySaleUnitPrice(si) * si.quantity;
    }
    return sum + si.linePrice * si.quantity;
  }, 0);
}

export function mapCartItemToOrderPayload(si: CartItem): Record<string, unknown> {
  if (si.lineKind === 'tray') {
    const children = si.children ?? [];
    return {
      item_id: null,
      item_name: si.trayName || si.item.name || 'مجموعة',
      quantity: si.quantity,
      price: traySaleUnitPrice(si),
      line_kind: 'tray',
      kitchen_id: null,
      service_type: si.order_type || 'dine-in',
      shelf_item_id: null,
      options_json: null,
      combo_id: si.comboId ?? null,
      tray_locked: si.trayLocked ? 1 : 0,
      offer_source_type: si.comboId ? 'combo' : null,
      offer_source_id: si.comboId ?? null,
      items: children.map((c) =>
        mapCartItemToOrderPayload({ ...c, order_type: si.order_type || c.order_type }),
      ),
    };
  }

  const displayName = si.offerDisplayName ?? si.item.name;
  return {
    item_id: si.shelfItem?.id ? null : si.item.id,
    item_name: formatItemDisplayName(displayName, si.selectedOptions),
    quantity: si.quantity,
    price: si.linePrice,
    line_kind: 'item',
    options_json: selectionsToSnapshots(si.selectedOptions),
    kitchen_id: si.item.kitchen_id ?? null,
    service_type: si.order_type || 'dine-in',
    shelf_item_id: si.shelfItem?.id ?? null,
  };
}

export function orderItemToCartLine(item: any, menuItems: import('./useItems').Item[]): CartItem | null {
  if (item.line_kind === 'tray') return null;
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
    lineKind: 'item',
    item: baseItem,
    quantity: item.quantity ?? 1,
    selectedOptions,
    linePrice: item.price ?? 0,
    order_type: item.service_type === 'pickup' ? 'pickup' : 'dine-in',
    shelfItem: item.shelf_item_id ? ({ id: item.shelf_item_id } as any) : undefined,
  };
}
