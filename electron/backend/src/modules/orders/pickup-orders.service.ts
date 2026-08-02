import { NotFoundException, BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { requireShelves, ShelvesService } from '../shelves/shelves.service';
import { resolveOrderShiftFields } from '../settings/resolve-order-shift';
import { resolveOrderItemInsertId } from '../../utils/order-item-insert';

export interface PickupOrderItem {
  item_id: number | null;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  shelf_item_id?: number | null;
}

export interface CreatePickupOrderDto {
  items: PickupOrderItem[];
  globalDiscount?: { percent: number; amount: number };
  note?: string;
  /** Optional customer name for pickup orders */
  customer_name?: string | null;
  /** Optional customer phone for pickup orders */
  customer_phone?: string | null;
  /** المستخدم الذي أنشأ الطلب (تقارير الموظفين) */
  userId?: number | null;
}

export interface PickupOrder {
  id: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived';
  total: number;
  discount: number;
  globalDiscount?: any;
  note?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PickupOrderWithItems extends PickupOrder {
  items: Array<{
    id: number;
    order_id: number;
    item_id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number | null;
    shelf_item_id?: number | null;
    order_type: string;
  }>;
}

class PickupOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shelvesService: ShelvesService,
  ) {}

  /**
   * Find all active pickup orders (pending, printed - excludes completed and archived)
   * When user hits Complete, order goes directly to archived.
   */
  async findActive(): Promise<PickupOrderWithItems[]> {
    console.log('[PICKUP_ORDERS] findActive: querying active pickup orders');

    const orderRows = await this.db.all(
      `SELECT id, status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, updated_at 
       FROM pickup_orders 
       WHERE status IN ('pending', 'printed') 
       ORDER BY created_at ASC`,
    );

    if (orderRows.length === 0) {
      return [];
    }

    orderRows.forEach((order: any) => {
      if (order.globalDiscount) {
        try {
          order.globalDiscount = JSON.parse(order.globalDiscount);
        } catch (e) {
          order.globalDiscount = null;
        }
      }
    });

    const orderIds = orderRows.map((o: any) => o.id);

    let itemRows: any[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      // CRITICAL: Always filter by order_type to ensure domain separation
      itemRows = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type
         FROM order_items 
         WHERE order_id IN (${placeholders}) AND order_type = 'pickup'`,
        orderIds,
      );
    }

    const ordersWithItems: PickupOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * Find all archived pickup orders (includes legacy 'completed' for backwards compatibility)
   */
  async findArchived(): Promise<PickupOrderWithItems[]> {
    console.log('[PICKUP_ORDERS] findArchived: querying archived pickup orders');

    const orderRows = await this.db.all(
      `SELECT id, status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, updated_at 
       FROM pickup_orders 
       WHERE status IN ('archived', 'completed', 'cancelled') 
       ORDER BY created_at DESC`,
    );

    if (orderRows.length === 0) {
      return [];
    }

    orderRows.forEach((order: any) => {
      if (order.globalDiscount) {
        try {
          order.globalDiscount = JSON.parse(order.globalDiscount);
        } catch (e) {
          order.globalDiscount = null;
        }
      }
    });

    const orderIds = orderRows.map((o: any) => o.id);

    let itemRows: any[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      // CRITICAL: Always filter by order_type to ensure domain separation
      itemRows = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type
         FROM order_items 
         WHERE order_id IN (${placeholders}) AND order_type = 'pickup'`,
        orderIds,
      );
    }

    const ordersWithItems: PickupOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * Find pickup order by ID
   */
  async findById(id: number): Promise<PickupOrderWithItems | null> {
    const orderRow = await this.db.get(
      `SELECT id, status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, updated_at 
       FROM pickup_orders WHERE id = ?`,
      [id],
    );

    if (!orderRow) {
      return null;
    }

    if (orderRow.globalDiscount) {
      try {
        orderRow.globalDiscount = JSON.parse(orderRow.globalDiscount);
      } catch (e) {
        orderRow.globalDiscount = null;
      }
    }

    // CRITICAL: Always filter by order_type to ensure domain separation
    const itemRows = await this.db.all(
      `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type
       FROM order_items 
       WHERE order_id = ? AND order_type = 'pickup'`,
      [id],
    );

    return {
      ...orderRow,
      items: itemRows,
    } as PickupOrderWithItems;
  }

  /**
   * Create a new pickup order
   */
  async create(data: CreatePickupOrderDto): Promise<PickupOrderWithItems> {
    console.log('[PICKUP_ORDERS] create: creating pickup order', data);

    // Validation
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = data.globalDiscount?.amount ?? 0;
    const total = Math.max(0, subtotal - discountAmount);
    const globalDiscountJson = data.globalDiscount ? JSON.stringify(data.globalDiscount) : null;
    const shiftFields = await resolveOrderShiftFields();

    await this.db.run(
      `INSERT INTO pickup_orders (status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, created_by_user_id, business_date, shift_definition_id) 
       VALUES ('pending', ?, 0, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)`,
      [
        total,
        globalDiscountJson,
        data.note || null,
        (data.customer_name && data.customer_name.trim()) ? data.customer_name.trim() : null,
        (data.customer_phone && data.customer_phone.trim()) ? data.customer_phone.trim() : null,
        data.userId ?? null,
        shiftFields.business_date,
        shiftFields.shift_definition_id,
      ],
    );

    const orderId = await this.db.getLastInsertRowId();
    if (!orderId || orderId === 0) {
      throw new BadRequestException('Failed to create order: Invalid order ID returned');
    }

    for (const item of data.items) {
      await this.db.run(
        `INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          resolveOrderItemInsertId(item.item_id, item.shelf_item_id),
          item.item_name,
          item.quantity,
          item.price,
          item.kitchen_id ?? null,
          item.shelf_item_id ?? null,
          'pickup',
        ],
      );
    }

    // Decrease stock for shelf items
    try {
      for (const item of data.items) {
        if (item.shelf_item_id) {
          try {
            await this.shelvesService.decreaseStock(item.shelf_item_id, item.quantity);
          } catch (stockErr: any) {
            console.error('[PICKUP_ORDERS] create: stock decrease failed, rolling back order', orderId);
            await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'pickup'", [orderId]);
            await this.db.run('DELETE FROM pickup_orders WHERE id = ?', [orderId]);
            throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
          }
        }
      }
    } catch (stockErr: any) {
      console.error('[PICKUP_ORDERS] create: error during stock update, rolling back order', orderId);
      await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'pickup'", [orderId]);
      await this.db.run('DELETE FROM pickup_orders WHERE id = ?', [orderId]);
      throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
    }

    const orderRow = await this.db.get(
      `SELECT id, status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, updated_at 
       FROM pickup_orders WHERE id = ?`,
      [orderId],
    );

    if (!orderRow) {
      throw new NotFoundException('Order not found after creation');
    }

    if (orderRow.globalDiscount) {
      try {
        orderRow.globalDiscount = JSON.parse(orderRow.globalDiscount);
      } catch (e) {
        orderRow.globalDiscount = null;
      }
    }

    // CRITICAL: Always filter by order_type to ensure domain separation
    const itemRows = await this.db.all(
      `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type
       FROM order_items 
       WHERE order_id = ? AND order_type = 'pickup'`,
      [orderId],
    );

    console.log('[PICKUP_ORDERS] ✅ Created order', orderId, 'with', itemRows.length, 'items');

    return {
      ...orderRow,
      items: itemRows,
    } as PickupOrderWithItems;
  }

  /**
   * Update pickup order status
   */
  async updateStatus(id: number, status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'): Promise<PickupOrder> {
    await this.db.run(
      'UPDATE pickup_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
    );

    const row = await this.db.get(
      `SELECT id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM pickup_orders WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Order not found');
    }

    if (row.globalDiscount) {
      try {
        row.globalDiscount = JSON.parse(row.globalDiscount);
      } catch (e) {
        row.globalDiscount = null;
      }
    }

    return row as PickupOrder;
  }

  /**
   * Update pickup order items and details
   */
  async update(id: number, data: {
    items: PickupOrderItem[];
    globalDiscount?: { percent: number; amount: number };
    note?: string;
    customer_name?: string | null;
    customer_phone?: string | null;
  }): Promise<PickupOrderWithItems> {
    console.log('[PICKUP_ORDERS] update: updating order', id, data);

    const existing = await this.db.get(
      'SELECT id, status FROM pickup_orders WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = data.globalDiscount?.amount ?? 0;
    const total = Math.max(0, subtotal - discountAmount);
    const globalDiscountJson = data.globalDiscount ? JSON.stringify(data.globalDiscount) : null;

    const customerName = (data.customer_name != null && String(data.customer_name).trim()) ? String(data.customer_name).trim() : null;
    const customerPhone = (data.customer_phone != null && String(data.customer_phone).trim()) ? String(data.customer_phone).trim() : null;

    // Update order
    await this.db.run(
      'UPDATE pickup_orders SET total = ?, globalDiscount = ?, note = ?, customer_name = ?, customer_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [total, globalDiscountJson, data.note || null, customerName, customerPhone, id],
    );

    // Delete old order items (only for this order_type to prevent accidental deletion)
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'pickup'", [id]);

    for (const item of data.items) {
      await this.db.run(
        `INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          resolveOrderItemInsertId(item.item_id, item.shelf_item_id),
          item.item_name,
          item.quantity,
          item.price,
          item.kitchen_id ?? null,
          item.shelf_item_id ?? null,
          'pickup',
        ],
      );
    }

    // Return the updated order with items
    const orderRow = await this.db.get(
      `SELECT id, status, total, discount, globalDiscount, note, customer_name, customer_phone, created_at, updated_at 
       FROM pickup_orders WHERE id = ?`,
      [id],
    );

    if (!orderRow) {
      throw new NotFoundException('Order not found after update');
    }

    if (orderRow.globalDiscount) {
      try {
        orderRow.globalDiscount = JSON.parse(orderRow.globalDiscount);
      } catch (e) {
        orderRow.globalDiscount = null;
      }
    }

    // CRITICAL: Always filter by order_type to ensure domain separation
    const itemRows = await this.db.all(
      `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type
       FROM order_items 
       WHERE order_id = ? AND order_type = 'pickup'`,
      [id],
    );

    return {
      ...orderRow,
      items: itemRows,
    } as PickupOrderWithItems;
  }

  /**
   * Delete pickup order
   */
  async remove(id: number): Promise<void> {
    // CRITICAL: Only delete items with matching order_type to prevent accidental deletion
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'pickup'", [id]);
    await this.db.run('DELETE FROM pickup_orders WHERE id = ?', [id]);
  }

  /**
   * Delete all archived pickup orders (includes legacy completed)
   */
  async removeAllArchived(): Promise<number> {
    const archivedOrders = await this.db.all(
      'SELECT id FROM pickup_orders WHERE status IN (?, ?)',
      ['archived', 'completed'],
    );
    
    if (archivedOrders.length === 0) {
      return 0;
    }

    const orderIds = archivedOrders.map((o: any) => o.id);
    
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      await this.db.run(
        `DELETE FROM order_items WHERE order_id IN (${placeholders}) AND order_type = 'pickup'`,
        orderIds,
      );
    }

    await this.db.run(
      'DELETE FROM pickup_orders WHERE status IN (?, ?)',
      ['archived', 'completed'],
    );

    return archivedOrders.length;
  }
}

let pickupOrdersInstance: PickupOrdersService | null = null;

export function initializePickupOrders(db: DatabaseService): void {
  pickupOrdersInstance = new PickupOrdersService(db, requireShelves());
}

function requirePickupOrders(): PickupOrdersService {
  if (!pickupOrdersInstance) {
    throw new Error('Pickup orders not initialized');
  }
  return pickupOrdersInstance;
}

export function findActive(): ReturnType<PickupOrdersService['findActive']> {
  return requirePickupOrders().findActive();
}

export function findArchived(): ReturnType<PickupOrdersService['findArchived']> {
  return requirePickupOrders().findArchived();
}

export function findById(
  ...args: Parameters<PickupOrdersService['findById']>
): ReturnType<PickupOrdersService['findById']> {
  return requirePickupOrders().findById(...args);
}

export function create(
  ...args: Parameters<PickupOrdersService['create']>
): ReturnType<PickupOrdersService['create']> {
  return requirePickupOrders().create(...args);
}

export function updateStatus(
  ...args: Parameters<PickupOrdersService['updateStatus']>
): ReturnType<PickupOrdersService['updateStatus']> {
  return requirePickupOrders().updateStatus(...args);
}

export function update(
  ...args: Parameters<PickupOrdersService['update']>
): ReturnType<PickupOrdersService['update']> {
  return requirePickupOrders().update(...args);
}

export function remove(
  ...args: Parameters<PickupOrdersService['remove']>
): ReturnType<PickupOrdersService['remove']> {
  return requirePickupOrders().remove(...args);
}

export function removeAllArchived(): ReturnType<PickupOrdersService['removeAllArchived']> {
  return requirePickupOrders().removeAllArchived();
}
