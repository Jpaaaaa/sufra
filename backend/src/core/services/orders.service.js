"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const exceptions_1 = require("../utils/exceptions");
class OrdersService {
    constructor(db, shelvesService, tablesService) {
        this.db = db;
        this.shelvesService = shelvesService;
        this.tablesService = tablesService;
    }
    async findByTable(tableId) {
        console.log('[ORDERS] findByTable: querying orders for table_id', tableId);
        try {
            // Get orders - filter by status to only get active orders (pending/printed)
            const orderRows = await this.db.all('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note, globalDiscount FROM orders WHERE table_id = ? AND status IN (\'pending\', \'printed\') ORDER BY created_at DESC', [tableId]);
            console.log('[ORDERS] findByTable: found', orderRows.length, 'active orders for table', tableId);
            if (orderRows.length === 0) {
                return [];
            }
            // Get items for each order
            const orderIds = orderRows.map((o) => o.id);
            // Use parameterized query to prevent SQL injection and handle empty arrays
            let itemRows = [];
            if (orderIds.length > 0) {
                const placeholders = orderIds.map(() => '?').join(',');
                itemRows = await this.db.all(`SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
                console.log('[ORDERS] findByTable: found', itemRows.length, 'order items for', orderIds.length, 'orders');
            }
            const ordersWithItems = orderRows.map((order) => {
                // Parse globalDiscount JSON if present
                if (order.globalDiscount) {
                    try {
                        order.globalDiscount = JSON.parse(order.globalDiscount);
                    }
                    catch (e) {
                        console.error('[ORDERS] findByTable: failed to parse globalDiscount for order', order.id, e);
                        order.globalDiscount = null;
                    }
                }
                const orderItems = itemRows.filter((item) => item.order_id === order.id);
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
        }
        catch (error) {
            console.error('[ORDERS] findByTable: error querying orders for table', tableId, error);
            throw error;
        }
    }
    async findByHall(hallId) {
        console.log('[ORDERS] findByHall: querying orders for hall_id', hallId);
        // Join orders with tables to filter by hall_id
        const orderRows = await this.db.all(`SELECT o.id, o.table_id, o.order_type, o.status, o.total, o.created_at, o.updated_at, o.customer_name, o.customer_phone, o.customer_location, o.note, o.globalDiscount 
       FROM orders o 
       INNER JOIN tables t ON o.table_id = t.id 
       WHERE t.hall_id = ? 
       ORDER BY o.created_at DESC`, [hallId]);
        console.log('[ORDERS] findByHall: found', orderRows.length, 'orders');
        if (orderRows.length === 0) {
            return [];
        }
        // Get items for each order
        const orderIds = orderRows.map((o) => o.id);
        // Use parameterized query to prevent SQL injection and handle empty arrays
        let itemRows = [];
        if (orderIds.length > 0) {
            const placeholders = orderIds.map(() => '?').join(',');
            itemRows = await this.db.all(`SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
            console.log('[ORDERS] findByHall: found', itemRows.length, 'order items');
        }
        const ordersWithItems = orderRows.map((order) => {
            // Parse globalDiscount JSON if present
            if (order.globalDiscount) {
                try {
                    order.globalDiscount = JSON.parse(order.globalDiscount);
                }
                catch (e) {
                    order.globalDiscount = null;
                }
            }
            return {
                ...order,
                items: itemRows.filter((item) => item.order_id === order.id),
            };
        });
        return ordersWithItems;
    }
    async findActiveOrders() {
        console.log('[ORDERS] findActiveOrders: querying active orders (pending/printed)');
        const orderRows = await this.db.all(`SELECT 
        o.id, 
        o.table_id, 
        o.order_type, 
        o.status, 
        o.total, 
        o.created_at, 
        o.updated_at, 
        o.customer_name, 
        o.customer_phone, 
        o.customer_location,
        o.note,
        o.globalDiscount,
        t.name AS table_name,
        h.name AS hall_name
      FROM orders o
      INNER JOIN tables t ON o.table_id = t.id
      INNER JOIN halls h ON t.hall_id = h.id
      WHERE o.status IN ('pending', 'printed') 
      ORDER BY o.created_at ASC`);
        console.log('[ORDERS] findActiveOrders: found', orderRows.length, 'active orders');
        if (orderRows.length === 0) {
            return [];
        }
        // Parse globalDiscount JSON for each order
        orderRows.forEach((order) => {
            if (order.globalDiscount) {
                try {
                    order.globalDiscount = JSON.parse(order.globalDiscount);
                }
                catch (e) {
                    order.globalDiscount = null;
                }
            }
        });
        const orderIds = orderRows.map((o) => o.id);
        // Use parameterized query to prevent SQL injection and handle empty arrays
        let itemRows = [];
        if (orderIds.length > 0) {
            const placeholders = orderIds.map(() => '?').join(',');
            itemRows = await this.db.all(`SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
            console.log('[ORDERS] findActiveOrders: found', itemRows.length, 'order items');
        }
        const ordersWithItems = orderRows.map((order) => ({
            ...order,
            items: itemRows.filter((item) => item.order_id === order.id),
        }));
        return ordersWithItems;
    }
    async create(data) {
        // Check if table is unlocked (for customer role)
        if (data.userRole === 'customer') {
            const isUnlocked = await this.tablesService.isTableUnlocked(data.table_id);
            if (!isUnlocked) {
                throw new exceptions_1.ForbiddenException('Table must be unlocked by captain before ordering');
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
        // Use the connection directly to ensure last_insert_rowid() works correctly
        const dbConnection = this.db.getConnection();
        // Insert order using prepared statement to ensure rowid tracking
        const insertStmt = dbConnection.prepare('INSERT INTO orders (table_id, order_type, status, total, created_at, customer_name, customer_phone, customer_location, note, globalDiscount) VALUES (?, ?, ?, ?, datetime("now"), ?, ?, ?, ?, ?)');
        try {
            insertStmt.bind([data.table_id, orderType, 'pending', total, data.customer_name || null, data.customer_phone || null, data.customer_location || null, data.note || null, globalDiscountJson]);
            insertStmt.step();
        }
        finally {
            insertStmt.free();
        }
        // Trigger database save after INSERT (since we used connection directly)
        // The database service will handle the actual save
        try {
            await this.db.run('SELECT 1');
        }
        catch (e) {
            // Ignore - this is just to trigger save
        }
        // Get the last insert rowid immediately after INSERT
        const orderIdResult = dbConnection.exec('SELECT last_insert_rowid() as id');
        let orderId;
        if (orderIdResult.length > 0 && orderIdResult[0].values.length > 0 && orderIdResult[0].values[0][0]) {
            orderId = orderIdResult[0].values[0][0];
        }
        else {
            // Fallback: query for the most recently created order for this table
            console.warn('[ORDERS] create: last_insert_rowid() returned no result, using fallback query');
            const fallbackOrder = await this.db.get('SELECT id FROM orders WHERE table_id = ? ORDER BY id DESC LIMIT 1', [data.table_id]);
            if (!fallbackOrder || !fallbackOrder.id) {
                throw new exceptions_1.BadRequestException('Failed to create order: Could not retrieve order ID');
            }
            orderId = fallbackOrder.id;
            console.log('[ORDERS] create: Using fallback order ID:', orderId);
        }
        console.log('[ORDERS] create: created order with id', orderId);
        // Validate that we got a valid order ID
        if (!orderId || orderId === 0) {
            throw new exceptions_1.BadRequestException('Failed to create order: Invalid order ID returned');
        }
        // Insert order items using prepared statement
        const stmt = this.db.getConnection().prepare('INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        try {
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
                stmt.bind([orderId, item.item_id, item.item_name, item.quantity, item.price, item.kitchen_id ?? null, serviceType, item.shelf_item_id ?? null]);
                stmt.step();
                stmt.reset();
            }
        }
        finally {
            stmt.free();
        }
        console.log('[ORDERS] create: inserted', data.items.length, 'order items for order', orderId);
        // Note: The database service auto-saves after db.run() calls
        // Prepared statements modify the in-memory database directly, so queries will work immediately
        // The save to disk happens asynchronously but doesn't affect query availability
        // Decrease stock for shelf items
        try {
            for (const item of data.items) {
                if (item.shelf_item_id) {
                    try {
                        await this.shelvesService.decreaseStock(item.shelf_item_id, item.quantity);
                    }
                    catch (stockErr) {
                        // If stock decrease fails, rollback the order
                        console.error('[ORDERS] create: stock decrease failed, rolling back order', orderId);
                        await this.db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
                        await this.db.run('DELETE FROM orders WHERE id = ?', [orderId]);
                        throw new exceptions_1.BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'كمية غير كافية'}`);
                    }
                }
            }
        }
        catch (stockErr) {
            // Rollback on any error
            console.error('[ORDERS] create: error during stock update, rolling back order', orderId);
            await this.db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
            await this.db.run('DELETE FROM orders WHERE id = ?', [orderId]);
            throw new exceptions_1.BadRequestException(`فشل تحديث المخزون: ${stockErr.message || 'خطأ غير معروف'}`);
        }
        // Return the created order with items
        const orderRow = await this.db.get('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note, globalDiscount FROM orders WHERE id = ?', [orderId]);
        if (!orderRow) {
            throw new exceptions_1.NotFoundException('Order not found after creation');
        }
        // Parse globalDiscount JSON if present
        if (orderRow.globalDiscount) {
            try {
                orderRow.globalDiscount = JSON.parse(orderRow.globalDiscount);
            }
            catch (e) {
                console.error('[ORDERS] create: failed to parse globalDiscount', e);
                orderRow.globalDiscount = null;
            }
        }
        const itemRows = await this.db.all('SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id = ?', [orderId]);
        console.log('[ORDERS] create: returning order with', itemRows.length, 'items');
        return {
            ...orderRow,
            items: itemRows,
        };
    }
    async updateStatus(id, status) {
        console.log('[ORDERS] updateStatus: updating order', id, 'to status', status);
        await this.db.run('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, id]);
        const row = await this.db.get('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Order not found');
        }
        // Parse globalDiscount JSON if present
        if (row.globalDiscount) {
            try {
                row.globalDiscount = JSON.parse(row.globalDiscount);
            }
            catch (e) {
                row.globalDiscount = null;
            }
        }
        return row;
    }
    async updateOrderType(id, orderType) {
        await this.db.run('UPDATE orders SET order_type = ?, updated_at = datetime("now") WHERE id = ?', [orderType, id]);
        const row = await this.db.get('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Order not found');
        }
        // Parse globalDiscount JSON if present
        if (row.globalDiscount) {
            try {
                row.globalDiscount = JSON.parse(row.globalDiscount);
            }
            catch (e) {
                row.globalDiscount = null;
            }
        }
        return row;
    }
    async update(id, data) {
        console.log('[ORDERS] update: updating order', id);
        // Check if order exists
        const existing = await this.db.get('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?', [id]);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Order not found');
        }
        const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const orderType = data.order_type || existing.order_type;
        // Update order
        await this.db.run('UPDATE orders SET order_type = ?, total = ?, updated_at = datetime("now"), customer_name = ?, customer_phone = ?, customer_location = ?, note = ? WHERE id = ?', [
            orderType,
            total,
            data.customer_name || null,
            data.customer_phone || null,
            data.customer_location || null,
            data.note || null,
            id,
        ]);
        // Delete old order items
        await this.db.run('DELETE FROM order_items WHERE order_id = ?', [id]);
        // Insert new order items using prepared statement
        const stmt = this.db.getConnection().prepare('INSERT INTO order_items (order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        try {
            for (const item of data.items) {
                const serviceType = item.service_type || 'dine-in';
                stmt.bind([id, item.item_id, item.item_name, item.quantity, item.price, item.kitchen_id ?? null, serviceType, item.shelf_item_id ?? null]);
                stmt.step();
                stmt.reset();
            }
        }
        finally {
            stmt.free();
        }
        // Return the updated order with items
        const orderRow = await this.db.get('SELECT id, table_id, order_type, status, total, created_at, updated_at, customer_name, customer_phone, customer_location, note FROM orders WHERE id = ?', [id]);
        const itemRows = await this.db.all('SELECT id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id FROM order_items WHERE order_id = ?', [id]);
        return {
            ...orderRow,
            items: itemRows,
        };
    }
    async remove(id) {
        console.log('[ORDERS] remove: deleting order', id);
        // Delete order items first
        await this.db.run('DELETE FROM order_items WHERE order_id = ?', [id]);
        // Then delete order
        await this.db.run('DELETE FROM orders WHERE id = ?', [id]);
    }
    async removeAll() {
        console.log('[ORDERS] removeAll: deleting all orders');
        // Delete all order_items first
        await this.db.run('DELETE FROM order_items');
        // Then delete all orders
        await this.db.run('DELETE FROM orders');
    }
    async clearAllTables() {
        console.log('[ORDERS] clearAllTables: clearing all active orders');
        // Get all active orders (pending or printed)
        const orderRows = await this.db.all("SELECT id FROM orders WHERE status IN ('pending', 'printed')");
        console.log('[ORDERS] clearAllTables: found', orderRows.length, 'active orders to clear');
        if (orderRows.length === 0) {
            return { cleared: 0 };
        }
        const orderIds = orderRows.map((o) => o.id);
        // Update all orders to 'completed' status instead of deleting
        // This ensures they are counted in daily sales
        await this.db.run(`UPDATE orders SET status = 'completed', updated_at = datetime("now") WHERE id IN (${orderIds.join(',')})`);
        return { cleared: orderIds.length };
    }
}
exports.OrdersService = OrdersService;
