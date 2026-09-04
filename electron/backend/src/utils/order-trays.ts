import type { DatabaseService } from '../database/database.service';
import { resolveOrderItemInsertId } from './order-item-insert';
import { serializeOptionsJson } from './order-item-options';
import type { OrderLineItemInput } from './order-pricing';
import { validateOrderItemPrices } from './order-pricing';
import { BadRequestException } from './exceptions';

export type OrderLineKind = 'item' | 'tray';
export type OrderItemsOrderType = 'dine_in' | 'pickup' | 'delivery';

export interface OrderItemInput {
  item_id: number | null;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  service_type?: 'dine-in' | 'pickup';
  shelf_item_id?: number | null;
  options_json?: unknown[] | null;
  line_kind?: OrderLineKind;
  /** Nested products inside a tray (API payload). */
  items?: OrderItemInput[];
}

export const ORDER_ITEM_SELECT_COLS =
  'id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id, order_type, options_json, line_kind, parent_order_item_id';

export function isTrayLine(item: { line_kind?: string | null; items?: unknown }): boolean {
  return item.line_kind === 'tray' || (Array.isArray(item.items) && item.items.length > 0);
}

export function isTopLevelRow(item: { parent_order_item_id?: number | null }): boolean {
  return item.parent_order_item_id == null;
}

/** Unit price of one tray = sum(child.price × child.quantity). */
export function trayUnitPrice(children: Array<{ price: number; quantity: number }>): number {
  return children.reduce((sum, c) => sum + c.price * c.quantity, 0);
}

/** Subtotal from top-level API items (trays + standalone). Does not double-count children. */
export function topLevelSubtotal(items: OrderItemInput[]): number {
  return items.reduce((sum, item) => {
    if (isTrayLine(item)) {
      const children = item.items ?? [];
      if (children.length === 0) {
        throw new BadRequestException('Group must contain at least one product');
      }
      return sum + trayUnitPrice(children) * item.quantity;
    }
    return sum + item.price * item.quantity;
  }, 0);
}

/** Product lines only (standalone + tray children) for catalog price validation. */
export function productLinesForValidation(items: OrderItemInput[]): OrderLineItemInput[] {
  const lines: OrderLineItemInput[] = [];
  for (const item of items) {
    if (isTrayLine(item)) {
      for (const child of item.items ?? []) {
        lines.push({
          item_id: child.item_id,
          price: child.price,
          shelf_item_id: child.shelf_item_id,
          options_json: child.options_json,
        });
      }
    } else {
      lines.push({
        item_id: item.item_id,
        price: item.price,
        shelf_item_id: item.shelf_item_id,
        options_json: item.options_json,
      });
    }
  }
  return lines;
}

export async function validateOrderItemsWithTrays(
  db: DatabaseService,
  items: OrderItemInput[],
): Promise<void> {
  for (const item of items) {
    if (isTrayLine(item)) {
      if (!item.items || item.items.length === 0) {
        throw new BadRequestException('Group must contain at least one product');
      }
      if (item.quantity < 1) {
        throw new BadRequestException('Group quantity must be at least 1');
      }
    }
  }
  await validateOrderItemPrices(db, productLinesForValidation(items));
}

export interface InsertOrderItemsOptions {
  orderId: number;
  orderType: OrderItemsOrderType;
  items: OrderItemInput[];
  /** Include service_type column (dine-in). */
  withServiceType?: boolean;
}

