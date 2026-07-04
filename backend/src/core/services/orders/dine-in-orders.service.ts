import { DatabaseService } from '../../database/database.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '../../utils/exceptions';
import { ShelvesService } from '../shelves/shelves.service';
import { TablesService } from '../halls/tables.service';

export interface DineInOrderItem {
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  shelf_item_id?: number | null;
}

export interface CreateDineInOrderDto {
  table_id: number;
  hall_id: number;
  table_session_id?: number; // Optional - will create if not provided
  items: DineInOrderItem[];
  globalDiscount?: { percent: number; amount: number };
  note?: string;
  userId?: number;
  userRole?: string;
}

export interface DineInOrder {
  id: number;
  table_id: number;
  hall_id: number;
  table_session_id: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled';
  total: number;
  discount: number;
  globalDiscount?: any;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DineInOrderWithItems extends DineInOrder {
  items: Array<{
    id: number;
    order_id: number;
    item_id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number | null;
    shelf_item_id?: number | null;
  }>;
}

export class DineInOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shelvesService: ShelvesService,
    private readonly tablesService: TablesService,
  ) {}

  /**
   * Find all dine-in orders for a specific table
   */
  async findByTable(tableId: number): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findByTable: querying orders for table_id', tableId);

    try {
      const orderRows = await this.db.all(
        `SELECT id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
         FROM dine_in_orders 
         WHERE table_id = ? AND status IN ('pending', 'printed') 
         ORDER BY created_at DESC`,
        [tableId],
      );

      console.log('[DINE_IN_ORDERS] findByTable: found', orderRows.length, 'active orders for table', tableId);

      if (orderRows.length === 0) {
        return [];
      }

      const orderIds = orderRows.map((o: any) => o.id);

      let itemRows: any[] = [];
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(',');
        itemRows = await this.db.all(
          `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id 
           FROM order_items_v2 
           WHERE order_domain = 'DINE_IN' AND order_id IN (${placeholders})`,
          orderIds,
        );
        console.log('[DINE_IN_ORDERS] findByTable: found', itemRows.length, 'order items');
      }

      const ordersWithItems: DineInOrderWithItems[] = orderRows.map((order: any) => {
        if (order.globalDiscount) {
          try {
            order.globalDiscount = JSON.parse(order.globalDiscount);
          } catch (e) {
            console.error('[DINE_IN_ORDERS] findByTable: failed to parse globalDiscount', e);
            order.globalDiscount = null;
          }
        }

        return {
          ...order,
          items: itemRows.filter((item: any) => item.order_id === order.id),
        };
      });

      return ordersWithItems;
    } catch (error) {
      console.error('[DINE_IN_ORDERS] findByTable: error', error);
      throw error;
    }
  }

  /**
   * Find all dine-in orders for a specific hall
   */
  async findByHall(hallId: number): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findByHall: querying orders for hall_id', hallId);

    const orderRows = await this.db.all(
      `SELECT id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders 
       WHERE hall_id = ? 
       ORDER BY created_at DESC`,
      [hallId],
    );

    console.log('[DINE_IN_ORDERS] findByHall: found', orderRows.length, 'orders');

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.map((o: any) => o.id);

    let itemRows: any[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      itemRows = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id 
         FROM order_items_v2 
         WHERE order_domain = 'DINE_IN' AND order_id IN (${placeholders})`,
        orderIds,
      );
    }

    const ordersWithItems: DineInOrderWithItems[] = orderRows.map((order: any) => {
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
   * Find active dine-in orders (pending/printed)
   */
  async findActive(): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findActive: querying active orders');

    const orderRows = await this.db.all(
      `SELECT dio.id, dio.table_id, dio.hall_id, dio.table_session_id, dio.status, dio.total, dio.discount, dio.globalDiscount, dio.note, dio.created_at, dio.updated_at,
              t.name AS table_name, h.name AS hall_name
       FROM dine_in_orders dio
       INNER JOIN tables t ON dio.table_id = t.id
       INNER JOIN halls h ON dio.hall_id = h.id
       WHERE dio.status IN ('pending', 'printed') 
       ORDER BY dio.created_at ASC`,
    );

    console.log('[DINE_IN_ORDERS] findActive: found', orderRows.length, 'active orders');

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
      itemRows = await this.db.all(
        `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id 
         FROM order_items_v2 
         WHERE order_domain = 'DINE_IN' AND order_id IN (${placeholders})`,
        orderIds,
      );
    }

    const ordersWithItems: DineInOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => item.order_id === order.id),
    }));

    return ordersWithItems;
  }

  /**
   * Create a new dine-in order
   * STRICT VALIDATION: Requires hall_id, table_id, and table_session_id
   */
  async create(data: CreateDineInOrderDto): Promise<DineInOrderWithItems> {
    console.log('[DINE_IN_ORDERS] create: creating dine-in order', data);

    // STRICT VALIDATION: Hall ID is REQUIRED
    if (!data.hall_id) {
      throw new BadRequestException('hall_id is required for dine-in orders');
    }

    // STRICT VALIDATION: Table ID is REQUIRED
    if (!data.table_id) {
      throw new BadRequestException('table_id is required for dine-in orders');
    }

    // Verify table exists and belongs to the specified hall
    const table = await this.db.get('SELECT id, hall_id FROM tables WHERE id = ?', [data.table_id]);
    if (!table) {
      throw new NotFoundException(`Table with id ${data.table_id} not found`);
    }
    if (table.hall_id !== data.hall_id) {
      throw new BadRequestException(`Table ${data.table_id} does not belong to hall ${data.hall_id}`);
    }

    // Verify hall exists
    const hall = await this.db.get('SELECT id FROM halls WHERE id = ?', [data.hall_id]);
    if (!hall) {
      throw new NotFoundException(`Hall with id ${data.hall_id} not found`);
    }

    // Check if table is unlocked (for customer role)
    if (data.userRole === 'customer') {
      const isUnlocked = await this.tablesService.isTableUnlocked(data.table_id);
      if (!isUnlocked) {
        throw new ForbiddenException('Table must be unlocked by captain before ordering');
      }
    }

    // STRICT VALIDATION: Validate items
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    // Handle table session - create if not provided
    let tableSessionId = data.table_session_id;
    if (!tableSessionId) {
      // Find active session for this table
      let session = await this.db.get(
        `SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
        [data.table_id],
      );

      if (!session) {
        // Create new active session
        const now = new Date().toISOString();
        await this.db.run(
          `INSERT INTO table_sessions (table_id, hall_id, started_at, status, created_at) 
           VALUES (?, ?, ?, 'active', ?)`,
          [data.table_id, data.hall_id, now, now],
        );
        
        const lastSession = await this.db.get(
          `SELECT id FROM table_sessions WHERE table_id = ? ORDER BY id DESC LIMIT 1`,
          [data.table_id],
        );
        if (!lastSession || !lastSession.id) {
          throw new BadRequestException('Failed to create table session');
        }
        tableSessionId = lastSession.id;
      } else {
        tableSessionId = session.id;
      }
    } else {
      // Verify session exists and belongs to the table
      const session = await this.db.get(
        'SELECT id, table_id FROM table_sessions WHERE id = ?',
        [tableSessionId],
      );
      if (!session) {
        throw new NotFoundException(`Table session with id ${tableSessionId} not found`);
      }
      if (session.table_id !== data.table_id) {
        throw new BadRequestException(`Table session ${tableSessionId} does not belong to table ${data.table_id}`);
      }
    }

    // Calculate total (net amount after discount)
    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = data.globalDiscount?.amount ?? 0;
    const total = Math.max(0, subtotal - discountAmount);

    // Prepare globalDiscount as JSON string
    const globalDiscountJson = data.globalDiscount ? JSON.stringify(data.globalDiscount) : null;

    console.log('[DINE_IN_ORDERS] create: inserting order with', data.items.length, 'items, total:', total);

    // Insert order
    const dbConnection = this.db.getConnection();
    const insertStmt = dbConnection.prepare(
      `INSERT INTO dine_in_orders (table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at) 
       VALUES (?, ?, ?, 'pending', ?, 0, ?, ?, datetime('now'))`,
    );

    try {
      insertStmt.bind([
        data.table_id,
        data.hall_id,
        tableSessionId,
        total,
        globalDiscountJson,
        data.note || null,
      ]);
      insertStmt.step();
    } finally {
      insertStmt.free();
    }

    // Trigger database save
    try {
      await this.db.run('SELECT 1');
    } catch (e) {
      // Ignore - just to trigger save
    }

    // Get the last insert rowid
    const orderIdResult = dbConnection.exec('SELECT last_insert_rowid() as id');
    let orderId: number;

    if (orderIdResult.length > 0 && orderIdResult[0].values.length > 0 && orderIdResult[0].values[0][0]) {
      orderId = orderIdResult[0].values[0][0] as number;
    } else {
      const fallbackOrder = await this.db.get(
        'SELECT id FROM dine_in_orders WHERE table_id = ? ORDER BY id DESC LIMIT 1',
        [data.table_id],
      );
      if (!fallbackOrder || !fallbackOrder.id) {
        throw new BadRequestException('Failed to create order: Could not retrieve order ID');
      }
      orderId = fallbackOrder.id;
    }

    console.log('[DINE_IN_ORDERS] create: created order with id', orderId);

    if (!orderId || orderId === 0) {
      throw new BadRequestException('Failed to create order: Invalid order ID returned');
    }

    // Insert order items
    const stmt = this.db.getConnection().prepare(
      `INSERT INTO order_items_v2 (order_domain, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, created_at) 
       VALUES ('DINE_IN', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    );

    try {
      for (const item of data.items) {
        console.log('[DINE_IN_ORDERS] create: inserting order item', {
          order_id: orderId,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          kitchen_id: item.kitchen_id,
          shelf_item_id: item.shelf_item_id,
        });
        stmt.bind([
          orderId,
          item.item_id,
          item.item_name,
          item.quantity,
          item.price,
          item.kitchen_id ?? null,
          item.shelf_item_id ?? null,
        ]);
        stmt.step();
        stmt.reset();
      }
    } finally {
      stmt.free();
    }

    console.log('[DINE_IN_ORDERS] create: inserted', data.items.length, 'order items');

    // Decrease stock for shelf items
    try {
      for (const item of data.items) {
        if (item.shelf_item_id) {
          try {
            await this.shelvesService.decreaseStock(item.shelf_item_id, item.quantity);
          } catch (stockErr: any) {
            console.error('[DINE_IN_ORDERS] create: stock decrease failed, rolling back order', orderId);
            await this.db.run('DELETE FROM order_items_v2 WHERE order_domain = ? AND order_id = ?', ['DINE_IN', orderId]);
            await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [orderId]);
            throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
          }
        }
      }
    } catch (stockErr: any) {
      console.error('[DINE_IN_ORDERS] create: error during stock update, rolling back order', orderId);
      await this.db.run('DELETE FROM order_items_v2 WHERE order_domain = ? AND order_id = ?', ['DINE_IN', orderId]);
      await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [orderId]);
      throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
    }

    // Return the created order with items
    const orderRow = await this.db.get(
      `SELECT id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders WHERE id = ?`,
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

    const itemRows = await this.db.all(
      `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id 
       FROM order_items_v2 
       WHERE order_domain = 'DINE_IN' AND order_id = ?`,
      [orderId],
    );

    console.log('[DINE_IN_ORDERS] create: returning order with', itemRows.length, 'items');

    return {
      ...orderRow,
      items: itemRows,
    } as DineInOrderWithItems;
  }

  /**
   * Update order status
   */
  async updateStatus(id: number, status: 'pending' | 'printed' | 'completed' | 'cancelled'): Promise<DineInOrder> {
    console.log('[DINE_IN_ORDERS] updateStatus: updating order', id, 'to status', status);

    await this.db.run(
      'UPDATE dine_in_orders SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [status, id],
    );

    const row = await this.db.get(
      `SELECT id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders WHERE id = ?`,
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

    return row as DineInOrder;
  }

  /**
   * Delete order
   */
  async remove(id: number): Promise<void> {
    console.log('[DINE_IN_ORDERS] remove: deleting order', id);

    // Delete order items first
    await this.db.run("DELETE FROM order_items_v2 WHERE order_domain = 'DINE_IN' AND order_id = ?", [id]);

    // Then delete order
    await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [id]);
  }

  /**
   * Find order by ID
   */
  async findById(id: number): Promise<DineInOrderWithItems | null> {
    const orderRow = await this.db.get(
      `SELECT id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders WHERE id = ?`,
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

    const itemRows = await this.db.all(
      `SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id 
       FROM order_items_v2 
       WHERE order_domain = 'DINE_IN' AND order_id = ?`,
      [id],
    );

    return {
      ...orderRow,
      items: itemRows,
    } as DineInOrderWithItems;
  }
}

