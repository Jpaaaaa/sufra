"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftsService = void 0;
const exceptions_1 = require("../utils/exceptions");
class ShiftsService {
    constructor(db) {
        this.db = db;
    }
    async getActiveShift() {
        const row = await this.db.get(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE status = 'open' 
       ORDER BY start_time DESC 
       LIMIT 1`);
        if (!row) {
            return null;
        }
        return {
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        };
    }
    async startShift(userId) {
        // Check if there's already an active shift
        const activeShift = await this.getActiveShift();
        if (activeShift) {
            throw new exceptions_1.BadRequestException('A shift is already active. Please finish the current shift first.');
        }
        // Create new shift
        await this.db.run(`INSERT INTO shifts (started_by, start_time, status) 
       VALUES (?, datetime('now'), 'open')`, [userId]);
        const id = await this.db.getLastInsertRowId();
        // Get the newly created shift
        const row = await this.db.get(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('Failed to retrieve created shift');
        }
        return {
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        };
    }
    async finishShift(userId) {
        // Get active shift
        const activeShift = await this.getActiveShift();
        if (!activeShift) {
            throw new exceptions_1.BadRequestException('No active shift found.');
        }
        // Calculate shift totals
        const summary = await this.calculateShiftTotals(activeShift.id, activeShift.start_time, new Date().toISOString());
        // Update shift with calculated totals and close it
        const paymentBreakdownJson = JSON.stringify(summary.payment_breakdown);
        await this.db.run(`UPDATE shifts 
       SET ended_by = ?, 
           end_time = datetime('now'),
           status = 'closed',
           total_sales = ?,
           total_orders = ?,
           total_items_sold = ?,
           payment_breakdown = ?
       WHERE id = ?`, [
            userId,
            summary.total_sales,
            summary.total_orders,
            summary.total_items_sold,
            paymentBreakdownJson,
            activeShift.id,
        ]);
        // Get updated shift
        const row = await this.db.get(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`, [activeShift.id]);
        if (!row) {
            throw new Error('Failed to retrieve updated shift');
        }
        return {
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        };
    }
    async calculateShiftTotals(shiftId, startTime, endTime) {
        // Get all completed orders within shift time window
        const orders = await this.db.all(`SELECT o.id, o.total, o.globalDiscount, o.created_at
       FROM orders o
       WHERE o.status = 'completed'
         AND o.created_at >= ?
         AND o.created_at <= ?`, [startTime, endTime]);
        let totalSales = 0;
        let totalOrders = orders.length;
        let totalItemsSold = 0;
        // Calculate payment breakdown (for now, assume all cash - can be enhanced later)
        const paymentBreakdown = {
            cash: 0,
            card: 0,
            other: 0,
        };
        // Get order items to count items sold
        const orderIds = orders.map((o) => o.id);
        if (orderIds.length === 0) {
            return {
                total_sales: 0,
                total_orders: 0,
                total_items_sold: 0,
                payment_breakdown: paymentBreakdown,
            };
        }
        const items = await this.db.all(`SELECT quantity 
       FROM order_items 
       WHERE order_id IN (${orderIds.join(',')})`);
        totalItemsSold = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        // Calculate total sales (including discounts)
        orders.forEach((order) => {
            let discountAmount = 0;
            if (order.globalDiscount) {
                try {
                    const globalDiscount = typeof order.globalDiscount === 'string'
                        ? JSON.parse(order.globalDiscount)
                        : order.globalDiscount;
                    discountAmount = globalDiscount?.amount || 0;
                }
                catch (e) {
                    discountAmount = 0;
                }
            }
            // Total sales = order total + discount (to get original amount)
            const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
            totalSales += orderTotalBeforeDiscount;
            // For now, assume all payments are cash (can be enhanced with payment_method field)
            paymentBreakdown.cash += orderTotalBeforeDiscount;
        });
        return {
            total_sales: totalSales,
            total_orders: totalOrders,
            total_items_sold: totalItemsSold,
            payment_breakdown: paymentBreakdown,
        };
    }
    async getAllShifts(limit = 50) {
        const rows = await this.db.all(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       ORDER BY start_time DESC 
       LIMIT ?`, [limit]);
        return rows.map((row) => ({
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        }));
    }
    async getShiftById(shiftId) {
        const row = await this.db.get(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`, [shiftId]);
        if (!row) {
            return null;
        }
        return {
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        };
    }
    async getShiftsByBusinessDay(businessDayStart, businessDayEnd) {
        const endCondition = businessDayEnd || "datetime('now')";
        const endParam = businessDayEnd ? [businessDayStart, businessDayEnd] : [businessDayStart];
        const rows = await this.db.all(`SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE start_time >= ? 
         AND start_time <= ${endCondition}
       ORDER BY start_time ASC`, endParam);
        return rows.map((row) => ({
            id: row.id,
            started_by: row.started_by,
            ended_by: row.ended_by,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
            total_sales: row.total_sales || 0,
            total_orders: row.total_orders || 0,
            total_items_sold: row.total_items_sold || 0,
            payment_breakdown: row.payment_breakdown,
            created_at: row.created_at,
        }));
    }
}
exports.ShiftsService = ShiftsService;
