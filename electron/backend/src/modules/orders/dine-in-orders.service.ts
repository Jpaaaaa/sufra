import { NotFoundException, BadRequestException, ForbiddenException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { requireShelves, ShelvesService } from '../shelves/shelves.service';
import { requireTables, TablesService } from '../tables/tables.service';
import { resolveOrderShiftFields } from '../settings/resolve-order-shift';
import { allocateDailyDisplayNumber } from './daily-display-number';
import { mapOrderItemRow } from '../../utils/order-item-options';
import {
  distributeTableDiscount,
  parseStoredGlobalDiscount,
  getTableDiscountTotal,
} from '../../utils/order-pricing';
import {
  ORDER_ITEM_SELECT_COLS,
  type OrderItemInput,
  topLevelSubtotal,
  topLevelSubtotalFromRows,
  validateOrderItemsWithTrays,
  insertOrderItemsWithTrays,
  shelfStockDecrements,
} from '../../utils/order-trays';

function mapItemRows(rows: any[]) {
  return rows.map((row) => mapOrderItemRow(row));
}

export type DineInOrderItem = OrderItemInput;

export interface CreateDineInOrderDto {
  table_id: number;
  hall_id: number;
  table_session_id?: number;
  items: DineInOrderItem[];
  globalDiscount?: { percent: number; amount: number };
  note?: string;
  userId?: number;
  userRole?: string;
}

export interface DineInOrder {
  id: number;
  /** Daily ticket # for business_date (resets each business day). */
  display_number?: number | null;
  table_id: number;
  hall_id: number;
  table_session_id: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived';
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
    item_id: number | null;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number | null;
    service_type?: 'dine-in' | 'pickup' | null;
    shelf_item_id?: number | null;
    line_kind?: string | null;
    parent_order_item_id?: number | null;
  }>;
}

class DineInOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shelvesService: ShelvesService,
    private readonly tablesService: TablesService,
  ) {}

  async findByTable(tableId: number): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findByTable: querying orders for table_id', tableId);

    try {
      const orderRows = await this.db.all(
        `SELECT id, display_number, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
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
        // CRITICAL: Always filter by order_type to ensure domain separation
        itemRows = await this.db.all(
          `SELECT ${ORDER_ITEM_SELECT_COLS}
           FROM order_items 
           WHERE order_id IN (${placeholders}) AND order_type = 'dine_in'`,
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
          items: mapItemRows(itemRows.filter((item: any) => item.order_id === order.id)),
        };
      });

      return ordersWithItems;
    } catch (error) {
      console.error('[DINE_IN_ORDERS] findByTable: error', error);
      throw error;
    }
  }

  async findByHall(hallId: number): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findByHall: querying orders for hall_id', hallId);

    const orderRows = await this.db.all(
      `SELECT dio.id, dio.display_number, dio.table_id, dio.hall_id, dio.table_session_id, dio.status, dio.total, dio.discount, dio.globalDiscount, dio.note, dio.created_at, dio.updated_at,
              t.name AS table_name, t.number AS table_number, h.name AS hall_name, f.name AS floor_name
       FROM dine_in_orders dio
       LEFT JOIN tables t ON dio.table_id = t.id
       LEFT JOIN halls h ON dio.hall_id = h.id
       LEFT JOIN floors f ON h.floor_id = f.id
       WHERE dio.hall_id = ? 
       ORDER BY dio.created_at DESC`,
      [hallId],
    );

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.map((o: any) => o.id);

    let itemRows: any[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
        // CRITICAL: Always filter by order_type to ensure domain separation
        itemRows = await this.db.all(
          `SELECT ${ORDER_ITEM_SELECT_COLS}
           FROM order_items 
           WHERE order_id IN (${placeholders}) AND order_type = 'dine_in'`,
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
        items: mapItemRows(itemRows.filter((item: any) => item.order_id === order.id)),
      };
    });

    return ordersWithItems;
  }

  async findActive(): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findActive: querying active orders');

    const orderRows = await this.db.all(
      `SELECT dio.id, dio.display_number, dio.table_id, dio.hall_id, dio.table_session_id, dio.status, dio.total, dio.discount, dio.globalDiscount, dio.note, dio.created_at, dio.updated_at,
              t.name AS table_name, h.name AS hall_name
       FROM dine_in_orders dio
       INNER JOIN tables t ON dio.table_id = t.id
       INNER JOIN halls h ON dio.hall_id = h.id
       WHERE dio.status IN ('pending', 'printed') 
       ORDER BY dio.created_at ASC`,
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
          `SELECT ${ORDER_ITEM_SELECT_COLS}
           FROM order_items 
           WHERE order_id IN (${placeholders}) AND order_type = 'dine_in'`,
          orderIds,
        );
    }

    const ordersWithItems: DineInOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: mapItemRows(itemRows.filter((item: any) => item.order_id === order.id)),
    }));

    return ordersWithItems;
  }

  /**
   * Find all archived dine-in orders (completed or archived status)
   */
  async findArchived(): Promise<DineInOrderWithItems[]> {
    console.log('[DINE_IN_ORDERS] findArchived: querying archived dine-in orders');

    // First, let's check all order statuses for debugging
    const allStatuses = await this.db.all(
      `SELECT status, COUNT(*) as count FROM dine_in_orders GROUP BY status`
    );
    console.log('[DINE_IN_ORDERS] findArchived: all order statuses in database:', allStatuses);

    // First, check raw count without joins
    const rawCount = await this.db.get(
      `SELECT COUNT(*) as count FROM dine_in_orders WHERE status IN ('completed', 'archived', 'cancelled')`
    );
    console.log('[DINE_IN_ORDERS] findArchived: raw count of completed/archived/cancelled orders:', rawCount?.count || 0);

    const orderRows = await this.db.all(
      `SELECT dio.id, dio.display_number, dio.table_id, dio.hall_id, dio.table_session_id, dio.status, dio.total, dio.discount, dio.globalDiscount, dio.note, dio.created_at, dio.updated_at,
              t.name AS table_name, h.name AS hall_name
       FROM dine_in_orders dio
       LEFT JOIN tables t ON dio.table_id = t.id
       LEFT JOIN halls h ON dio.hall_id = h.id
       WHERE dio.status IN ('completed', 'archived', 'cancelled')
       ORDER BY dio.created_at DESC`,
    );

    console.log('[DINE_IN_ORDERS] findArchived: found', orderRows.length, 'archived/completed orders after JOIN');
    if (orderRows.length > 0) {
      console.log('[DINE_IN_ORDERS] findArchived: sample order:', JSON.stringify(orderRows[0], null, 2));
    } else if (rawCount && rawCount.count > 0) {
      console.log('[DINE_IN_ORDERS] findArchived: WARNING - Raw count shows', rawCount.count, 'orders but JOIN returned 0. Possible issue with table/hall joins.');
    }

    if (orderRows.length === 0) {
      console.log('[DINE_IN_ORDERS] findArchived: no archived orders found');
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
        `SELECT ${ORDER_ITEM_SELECT_COLS}
         FROM order_items 
         WHERE order_id IN (${placeholders}) AND order_type = 'dine_in'`,
        orderIds,
      );
    }

    const ordersWithItems: DineInOrderWithItems[] = orderRows.map((order: any) => ({
      ...order,
      items: mapItemRows(itemRows.filter((item: any) => item.order_id === order.id)),
    }));

    return ordersWithItems;
  }

  async create(data: CreateDineInOrderDto): Promise<DineInOrderWithItems> {
    console.log('[DINE_IN_ORDERS] create: creating dine-in order', data);

    // STRICT VALIDATION
    if (!data.hall_id) {
      throw new BadRequestException('hall_id is required for dine-in orders');
    }
    if (!data.table_id) {
      throw new BadRequestException('table_id is required for dine-in orders');
    }
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    // Verify table and hall
    const table = await this.db.get('SELECT id, hall_id FROM tables WHERE id = ?', [data.table_id]);
    if (!table) {
      throw new NotFoundException(`Table with id ${data.table_id} not found`);
    }
    if (table.hall_id !== data.hall_id) {
      throw new BadRequestException(`Table ${data.table_id} does not belong to hall ${data.hall_id}`);
    }

    const hall = await this.db.get('SELECT id FROM halls WHERE id = ?', [data.hall_id]);
    if (!hall) {
      throw new NotFoundException(`Hall with id ${data.hall_id} not found`);
    }

    if (data.userRole === 'customer') {
      const isUnlocked = await this.tablesService.isTableUnlocked(data.table_id);
      if (!isUnlocked) {
        throw new ForbiddenException('Table must be unlocked by captain before ordering');
      }
    }

    // Handle table session
    let tableSessionId = data.table_session_id;
    if (!tableSessionId) {
      let session = await this.db.get(
        `SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
        [data.table_id],
      );

      if (!session) {
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
    }

    await validateOrderItemsWithTrays(this.db, data.items);
    const total = topLevelSubtotal(data.items);
    const globalDiscountJson: string | null = null;
    const shiftFields = await resolveOrderShiftFields();
    const displayNumber = await allocateDailyDisplayNumber(this.db, shiftFields.business_date);

    await this.db.run(
      `INSERT INTO dine_in_orders (table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, created_by_user_id, business_date, shift_definition_id, display_number) 
       VALUES (?, ?, ?, 'pending', ?, 0, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?)`,
      [
        data.table_id,
        data.hall_id,
        tableSessionId,
        total,
        globalDiscountJson,
        data.note || null,
        data.userId ?? null,
        shiftFields.business_date,
        shiftFields.shift_definition_id,
        displayNumber,
      ],
    );

    const orderId = await this.db.getLastInsertRowId();
    if (!orderId || orderId === 0) {
      throw new BadRequestException('Failed to create order: Invalid order ID returned');
    }

    await insertOrderItemsWithTrays(this.db, {
      orderId,
      orderType: 'dine_in',
      items: data.items,
      withServiceType: true,
    });

    console.log('[DINE_IN_ORDERS] ✅ Order created with id', orderId);

    // Decrease stock for shelf items (tray children × tray qty)
    try {
      for (const stock of shelfStockDecrements(data.items)) {
        try {
          await this.shelvesService.decreaseStock(stock.shelf_item_id, stock.quantity);
        } catch (stockErr: any) {
          console.error('[DINE_IN_ORDERS] create: stock decrease failed, rolling back order', orderId);
          await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'dine_in'", [orderId]);
          await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [orderId]);
          throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
        }
      }
    } catch (stockErr: any) {
      if (stockErr instanceof BadRequestException) throw stockErr;
      console.error('[DINE_IN_ORDERS] create: error during stock update, rolling back order', orderId);
      await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'dine_in'", [orderId]);
      await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [orderId]);
      throw new BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
    }

    if (data.globalDiscount) {
      await this.setTableGlobalDiscount(data.table_id, data.globalDiscount);
    } else {
      await this.redistributeTableDiscountIfNeeded(data.table_id);
    }

    const orderRow = await this.db.get(
      `SELECT id, display_number, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
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

    // CRITICAL: Always filter by order_type to ensure domain separation
    const itemRows = await this.db.all(
      `SELECT ${ORDER_ITEM_SELECT_COLS}
       FROM order_items 
       WHERE order_id = ? AND order_type = 'dine_in'`,
      [orderId],
    );

    console.log('[DINE_IN_ORDERS] ✅ Created order', orderId, 'with', itemRows.length, 'items');

    return {
      ...orderRow,
      items: mapItemRows(itemRows),
    } as DineInOrderWithItems;
  }

  async updateStatus(id: number, status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'): Promise<DineInOrder> {
    console.log('[DINE_IN_ORDERS] updateStatus: updating order', id, 'to status', status);
    await this.db.run(
      'UPDATE dine_in_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
    );
    console.log('[DINE_IN_ORDERS] updateStatus: order', id, 'updated to', status);

    const row = await this.db.get(
      `SELECT id, display_number, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    
    console.log('[DINE_IN_ORDERS] updateStatus: verified order', id, 'status is now:', row.status);

    if (row.globalDiscount) {
      try {
        row.globalDiscount = JSON.parse(row.globalDiscount);
      } catch (e) {
        row.globalDiscount = null;
      }
    }

    return row as DineInOrder;
  }

  async update(id: number, data: {
    items: DineInOrderItem[];
    globalDiscount?: { percent: number; amount: number };
    note?: string;
  }): Promise<DineInOrderWithItems> {
    console.log('[DINE_IN_ORDERS] update: updating order', id, data);

    const existing = await this.db.get(
      'SELECT id, table_id, hall_id, status FROM dine_in_orders WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    await validateOrderItemsWithTrays(this.db, data.items);
    const total = topLevelSubtotal(data.items);

    // Update order (discount is applied at table level via setTableGlobalDiscount)
    await this.db.run(
      'UPDATE dine_in_orders SET total = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [total, data.note || null, id],
    );

    // Delete old order items (only for this order_type to prevent accidental deletion)
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'dine_in'", [id]);

    await insertOrderItemsWithTrays(this.db, {
      orderId: id,
      orderType: 'dine_in',
      items: data.items,
      withServiceType: true,
    });

    console.log('[DINE_IN_ORDERS] ✅ Order updated with id', id);

    if (data.globalDiscount) {
      await this.setTableGlobalDiscount(existing.table_id, data.globalDiscount);
    } else {
      await this.redistributeTableDiscountIfNeeded(existing.table_id);
    }

    // Return the updated order with items
    const orderRow = await this.db.get(
      `SELECT id, display_number, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
       FROM dine_in_orders WHERE id = ?`,
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

    const itemRows = await this.db.all(
      `SELECT ${ORDER_ITEM_SELECT_COLS} 
       FROM order_items 
       WHERE order_id = ?`,
      [id],
    );

    return {
      ...orderRow,
      items: mapItemRows(itemRows),
    } as DineInOrderWithItems;
  }

  async remove(id: number): Promise<void> {
    // CRITICAL: Only delete items with matching order_type to prevent accidental deletion
    await this.db.run("DELETE FROM order_items WHERE order_id = ? AND order_type = 'dine_in'", [id]);
    await this.db.run('DELETE FROM dine_in_orders WHERE id = ?', [id]);
  }

  async findById(id: number): Promise<DineInOrderWithItems | null> {
    const orderRow = await this.db.get(
      `SELECT id, display_number, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at 
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
      `SELECT ${ORDER_ITEM_SELECT_COLS} 
       FROM order_items 
       WHERE order_id = ?`,
      [id],
    );

    return {
      ...orderRow,
      items: mapItemRows(itemRows),
    } as DineInOrderWithItems;
  }

  /**
   * Move all orders from source table to target table
   * Source table becomes empty; target table receives all orders
   * POST /orders/dine-in/move-table
   */
  async moveTableOrders(
    sourceTableId: number,
    targetTableId: number,
  ): Promise<{ movedCount: number }> {
    if (sourceTableId === targetTableId) {
      throw new BadRequestException('Source and target table must be different');
    }

    const orders = await this.db.all(
      `SELECT id, hall_id, table_session_id FROM dine_in_orders 
       WHERE table_id = ? AND status IN ('pending', 'printed')`,
      [sourceTableId],
    );

    if (orders.length === 0) {
      return { movedCount: 0 };
    }

    const targetTable = await this.db.get(
      'SELECT id, hall_id FROM tables WHERE id = ?',
      [targetTableId],
    );
    if (!targetTable) {
      throw new NotFoundException(`Table with id ${targetTableId} not found`);
    }

    let session = await this.db.get(
      `SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
      [targetTableId],
    );

    if (!session) {
      const now = new Date().toISOString();
      await this.db.run(
        `INSERT INTO table_sessions (table_id, hall_id, started_at, status, created_at) 
         VALUES (?, ?, ?, 'active', ?)`,
        [targetTableId, targetTable.hall_id, now, now],
      );
      session = await this.db.get(
        `SELECT id FROM table_sessions WHERE table_id = ? ORDER BY id DESC LIMIT 1`,
        [targetTableId],
      );
      if (!session?.id) {
        throw new BadRequestException('Failed to create table session for target table');
      }
    }

    const targetHallId = targetTable.hall_id;
    const targetSessionId = session.id;

    for (const order of orders) {
      await this.db.run(
        `UPDATE dine_in_orders SET table_id = ?, hall_id = ?, table_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [targetTableId, targetHallId, targetSessionId, order.id],
      );
    }

    console.log('[DINE_IN_ORDERS] moveTableOrders: moved', orders.length, 'orders from table', sourceTableId, 'to', targetTableId);
    return { movedCount: orders.length };
  }

  /**
   * Move specific orders to a target table
   * POST /orders/dine-in/move-orders
   */
  async moveOrders(
    orderIds: number[],
    targetTableId: number,
  ): Promise<{ movedCount: number }> {
    if (!orderIds?.length) {
      return { movedCount: 0 };
    }

    const uniqueIds = [...new Set(orderIds)].filter((id) => typeof id === 'number' && !isNaN(id));
    if (uniqueIds.length === 0) {
      return { movedCount: 0 };
    }

    const placeholders = uniqueIds.map(() => '?').join(',');
    const orders = await this.db.all(
      `SELECT id, hall_id, table_session_id, table_id FROM dine_in_orders 
       WHERE id IN (${placeholders}) AND status IN ('pending', 'printed')`,
      uniqueIds,
    );

    if (orders.length === 0) {
      return { movedCount: 0 };
    }

    const targetTable = await this.db.get(
      'SELECT id, hall_id FROM tables WHERE id = ?',
      [targetTableId],
    );
    if (!targetTable) {
      throw new NotFoundException(`Table with id ${targetTableId} not found`);
    }

    let session = await this.db.get(
      `SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
      [targetTableId],
    );

    if (!session) {
      const now = new Date().toISOString();
      await this.db.run(
        `INSERT INTO table_sessions (table_id, hall_id, started_at, status, created_at) 
         VALUES (?, ?, ?, 'active', ?)`,
        [targetTableId, targetTable.hall_id, now, now],
      );
      session = await this.db.get(
        `SELECT id FROM table_sessions WHERE table_id = ? ORDER BY id DESC LIMIT 1`,
        [targetTableId],
      );
      if (!session?.id) {
        throw new BadRequestException('Failed to create table session for target table');
      }
    }

    const targetHallId = targetTable.hall_id;
    const targetSessionId = session.id;

    for (const order of orders) {
      await this.db.run(
        `UPDATE dine_in_orders SET table_id = ?, hall_id = ?, table_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [targetTableId, targetHallId, targetSessionId, order.id],
      );
    }

    console.log('[DINE_IN_ORDERS] moveOrders: moved', orders.length, 'orders to table', targetTableId);
    return { movedCount: orders.length };
  }

  /**
   * Set global discount for all active orders on a table
   * PATCH /orders/table/:tableId/global-discount
   */
  async setTableGlobalDiscount(
    tableId: number,
    globalDiscount: { percent: number; amount: number } | null,
  ): Promise<{ updatedCount: number }> {
    console.log('[DINE_IN_ORDERS] setTableGlobalDiscount: table', tableId, 'discount', globalDiscount);

    const orders = await this.db.all(
      `SELECT id FROM dine_in_orders WHERE table_id = ? AND status IN ('pending', 'printed')`,
      [tableId],
    );

    if (orders.length === 0) {
      return { updatedCount: 0 };
    }

    const orderSubtotalRows: Array<{ orderId: number; subtotal: number }> = [];

    for (const order of orders) {
      const items = await this.db.all(
        `SELECT quantity, price, parent_order_item_id FROM order_items WHERE order_id = ? AND order_type = 'dine_in'`,
        [order.id],
      );
      const subtotal = topLevelSubtotalFromRows(items as Array<{ price: number; quantity: number; parent_order_item_id?: number | null }>);
      orderSubtotalRows.push({ orderId: order.id, subtotal });
    }

    if (!globalDiscount) {
      for (const row of orderSubtotalRows) {
        await this.db.run(
          'UPDATE dine_in_orders SET globalDiscount = NULL, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [row.subtotal, row.orderId],
        );
      }
      console.log('[DINE_IN_ORDERS] setTableGlobalDiscount: cleared discount on', orders.length, 'orders');
      return { updatedCount: orders.length };
    }

    const distribution = distributeTableDiscount(orderSubtotalRows, globalDiscount);

    for (const row of orderSubtotalRows) {
      const entry = distribution.get(row.orderId);
      if (!entry) continue;
      const newTotal = Math.max(0, row.subtotal - entry.proportionalAmount);
      await this.db.run(
        'UPDATE dine_in_orders SET globalDiscount = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [entry.discountJson, newTotal, row.orderId],
      );
    }

    console.log('[DINE_IN_ORDERS] setTableGlobalDiscount: updated', orders.length, 'orders');
    return { updatedCount: orders.length };
  }

  private async getTableDiscountFromOpenOrders(
    tableId: number,
  ): Promise<{ percent: number; amount: number } | null> {
    const row = await this.db.get(
      `SELECT globalDiscount FROM dine_in_orders
       WHERE table_id = ? AND status IN ('pending', 'printed') AND globalDiscount IS NOT NULL
       LIMIT 1`,
      [tableId],
    );
    if (!row?.globalDiscount) return null;

    const parsed = parseStoredGlobalDiscount(row.globalDiscount);
    if (!parsed) return null;

    return {
      percent: parsed.percent,
      amount: getTableDiscountTotal(parsed),
    };
  }

  private async redistributeTableDiscountIfNeeded(tableId: number): Promise<void> {
    const discount = await this.getTableDiscountFromOpenOrders(tableId);
    if (discount) {
      await this.setTableGlobalDiscount(tableId, discount);
    }
  }

  /**
   * Delete all archived dine-in orders (completed or archived status)
   */
  async removeAllArchived(): Promise<number> {
    console.log('[DINE_IN_ORDERS] removeAllArchived: deleting all archived/completed dine-in orders');
    
    // Get all archived/completed order IDs first
    const archivedOrders = await this.db.all(
      'SELECT id FROM dine_in_orders WHERE status IN (?, ?)',
      ['completed', 'archived'],
    );
    
    if (archivedOrders.length === 0) {
      console.log('[DINE_IN_ORDERS] removeAllArchived: no archived orders to delete');
      return 0;
    }

    const orderIds = archivedOrders.map((o: any) => o.id);
    console.log('[DINE_IN_ORDERS] removeAllArchived: deleting', orderIds.length, 'orders');
    
    // Delete order items first (CRITICAL: filter by order_type)
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      await this.db.run(
        `DELETE FROM order_items WHERE order_id IN (${placeholders}) AND order_type = 'dine_in'`,
        orderIds,
      );
    }

    // Delete archived/completed orders
    await this.db.run(
      'DELETE FROM dine_in_orders WHERE status IN (?, ?)',
      ['completed', 'archived'],
    );

    console.log('[DINE_IN_ORDERS] removeAllArchived: deleted', archivedOrders.length, 'orders');
    return archivedOrders.length;
  }
}

let dineInOrdersInstance: DineInOrdersService | null = null;

export function initializeDineInOrders(db: DatabaseService): void {
  dineInOrdersInstance = new DineInOrdersService(db, requireShelves(), requireTables());
}

function requireDineInOrders(): DineInOrdersService {
  if (!dineInOrdersInstance) {
    throw new Error('Dine-in orders not initialized');
  }
  return dineInOrdersInstance;
}

export function findByTable(
  ...args: Parameters<DineInOrdersService['findByTable']>
): ReturnType<DineInOrdersService['findByTable']> {
  return requireDineInOrders().findByTable(...args);
}

export function findByHall(
  ...args: Parameters<DineInOrdersService['findByHall']>
): ReturnType<DineInOrdersService['findByHall']> {
  return requireDineInOrders().findByHall(...args);
}

export function findActive(): ReturnType<DineInOrdersService['findActive']> {
  return requireDineInOrders().findActive();
}

export function findArchived(): ReturnType<DineInOrdersService['findArchived']> {
  return requireDineInOrders().findArchived();
}

export function create(
  ...args: Parameters<DineInOrdersService['create']>
): ReturnType<DineInOrdersService['create']> {
  return requireDineInOrders().create(...args);
}

export function updateStatus(
  ...args: Parameters<DineInOrdersService['updateStatus']>
): ReturnType<DineInOrdersService['updateStatus']> {
  return requireDineInOrders().updateStatus(...args);
}

export function update(
  ...args: Parameters<DineInOrdersService['update']>
): ReturnType<DineInOrdersService['update']> {
  return requireDineInOrders().update(...args);
}

export function remove(
  ...args: Parameters<DineInOrdersService['remove']>
): ReturnType<DineInOrdersService['remove']> {
  return requireDineInOrders().remove(...args);
}

export function findById(
  ...args: Parameters<DineInOrdersService['findById']>
): ReturnType<DineInOrdersService['findById']> {
  return requireDineInOrders().findById(...args);
}

export function moveTableOrders(
  ...args: Parameters<DineInOrdersService['moveTableOrders']>
): ReturnType<DineInOrdersService['moveTableOrders']> {
  return requireDineInOrders().moveTableOrders(...args);
}

export function moveOrders(
  ...args: Parameters<DineInOrdersService['moveOrders']>
): ReturnType<DineInOrdersService['moveOrders']> {
  return requireDineInOrders().moveOrders(...args);
}

export function setTableGlobalDiscount(
  ...args: Parameters<DineInOrdersService['setTableGlobalDiscount']>
): ReturnType<DineInOrdersService['setTableGlobalDiscount']> {
  return requireDineInOrders().setTableGlobalDiscount(...args);
}

export function removeAllArchived(): ReturnType<DineInOrdersService['removeAllArchived']> {
  return requireDineInOrders().removeAllArchived();
}