/** Insert top-level lines and tray children; returns nothing (uses lastInsertRowId). */
export async function insertOrderItemsWithTrays(
  db: DatabaseService,
  opts: InsertOrderItemsOptions,
): Promise<void> {
  const { orderId, orderType, items, withServiceType = false } = opts;

  for (const item of items) {
    if (isTrayLine(item)) {
      const children = item.items ?? [];
      const unitPrice = trayUnitPrice(children);
      await db.run(
        withServiceType
          ? `INSERT INTO order_items (
              order_id, item_id, item_name, quantity, price, kitchen_id, service_type,
              shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO order_items (
              order_id, item_id, item_name, quantity, price, kitchen_id,
              shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        withServiceType
          ? [
              orderId,
              null,
              item.item_name || 'مجموعة',
              item.quantity,
              unitPrice,
              null,
              item.service_type || 'dine-in',
              null,
              orderType,
              null,
              'tray',
              null,
            ]
          : [
              orderId,
              null,
              item.item_name || 'مجموعة',
              item.quantity,
              unitPrice,
              null,
              null,
              orderType,
              null,
              'tray',
              null,
            ],
      );

      const trayId = await db.getLastInsertRowId();
      if (!trayId) {
        throw new BadRequestException('Failed to create group line');
      }

      for (const child of children) {
        await db.run(
          withServiceType
            ? `INSERT INTO order_items (
                order_id, item_id, item_name, quantity, price, kitchen_id, service_type,
                shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            : `INSERT INTO order_items (
                order_id, item_id, item_name, quantity, price, kitchen_id,
                shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          withServiceType
            ? [
                orderId,
                resolveOrderItemInsertId(child.item_id, child.shelf_item_id),
                child.item_name,
                child.quantity,
                child.price,
                child.kitchen_id ?? null,
                child.service_type || item.service_type || 'dine-in',
                child.shelf_item_id ?? null,
                orderType,
                serializeOptionsJson(child.options_json),
                'item',
                trayId,
              ]
            : [
                orderId,
                resolveOrderItemInsertId(child.item_id, child.shelf_item_id),
                child.item_name,
                child.quantity,
                child.price,
                child.kitchen_id ?? null,
                child.shelf_item_id ?? null,
                orderType,
                serializeOptionsJson(child.options_json),
                'item',
                trayId,
              ],
        );
      }
    } else {
      await db.run(
        withServiceType
          ? `INSERT INTO order_items (
              order_id, item_id, item_name, quantity, price, kitchen_id, service_type,
              shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO order_items (
              order_id, item_id, item_name, quantity, price, kitchen_id,
              shelf_item_id, order_type, options_json, line_kind, parent_order_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        withServiceType
          ? [
              orderId,
              resolveOrderItemInsertId(item.item_id, item.shelf_item_id),
              item.item_name,
              item.quantity,
              item.price,
              item.kitchen_id ?? null,
              item.service_type || 'dine-in',
              item.shelf_item_id ?? null,
              orderType,
              serializeOptionsJson(item.options_json),
              'item',
              null,
            ]
          : [
              orderId,
              resolveOrderItemInsertId(item.item_id, item.shelf_item_id),
              item.item_name,
              item.quantity,
              item.price,
              item.kitchen_id ?? null,
              item.shelf_item_id ?? null,
              orderType,
              serializeOptionsJson(item.options_json),
              'item',
              null,
            ],
      );
    }
  }
}

/** Shelf stock deltas: for tray children multiply by tray quantity. */
export function shelfStockDecrements(
  items: OrderItemInput[],
): Array<{ shelf_item_id: number; quantity: number }> {
  const out: Array<{ shelf_item_id: number; quantity: number }> = [];
  for (const item of items) {
    if (isTrayLine(item)) {
      const trayQty = item.quantity;
      for (const child of item.items ?? []) {
        if (child.shelf_item_id) {
          out.push({
            shelf_item_id: child.shelf_item_id,
            quantity: child.quantity * trayQty,
          });
        }
      }
    } else if (item.shelf_item_id) {
      out.push({ shelf_item_id: item.shelf_item_id, quantity: item.quantity });
    }
  }
  return out;
}

/** Subtotal from flat DB rows — only top-level lines (trays + standalone). */
export function topLevelSubtotalFromRows(
  rows: Array<{ price: number; quantity: number; parent_order_item_id?: number | null }>,
): number {
  return rows
    .filter((r) => isTopLevelRow(r))
    .reduce((sum, r) => sum + r.price * r.quantity, 0);
}
