import {
  snapshotsToSelections,
  calculateLinePrice,
  type OrderItemOptionSnapshot,
} from '../types/item-options';
import { BadRequestException, NotFoundException } from './exceptions';
import type { DatabaseService } from '../database/database.service';

export interface TableGlobalDiscount {
  percent: number;
  /** Proportional share deducted from this order (summed in reports). */
  amount: number;
  /** Full table discount amount (for UI display). */
  table_discount_total?: number;
}

export interface OrderLineItemInput {
  item_id: number | null;
  price: number;
  shelf_item_id?: number | null;
  options_json?: unknown[] | null;
}

export function parseStoredGlobalDiscount(raw: unknown): TableGlobalDiscount | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.percent == null || parsed?.amount == null) return null;
    return parsed as TableGlobalDiscount;
  } catch {
    return null;
  }
}

export function getTableDiscountTotal(discount: TableGlobalDiscount): number {
  return discount.table_discount_total ?? discount.amount;
}

/** Distribute a table discount across order subtotals with integer rounding. */
export function distributeTableDiscount(
  orderSubtotals: Array<{ orderId: number; subtotal: number }>,
  discount: { percent: number; amount: number },
): Map<number, { proportionalAmount: number; discountJson: string }> {
  const result = new Map<number, { proportionalAmount: number; discountJson: string }>();
  const tableSubtotal = orderSubtotals.reduce((sum, row) => sum + row.subtotal, 0);
  const discountAmount = discount.amount;
  let remainingDiscount = discountAmount;

  orderSubtotals.forEach((row, index) => {
    let proportionalAmount: number;
    if (orderSubtotals.length === 0) {
      proportionalAmount = 0;
    } else if (index === orderSubtotals.length - 1) {
      proportionalAmount = remainingDiscount;
    } else {
      proportionalAmount = Math.round(
        tableSubtotal > 0 ? (row.subtotal / tableSubtotal) * discountAmount : 0,
      );
      remainingDiscount -= proportionalAmount;
    }

    result.set(row.orderId, {
      proportionalAmount,
      discountJson: JSON.stringify({
        percent: discount.percent,
        amount: proportionalAmount,
        table_discount_total: discountAmount,
      } satisfies TableGlobalDiscount),
    });
  });

  return result;
}

export async function validateOrderItemPrices(
  db: DatabaseService,
  items: OrderLineItemInput[],
): Promise<void> {
  for (const item of items) {
    await validateOrderItemPrice(db, item);
  }
}

export async function validateOrderItemPrice(
  db: DatabaseService,
  item: OrderLineItemInput,
): Promise<void> {
  if (item.shelf_item_id) {
    const shelf = await db.get('SELECT price FROM shelf_items WHERE id = ?', [item.shelf_item_id]);
    if (!shelf) {
      throw new NotFoundException(`Shelf item with id ${item.shelf_item_id} not found`);
    }
    if (item.price !== shelf.price) {
      throw new BadRequestException(
        `Price mismatch for shelf item ${item.shelf_item_id}: expected ${shelf.price}, got ${item.price}`,
      );
    }
    return;
  }

  if (!item.item_id) {
    throw new BadRequestException('Order item must have item_id or shelf_item_id');
  }

  const catalogItem = await db.get('SELECT price FROM items WHERE id = ?', [item.item_id]);
  if (!catalogItem) {
    throw new NotFoundException(`Item with id ${item.item_id} not found`);
  }

  let expectedPrice = catalogItem.price;
  if (item.options_json && Array.isArray(item.options_json) && item.options_json.length > 0) {
    const selections = snapshotsToSelections(item.options_json as OrderItemOptionSnapshot[]);
    expectedPrice = calculateLinePrice(catalogItem.price, [], selections);
  }

  if (item.price !== expectedPrice) {
    throw new BadRequestException(
      `Price mismatch for item ${item.item_id}: expected ${expectedPrice}, got ${item.price}`,
    );
  }
}
