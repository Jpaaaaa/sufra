import type { CartItem } from '../hooks/useOrderModalTypes';
import {
  createCartLineId,
  orderItemToCartLine,
  trayUnitPrice,
} from '../hooks/cart-item-utils';
import type { Item } from '../hooks/useItems';

/** Placeholder catalog item for tray container lines. */
export const TRAY_PLACEHOLDER_ITEM: Item = {
  id: 0,
  name: 'مجموعة',
  price: 0,
  categoryId: null,
  kitchen_id: null,
};

export function buildTrayCartItem(
  trayNumber: number,
  orderType: 'dine-in' | 'pickup' = 'dine-in',
): CartItem {
  const name = `مجموعة ${trayNumber}`;
  return {
    cartLineId: createCartLineId(),
    lineKind: 'tray',
    trayName: name,
    item: { ...TRAY_PLACEHOLDER_ITEM, name },
    quantity: 1,
    selectedOptions: [],
    linePrice: 0,
    order_type: orderType,
    children: [],
  };
}

/** Extract tray/group number from names like "مجموعة 1" / "صينية 2". */
export function parseTrayNumber(name?: string | null): number | null {
  if (!name) return null;
  const m = /(?:مجموعة|صينية|Group|کۆمەڵە)\s+(\d+)/.exec(name);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Presentation-only print label. Does not change stored trayName / DB values.
 * "مجموعة 1" → "صينية 1"
 */
export function getTrayPrintName(
  trayNumber?: number | null,
  fallbackName?: string | null,
): string {
  const n =
    trayNumber != null && trayNumber > 0
      ? trayNumber
      : parseTrayNumber(fallbackName ?? null);
  if (n != null) return `صينية ${n}`;
  const raw = (fallbackName || '').trim();
  if (raw) {
    return raw.replace(/^مجموعة(\s+)/, 'صينية$1').replace(/^Group(\s+)/i, 'صينية$1');
  }
  return 'صينية';
}

export function nextTrayNumber(items: CartItem[]): number {
  let max = 0;
  for (const si of items) {
    if (si.lineKind !== 'tray') continue;
    const n = parseTrayNumber(si.trayName ?? si.item.name ?? '');
    if (n != null) max = Math.max(max, n);
  }
  return max + 1;
}

/** Walk top-level + tray children; update matching cartLineId. */
export function mapCartTree(
  items: CartItem[],
  mapper: (si: CartItem) => CartItem | null,
): CartItem[] {
  const result: CartItem[] = [];
  for (const si of items) {
    if (si.lineKind === 'tray') {
      const children = (si.children ?? [])
        .map((child) => mapper(child))
        .filter((c): c is CartItem => c != null);
      const mappedTray = mapper({ ...si, children });
      if (!mappedTray) continue;
      if (mappedTray.lineKind === 'tray') {
        mappedTray.linePrice = trayUnitPrice(mappedTray.children ?? []);
      }
      result.push(mappedTray);
    } else {
      const mapped = mapper(si);
      if (mapped) result.push(mapped);
    }
  }
  return result;
}

export function findCartLine(items: CartItem[], cartLineId: string): CartItem | null {
  for (const si of items) {
    if (si.cartLineId === cartLineId) return si;
    if (si.children) {
      const found = findCartLine(si.children, cartLineId);
      if (found) return found;
    }
  }
  return null;
}

export function removeCartLine(items: CartItem[], cartLineId: string): CartItem[] {
  return mapCartTree(items, (si) => (si.cartLineId === cartLineId ? null : si)).filter(
    (si) => si.lineKind !== 'tray' || (si.children && si.children.length >= 0),
  );
}

/** Convert flat DB order_items (with parent_order_item_id) into nested cart lines. */
export function orderItemsToCartLines(flatItems: any[], menuItems: Item[]): CartItem[] {
  if (!flatItems?.length) return [];

  const topLevel = flatItems
    .filter((i) => i.parent_order_item_id == null)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const childrenByParent = new Map<number, any[]>();
  for (const row of flatItems) {
    if (row.parent_order_item_id == null) continue;
    const list = childrenByParent.get(row.parent_order_item_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_order_item_id, list);
  }

  const result: CartItem[] = [];
  for (const row of topLevel) {
    if (row.line_kind === 'tray') {
      const childRows = (childrenByParent.get(row.id) ?? []).sort(
        (a, b) => (a.id ?? 0) - (b.id ?? 0),
      );
      const children = childRows
        .map((c) => orderItemToCartLine(c, menuItems))
        .filter((c): c is CartItem => c != null);
      result.push({
        cartLineId: createCartLineId(),
        lineKind: 'tray',
        trayName: row.item_name || 'مجموعة',
        item: { ...TRAY_PLACEHOLDER_ITEM, name: row.item_name || 'مجموعة' },
        quantity: row.quantity ?? 1,
        selectedOptions: [],
        linePrice: row.price ?? trayUnitPrice(children),
        order_type: row.service_type === 'pickup' ? 'pickup' : 'dine-in',
        children,
      });
    } else {
      const line = orderItemToCartLine(row, menuItems);
      if (line) result.push(line);
    }
  }
  return result;
}

/** Subtotal helper for existing order flat rows (skip tray children). */
export function orderItemsTopLevelSubtotal(items: any[]): number {
  return (items ?? []).reduce((sum, item) => {
    if (item.parent_order_item_id != null) return sum;
    return sum + (item.price || 0) * (item.quantity || 0);
  }, 0);
}

/**
 * Expand flat order items for kitchen print:
 * each kitchen gets tray headers + its products (qty × tray qty).
 */
export function expandItemsForKitchenPrint(flatItems: any[]): any[] {
  const childrenByParent = new Map<number, any[]>();

  for (const item of flatItems ?? []) {
    if (item.parent_order_item_id != null) {
      const list = childrenByParent.get(item.parent_order_item_id) ?? [];
      list.push(item);
      childrenByParent.set(item.parent_order_item_id, list);
    }
  }

  const out: any[] = [];
  let fallbackTraySeq = 0;
  for (const item of flatItems ?? []) {
    if (item.line_kind === 'tray' && item.parent_order_item_id == null) {
      const kids = childrenByParent.get(item.id) ?? [];
      const headerName = item.item_name || 'مجموعة';
      const trayNumber = parseTrayNumber(headerName) ?? ++fallbackTraySeq;
      out.push({
        ...item,
        item_name: headerName,
        _isTrayHeader: true,
        _trayNumber: trayNumber,
      });
      for (const child of kids) {
        out.push({
          ...child,
          quantity: (child.quantity || 1) * (item.quantity || 1),
          item_name: child.item_name,
          _trayParentId: item.id,
          _isTrayChild: true,
          _trayNumber: trayNumber,
        });
      }
    } else if (item.parent_order_item_id == null && item.line_kind !== 'tray') {
      out.push(item);
    }
  }
  return out;
}

/** Group expanded print items by kitchen, keeping tray header when any child matches. */
export function groupExpandedItemsByKitchen(
  flatItems: any[],
): Map<number | null, any[]> {
  const expanded = expandItemsForKitchenPrint(flatItems);
  const groups = new Map<number | null, any[]>();

  // First pass: collect children per kitchen, remember trays needed
  const trayHeaders = new Map<number, any>();
  const kidsByKitchen = new Map<number | null, any[]>();

  for (const item of expanded) {
    if (item._isTrayHeader) {
      trayHeaders.set(item.id, item);
      continue;
    }
    const kid = item.kitchen_id ?? null;
    if (!kidsByKitchen.has(kid)) kidsByKitchen.set(kid, []);
    kidsByKitchen.get(kid)!.push(item);
  }

  for (const [kitchenId, kids] of kidsByKitchen) {
    const list: any[] = [];
    const seenTrays = new Set<number>();
    for (const child of kids) {
      const parentId = child._trayParentId;
      if (parentId != null && !seenTrays.has(parentId)) {
        const header = trayHeaders.get(parentId);
        if (header) {
          list.push(header);
          seenTrays.add(parentId);
        }
      }
      list.push(child);
    }
    groups.set(kitchenId, list);
  }

  // Standalone already in kidsByKitchen; trays with no kitchen children skipped
  return groups;
}
