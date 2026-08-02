import { NotFoundException, BadRequestException, ForbiddenException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { requireShelves, ShelvesService } from '../shelves/shelves.service';
import { requireTables, TablesService } from '../tables/tables.service';
import { resolveOrderItemInsertId } from '../../utils/order-item-insert';

export interface Order {
  id: number;
  table_id: number;
  order_type: 'dine-in';
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived';
  total: number;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_location?: string | null;
  note?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  service_type?: 'dine-in' | 'pickup' | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shelvesService: ShelvesService,
    private readonly tablesService: TablesService,
  ) {}

  async findByTable(tableId: number): Promise<OrderWithItems[]> {
    console.log('[ORDERS] findByTable: querying orders for table_id', tableId);
    
    try {
      // Get orders - filter by status to only get active orders (pending/printed)
      const orderRows = await this.db.all(
        'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note, globalDiscount FROM orders WHERE table_id = ? AND status IN (\'pending\', \'printed\') ORDER BY created_at DESC',
        [tableId],
      );

      console.log('[ORDERS] findByTable: found', orderRows.length, 'active orders for table', tableId);

      if (orderRows.length === 0) {
        return [];
      }

      // Get items for each order
      const orderIds = orderRows.map((o: any) => o.id);
      
      // Use parameterized query to prevent SQL injection and handle empty arrays
      let itemRows: any[] = [];
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(',');
        itemRows = await this.db.all(
          `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id IN (${placeholders})`,
          orderIds,
        );
        console.log('[ORDERS] findByTable: found', itemRows.length, 'order items for', orderIds.length, 'orders');
      }

      const ordersWithItems: OrderWithItems[] = orderRows.map((order: any) => {
        // Parse globalDiscount JSON if present
        if (order.globalDiscount) {
          try {
            order.globalDiscount = JSON.parse(order.globalDiscount);
          } catch (e) {
            console.error('[ORDERS] findByTable: failed to parse globalDiscount for order', order.id, e);
            order.globalDiscount = null;
          }
        }
        
        const orderItems = itemRows.filter((item: any) => item.order_id === order.id);
        
        // Log if order has no items (potential issue)
        if (orderItems.length === 0) {
          console.warn('[ORDERS] findByTable: order', order.id, 'has no items');
        }
        
        return {
          ...order,
          items: orderItems,
        };
      });

      console.log('[ORDERS] findByTable: returning', ordersWithItems.length, 'orders with items');
      return ordersWithItems;
    } catch (error) {
      console.error('[ORDERS] findByTable: error querying orders for table', tableId, error);
      throw error;
    }
  }

  async findByHall(hallId: number): Promise<OrderWithItems[]> {
    console.log('[ORDERS] findByHall: querying orders for hall_id', hallId);
    
    // Join orders with tables to filter by hall_id
    const orderRows = await this.db.all(
      `SELECT o.id, o.table_id, o.order_type, o.status, o.total, o.created_at, o.updated_at, o.customer_name, o.customer_phone, o.customer_location, o.note, o.globalDiscount 
       FROM orders o 
       INNER JOIN tables t ON o.table_id = t.id 
       WHERE t.hall_id = ? 
       ORDER BY o.created_at DESC`,
      [hallId],
    );

    console.log('[ORDERS] findByHall: found', orderRows.length, 'orders');

    if (orderRows.length === 0) {
      return [];
    }

    // Get items for each order
    const orderIds = orderRows.map((o: any) => o.id);
    
    // Use parameterized query to prevent SQL injection and handle empty arrays
    let itemRows: any[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      itemRows = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds,
      );
      console.log('[ORDERS] findByHall: found', itemRows.length, 'order items');
    }

    const ordersWithItems: OrderWithItems[] = orderRows.map((order: any) => {
      // Parse globalDiscount JSON if present
      if (order.globalDiscount) {
        try {
          order.globalDiscount = JSON.parse(order.globalDiscount);
        } catch (e) {
          order.globalDiscount = null;
        }
      }
      
      return {
        ...order,
        items: itemRows.filter((item: any) => item.order_id === order.id),
      };
    });

    return ordersWithItems;
  }

  /**
   * @deprecated This method now queries domain tables for backward compatibility.
   * For new code, use domain-specific services directly.
   */
  async findActiveOrders(): Promise<OrderWithItems[]> {
    console.log('[ORDERS] findActiveOrders: querying active orders from domain tables (backward compatibility)');
    
    // Query all three domain tables
    // DINE_IN orders - with hall/table joins
    const dineInRows = await this.db.all(
      `SELECT 
        dio.id, 
        dio.table_id, 
        'dine-in' as order_type,
        dio.status, 
        dio.total, 
        dio.created_at, 
        dio.updated_at, 
        NULL as customer_name,
        NULL as customer_phone,
        NULL as customer_location,
        dio.note,
        dio.globalDiscount,
        t.name AS table_name,
        h.name AS hall_name
      FROM dine_in_orders dio
      INNER JOIN tables t ON dio.table_id = t.id
      INNER JOIN halls h ON dio.hall_id = h.id
      WHERE dio.status IN ('pending', 'printed') 
      ORDER BY dio.created_at ASC`,
    );

    // Combine all orders
    const allOrderRows = [...dineInRows];

    console.log('[ORDERS] findActiveOrders: found', allOrderRows.length, 'active orders from domain tables (', dineInRows.length, 'dine-in)');

    if (allOrderRows.length === 0) {
      return [];
    }

    // Parse globalDiscount JSON for each order
    allOrderRows.forEach((order: any) => {
      if (order.globalDiscount) {
        try {
          order.globalDiscount = JSON.parse(order.globalDiscount);
        } catch (e) {
          order.globalDiscount = null;
        }
      }
    });

    // Get order items from order_items for all orders
    const dineInIds = dineInRows.map((o: any) => o.id);

    const allItemRows: any[] = [];

    if (dineInIds.length > 0) {
      const placeholders = dineInIds.map(() => '?').join(',');
      const dineInItems = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, service_type
         FROM order_items 
         WHERE order_id IN (${placeholders})`,
        dineInIds,
      );
      allItemRows.push(...dineInItems);
    }

    console.log('[ORDERS] findActiveOrders: found', allItemRows.length, 'order items from order_items');

    const ordersWithItems: OrderWithItems[] = allOrderRows.map((order: any) => ({
      ...order,
      items: allItemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * @deprecated This method is READ-ONLY. Use DineInOrdersService instead.
   */
  async create(data: {
    table_id: number;
    order_type?: 'dine-in';
    items: { item_id: number; item_name: string; quantity: number; price: number; kitchen_id?: number; service_type?: 'dine-in' | 'pickup'; shelf_item_id?: number }[];
    customer_name?: string;
    customer_phone?: string;
    customer_location?: string;
    note?: string;
    globalDiscount?: { percent: number; amount: number };
    userId?: number;
    userRole?: string;
  }): Promise<OrderWithItems> {
    // SAFETY GUARD: Prevent new orders from being created in legacy orders table
    console.error('[ORDERS] ⛔ BLOCKED: Attempt to create order via legacy OrdersService.create()');
    console.error('[ORDERS] ⛔ Use DineInOrdersService instead');
    throw new BadRequestException(
      'Legacy orders table is read-only. Please use DineInOrdersService for dine-in orders.'
    );
    // Check if table is unlocked (for customer role)
    if (data.userRole === 'customer') {
      const isUnlocked = await this.tablesService.isTableUnlocked(data.table_id);
      if (!isUnlocked) {
        throw new ForbiddenException('Table must be unlocked by captain before ordering');
      }
    }

    const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderType = data.order_type || 'dine-in';

    // Prepare globalDiscount as JSON string if provided
    const globalDiscountJson = data.globalDiscount ? JSON.stringify(data.globalDiscount) : null;

    console.log('[ORDERS] create: creating order for table_id', data.table_id, 'with', data.items.length, 'items, total:', total);
    console.log('[ORDERS] create: order data -', {
      table_id: data.table_id,
      order_type: orderType,
      total,
      items_count: data.items.length,
      globalDiscount: data.globalDiscount,
      customer_name: data.customer_name,
      note: data.note,
    });

    // Insert order with globalDiscount
    await this.db.run(
      'INSERT INTO orders (table_id, order_type, status, total, created_at, customer_name, customer_phone, customer_location, note, globalDiscount) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)',
      [data.table_id, orderType, 'pending', total, data.customer_name || null, data.customer_phone || null, data.customer_location || null, data.note || null, globalDiscountJson],
    );

    const orderId = await this.db.getLastInsertRowId();
    console.log('[ORDERS] create: created order with id', orderId);

    if (!orderId || orderId === 0) {
      throw new BadRequestException('Failed to create order: Invalid order ID returned');
    }

    for (const item of data.items) {
      const serviceType = item.service_type || 'dine-in';
      console.log('[ORDERS] create: inserting order item', {
        order_id: orderId,
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        kitchen_id: item.kitchen_id,
        service_type: serviceType,
        shelf_item_id: item.shelf_item_id,
      });
      await this.db.run(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, resolveOrderItemInsertId(item.item_id, item.shelf_item_id), item.item_name, item.quantity, item.price, item.kitchen_id ?? null, serviceType, item.shelf_item_id ?? null],
      );
    }

    console.log('[ORDERS] create: inserted', data.items.length, 'order items for order', orderId);

    // Decrease stock for shelf items
    try {
      for (const item of data.items) {
        if (item.shelf_item_id !== undefined && item.shelf_item_id !== null) {
          try {
            await this.shelvesService.decreaseStock(item.shelf_item_id as number, item.quantity);
          } catch (stockErr: any) {
            // If stock decrease fails, rollback the order
            console.error('[ORDERS] create: stock decrease failed, rolling back order', orderId);
            await this.db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
            await this.db.run('DELETE FROM orders WHERE id = ?', [orderId]);
            throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
          }
        }
      }
    } catch (stockErr: any) {
      // Rollback on any error
      console.error('[ORDERS] create: error during stock update, rolling back order', orderId);
      await this.db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      await this.db.run('DELETE FROM orders WHERE id = ?', [orderId]);
      throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
    }

    // Return the created order with items
    const orderRow = await this.db.get(
      'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note, globalDiscount FROM orders WHERE id = ?',
      [orderId],
    );

    if (!orderRow) {
      throw new NotFoundException('Order not found after creation');
    }

    // Parse globalDiscount JSON if present
    const orderRowNonNull = orderRow as any;
    if (orderRowNonNull.globalDiscount) {
      try {
        orderRowNonNull.globalDiscount = JSON.parse(orderRowNonNull.globalDiscount);
      } catch (e) {
        console.error('[ORDERS] create: failed to parse globalDiscount', e);
        orderRowNonNull.globalDiscount = null;
      }
    }

    const itemRows = await this.db.all(
      'SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id = ?',
      [orderId],
    );

    console.log('[ORDERS] create: returning order with', itemRows.length, 'items');

    return {
      ...orderRow,
      items: itemRows as OrderItem[],
    } as OrderWithItems;
  }

  async updateStatus(id: number, status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'): Promise<Order> {
    console.log('[ORDERS] updateStatus: updating order', id, 'to status', status);
    
    await this.db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
    );

    const row = await this.db.get(
      'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Order not found');
    }

    // Parse globalDiscount JSON if present
    if (row.globalDiscount) {
      try {
        row.globalDiscount = JSON.parse(row.globalDiscount);
      } catch (e) {
        row.globalDiscount = null;
      }
    }

    return row as Order;
  }

  async updateOrderType(id: number, orderType: 'dine-in'): Promise<Order> {
    await this.db.run(
      'UPDATE orders SET order_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [orderType, id],
    );

    const row = await this.db.get(
      'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Order not found');
    }

    // Parse globalDiscount JSON if present
    if (row.globalDiscount) {
      try {
        row.globalDiscount = JSON.parse(row.globalDiscount);
      } catch (e) {
        row.globalDiscount = null;
      }
    }

    return row as Order;
  }

  /**
   * @deprecated This method is READ-ONLY. Use domain-specific order services to update orders.
   */
  async update(
    id: number,
    data: {
      order_type?: 'dine-in';
      items: { item_id: number; item_name: string; quantity: number; price: number; kitchen_id?: number; service_type?: 'dine-in' | 'pickup'; shelf_item_id?: number }[];
      customer_name?: string;
      customer_phone?: string;
      customer_location?: string;
      note?: string;
    },
  ): Promise<OrderWithItems> {
    // SAFETY GUARD: Prevent updates to legacy orders table
    console.error('[ORDERS] ⛔ BLOCKED: Attempt to update order via legacy OrdersService.update()');
    throw new BadRequestException(
      'Legacy orders table is read-only. Please use the new domain-specific order services to update orders.'
    );
    console.log('[ORDERS] update: updating order', id);
    
    // Check if order exists
    const existing = await this.db.get(
      'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderType = data.order_type || (existing as any).order_type;

    // Update order
    await this.db.run(
      'UPDATE orders SET order_type = ?, total = ?, updated_at = CURRENT_TIMESTAMP, customer_name = ?, customer_phone = ?, customer_location = ?, note = ? WHERE id = ?',
      [
        orderType,
        total,
        data.customer_name || null,
        data.customer_phone || null,
        data.customer_location || null,
        data.note || null,
        id,
      ],
    );

    // Delete old order items
    await this.db.run('DELETE FROM order_items WHERE order_id = ?', [id]);

    for (const item of data.items) {
      const serviceType = item.service_type || 'dine-in';
      await this.db.run(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, resolveOrderItemInsertId(item.item_id, item.shelf_item_id), item.item_name, item.quantity, item.price, item.kitchen_id ?? null, serviceType, item.shelf_item_id ?? null],
      );
    }

    // Return the updated order with items
    const orderRow = await this.db.get(
      'SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?',
      [id],
    );

    const itemRows = await this.db.all(
      'SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id = ?',
      [id],
    );

    return {
      ...orderRow,
      items: itemRows as OrderItem[],
    } as OrderWithItems;
  }

  /**
   * @deprecated This method is READ-ONLY. Use domain-specific order services to delete orders.
   */
  async remove(id: number): Promise<void> {
    // SAFETY GUARD: Prevent deletions from legacy orders table
    console.error('[ORDERS] ⛔ BLOCKED: Attempt to delete order via legacy OrdersService.remove()');
    throw new BadRequestException(
      'Legacy orders table is read-only. Please use the new domain-specific order services to delete orders.'
    );
  }

  /**
   * @deprecated This method is READ-ONLY.
   */
  async removeAll(): Promise<void> {
    // SAFETY GUARD: Prevent mass deletions from legacy orders table
    console.error('[ORDERS] ⛔ BLOCKED: Attempt to delete all orders via legacy OrdersService.removeAll()');
    throw new BadRequestException(
      'Legacy orders table is read-only. This operation is not allowed.'
    );
    console.log('[ORDERS] removeAll: deleting all orders');
    
    // Delete all order_items first
    await this.db.run('DELETE FROM order_items');

    // Then delete all orders
    await this.db.run('DELETE FROM orders');
  }

  async clearAllTables(): Promise<{ cleared: number }> {
    console.log('[ORDERS] clearAllTables: clearing all active orders');
    
    // Get all active orders (pending or printed)
    const orderRows = await this.db.all(
      "SELECT id FROM orders WHERE status IN ('pending', 'printed')",
    );

    console.log('[ORDERS] clearAllTables: found', orderRows.length, 'active orders to clear');

    if (orderRows.length === 0) {
      return { cleared: 0 };
    }

    const orderIds = orderRows.map((o: any) => o.id);

    // Update all orders to 'completed' status instead of deleting
    // This ensures they are counted in daily sales
    await this.db.run(
      `UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id IN (${orderIds.join(',')})`,
    );

    return { cleared: orderIds.length };
  }
}

let ordersInstance: OrdersService | null = null;

export function initializeOrders(db: DatabaseService): void {
  ordersInstance = new OrdersService(db, requireShelves(), requireTables());
}

function requireOrders(): OrdersService {
  if (!ordersInstance) {
    throw new Error('Orders not initialized');
  }
  return ordersInstance;
}

export function findByTable(
  ...args: Parameters<OrdersService['findByTable']>
): ReturnType<OrdersService['findByTable']> {
  return requireOrders().findByTable(...args);
}

export function findByHall(
  ...args: Parameters<OrdersService['findByHall']>
): ReturnType<OrdersService['findByHall']> {
  return requireOrders().findByHall(...args);
}

export function findActiveOrders(): ReturnType<OrdersService['findActiveOrders']> {
  return requireOrders().findActiveOrders();
}

export function create(
  ...args: Parameters<OrdersService['create']>
): ReturnType<OrdersService['create']> {
  return requireOrders().create(...args);
}

export function updateStatus(
  ...args: Parameters<OrdersService['updateStatus']>
): ReturnType<OrdersService['updateStatus']> {
  return requireOrders().updateStatus(...args);
}

export function updateOrderType(
  ...args: Parameters<OrdersService['updateOrderType']>
): ReturnType<OrdersService['updateOrderType']> {
  return requireOrders().updateOrderType(...args);
}

export function update(
  ...args: Parameters<OrdersService['update']>
): ReturnType<OrdersService['update']> {
  return requireOrders().update(...args);
}

export function remove(
  ...args: Parameters<OrdersService['remove']>
): ReturnType<OrdersService['remove']> {
  return requireOrders().remove(...args);
}

export function removeAll(): ReturnType<OrdersService['removeAll']> {
  return requireOrders().removeAll();
}

export function clearAllTables(): ReturnType<OrdersService['clearAllTables']> {
  return requireOrders().clearAllTables();
}
