import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ShelvesService } from '../shelves/shelves.service';

const DELIVERY_ORDER_SELECT =
  'id, customer_name, customer_phone, customer_address, status, total, discount, globalDiscount, note, created_at, updated_at, delivery_platform_id, delivery_platform_name, delivery_platform_commission_percent';

export interface DeliveryOrderItem {
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  shelf_item_id?: number | null;
}

export interface CreateDeliveryOrderDto {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: DeliveryOrderItem[];
  globalDiscount?: { percent: number; amount: number };
  /** When set, resolved server-side; snapshot stored on the order */
  delivery_platform_id?: number | null;
  note?: string;
  userId?: number | null;
}

export interface DeliveryOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived';
  total: number;
  discount: number;
  globalDiscount?: any;
  delivery_platform_id?: number | null;
  delivery_platform_name?: string | null;
  delivery_platform_commission_percent?: number | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrderWithItems extends DeliveryOrder {
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

@Injectable()
export class DeliveryOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shelvesService: ShelvesService,
  ) {}

  /**
   * Find all active delivery orders (pending, printed - excludes completed and archived)
   * When user hits Complete, order goes directly to archived.
   */
  async findActive(): Promise<DeliveryOrderWithItems[]> {
    console.log('[DELIVERY_ORDERS] findActive: querying active delivery orders');

    const orderRows = await this.db.all(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders 
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
         WHERE order_id IN (${placeholders}) AND order_type = 'delivery'`,
        orderIds,
      );
    }

    const ordersWithItems: DeliveryOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * Find all archived delivery orders (includes legacy 'completed' for backwards compatibility)
   */
  async findArchived(): Promise<DeliveryOrderWithItems[]> {
    console.log('[DELIVERY_ORDERS] findArchived: querying archived delivery orders');

    const orderRows = await this.db.all(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders 
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
         WHERE order_id IN (${placeholders}) AND order_type = 'delivery'`,
        orderIds,
      );
    }

    const ordersWithItems: DeliveryOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * Find delivery order by ID
   */
  async findById(id: number): Promise<DeliveryOrderWithItems | null> {
    const orderRow = await this.db.get(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders WHERE id = ?`,
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
       WHERE order_id = ? AND order_type = 'delivery'`,
      [id],
    );

    return {
      ...orderRow,
      items: itemRows,
    } as DeliveryOrderWithItems;
  }

  /**
   * Create a new delivery order
   */
  async create(data: CreateDeliveryOrderDto): Promise<DeliveryOrderWithItems> {
    console.log('[DELIVERY_ORDERS] create: creating delivery order', data);

    // Validation
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = data.globalDiscount?.amount ?? 0;
    const total = Math.max(0, subtotal - discountAmount);
    const globalDiscountJson = data.globalDiscount ? JSON.stringify(data.globalDiscount) : null;

    let deliveryPlatformId: number | null = null;
    let deliveryPlatformName: string | null = null;
    let deliveryPlatformPct: number | null = null;
    if (data.delivery_platform_id != null) {
      const p = await this.db.get(
        'SELECT id, name, commission_percent FROM delivery_platforms WHERE id = ?',
        [data.delivery_platform_id],
      );
      if (!p) {
        throw new BadRequestException('Invalid delivery platform');
      }
      deliveryPlatformId = (p as { id: number }).id;
      deliveryPlatformName = (p as { name: string }).name;
      deliveryPlatformPct = (p as { commission_percent: number }).commission_percent;
    }

    const dbConnection = this.db.getConnection();
    const insertStmt = dbConnection.prepare(
      `INSERT INTO delivery_orders (customer_name, customer_phone, customer_address, status, total, discount, globalDiscount, note, created_at, created_by_user_id, delivery_platform_id, delivery_platform_name, delivery_platform_commission_percent) 
       VALUES (?, ?, ?, 'pending', ?, 0, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?)`,
    );

    try {
      insertStmt.bind([
        (data.customer_name ?? '').trim(),
        (data.customer_phone ?? '').trim(),
        (data.customer_address ?? '').trim(),
        total,
        globalDiscountJson,
        data.note || null,
        data.userId ?? null,
        deliveryPlatformId,
        deliveryPlatformName,
        deliveryPlatformPct,
      ]);
      insertStmt.step();
    } finally {
      insertStmt.free();
    }

    try {
      await this.db.run('SELECT 1');
    } catch (e) {}

    const orderIdResult = dbConnection.exec('SELECT last_insert_rowid() as id');
    let orderId: number;

    if (orderIdResult.length > 0 && orderIdResult[0].values.length > 0 && orderIdResult[0].values[0][0]) {
      orderId = orderIdResult[0].values[0][0] as number;
    } else {
      const fallbackOrder = await this.db.get(
        'SELECT id FROM delivery_orders ORDER BY id DESC LIMIT 1',
        [],
      );
      if (!fallbackOrder || !fallbackOrder.id) {
        throw new BadRequestException('Failed to create order: Could not retrieve order ID');
      }
      orderId = fallbackOrder.id;
    }

    if (!orderId || orderId === 0) {
      throw new BadRequestException('Failed to create order: Invalid order ID returned');
    }

    // CRITICAL: Include order_type='delivery' for proper domain separation
    const stmt = this.db.getConnection().prepare(
      `INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      for (const item of data.items) {
        stmt.bind([
          orderId,
          item.item_id,
          item.item_name,
          item.quantity,
          item.price,
          item.kitchen_id ?? null,
          item.shelf_item_id ?? null,
          'delivery', // CRITICAL: Set order_type for domain separation
        ]);
        stmt.step();
        stmt.reset();
      }
    } finally {
      stmt.free();
    }

    // Decrease stock for shelf items
    try {
      for (const item of data.items) {
        if (item.shelf_item_id) {
          try {
            await this.shelvesService.decreaseStock(item.shelf_item_id, item.quantity);
          } catch (stockErr: any) {
            console.error('[DELIVERY_ORDERS] create: stock decrease failed, rolling back order', orderId);
            await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'delivery'", [orderId]);
            await this.db.run('DELETE FROM delivery_orders WHERE id = ?', [orderId]);
            throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
          }
        }
      }
    } catch (stockErr: any) {
      console.error('[DELIVERY_ORDERS] create: error during stock update, rolling back order', orderId);
      await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'delivery'", [orderId]);
      await this.db.run('DELETE FROM delivery_orders WHERE id = ?', [orderId]);
      throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
    }

    const orderRow = await this.db.get(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders WHERE id = ?`,
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
       WHERE order_id = ? AND order_type = 'delivery'`,
      [orderId],
    );

    console.log('[DELIVERY_ORDERS] ✅ Created order', orderId, 'with', itemRows.length, 'items');

    return {
      ...orderRow,
      items: itemRows,
    } as DeliveryOrderWithItems;
  }

  /**
   * Update delivery order status
   */
  async updateStatus(id: number, status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'): Promise<DeliveryOrder> {
    await this.db.run(
      'UPDATE delivery_orders SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [status, id],
    );

    const row = await this.db.get(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders WHERE id = ?`,
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

    return row as DeliveryOrder;
  }

  /**
   * Update delivery order items and details
   */
  async update(id: number, data: {
    items: DeliveryOrderItem[];
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    globalDiscount?: { percent: number; amount: number };
    delivery_platform_id?: number | null;
    note?: string;
  }): Promise<DeliveryOrderWithItems> {
    console.log('[DELIVERY_ORDERS] update: updating order', id, data);

    const existing = await this.db.get(
      'SELECT id, status FROM delivery_orders WHERE id = ?',
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

    // Build update query for customer fields (only update if provided)
    const updateFields: string[] = ['total = ?', 'globalDiscount = ?', 'note = ?', "updated_at = datetime('now')"];
    const updateValues: any[] = [total, globalDiscountJson, data.note || null];

    if (data.customer_name !== undefined) {
      updateFields.push('customer_name = ?');
      updateValues.push(data.customer_name.trim());
    }
    if (data.customer_phone !== undefined) {
      updateFields.push('customer_phone = ?');
      updateValues.push(data.customer_phone.trim());
    }
    if (data.customer_address !== undefined) {
      updateFields.push('customer_address = ?');
      updateValues.push(data.customer_address.trim());
    }

    if (data.delivery_platform_id !== undefined) {
      if (data.delivery_platform_id === null) {
        updateFields.push('delivery_platform_id = ?', 'delivery_platform_name = ?', 'delivery_platform_commission_percent = ?');
        updateValues.push(null, null, null);
      } else {
        const p = await this.db.get(
          'SELECT id, name, commission_percent FROM delivery_platforms WHERE id = ?',
          [data.delivery_platform_id],
        );
        if (!p) {
          throw new BadRequestException('Invalid delivery platform');
        }
        const row = p as { id: number; name: string; commission_percent: number };
        updateFields.push('delivery_platform_id = ?', 'delivery_platform_name = ?', 'delivery_platform_commission_percent = ?');
        updateValues.push(row.id, row.name, row.commission_percent);
      }
    }

    updateValues.push(id);

    // Update order
    await this.db.run(
      `UPDATE delivery_orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues,
    );

    // Delete old order items (only for this order_type to prevent accidental deletion)
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'delivery'", [id]);

    // Insert new order items
    // CRITICAL: Include order_type='delivery' for proper domain separation
    const stmt = this.db.getConnection().prepare(
      `INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, order_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      for (const item of data.items) {
        stmt.bind([
          id,
          item.item_id,
          item.item_name,
          item.quantity,
          item.price,
          item.kitchen_id ?? null,
          item.shelf_item_id ?? null,
          'delivery', // CRITICAL: Set order_type for domain separation
        ]);
        stmt.step();
        stmt.reset();
      }
    } finally {
      stmt.free();
    }

    // Return the updated order with items
    const orderRow = await this.db.get(
      `SELECT ${DELIVERY_ORDER_SELECT}
       FROM delivery_orders WHERE id = ?`,
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
       WHERE order_id = ? AND order_type = 'delivery'`,
      [id],
    );

    return {
      ...orderRow,
      items: itemRows,
    } as DeliveryOrderWithItems;
  }

  /**
   * Delete delivery order
   */
  async remove(id: number): Promise<void> {
    // CRITICAL: Only delete items with matching order_type to prevent accidental deletion
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'delivery'", [id]);
    await this.db.run('DELETE FROM delivery_orders WHERE id = ?', [id]);
  }

  /**
   * Delete all archived delivery orders (includes legacy completed)
   */
  async removeAllArchived(): Promise<number> {
    const archivedOrders = await this.db.all(
      'SELECT id FROM delivery_orders WHERE status IN (?, ?)',
      ['archived', 'completed'],
    );
    
    if (archivedOrders.length === 0) {
      return 0;
    }

    const orderIds = archivedOrders.map((o: any) => o.id);
    
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      await this.db.run(
        `DELETE FROM order_items WHERE order_id IN (${placeholders}) AND order_type = 'delivery'`,
        orderIds,
      );
    }

    await this.db.run(
      'DELETE FROM delivery_orders WHERE status IN (?, ?)',
      ['archived', 'completed'],
    );

    return archivedOrders.length;
  }
}

