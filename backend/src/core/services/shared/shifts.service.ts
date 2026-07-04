import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Shift {
  id: number;
  started_by: number;
  ended_by: number | null;
  start_time: string;
  end_time: string | null;
  status: 'open' | 'closed';
  total_sales: number;
  total_orders: number;
  total_items_sold: number;
  payment_breakdown: string | null;
  created_at: string;
}

export interface ShiftSummary {
  total_sales: number;
  total_orders: number;
  total_items_sold: number;
  payment_breakdown: {
    cash: number;
    card: number;
    other: number;
  };
}

export class ShiftsService {
  constructor(private readonly db: DatabaseService) {}

  private rowToShift(row: any): Shift {
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

  async getActiveShift(): Promise<Shift | null> {
    const row = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE status = 'open' 
         AND date(start_time, 'localtime') = date('now', 'localtime')
       ORDER BY start_time DESC 
       LIMIT 1`,
    );
    if (row) return this.rowToShift(row);

    const closedToday = await this.db.get(
      `SELECT id FROM shifts 
       WHERE status = 'closed' 
         AND date(start_time, 'localtime') = date('now', 'localtime')
       LIMIT 1`,
    );
    if (closedToday) return null;

    await this.db.run(
      `INSERT INTO shifts (started_by, start_time, status) 
       VALUES (0, datetime('now', 'localtime'), 'open')`,
    );
    const created = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE status = 'open' 
         AND date(start_time, 'localtime') = date('now', 'localtime')
       ORDER BY start_time DESC LIMIT 1`,
    );
    return created ? this.rowToShift(created) : null;
  }

  async startShift(userId: number): Promise<Shift> {
    const shift = await this.getActiveShift();
    if (!shift) {
      throw new BadRequestException('Today\'s business day is already closed');
    }
    return shift;
  }

  async finishShift(userId: number): Promise<Shift> {
    const activeShift = await this.getActiveShift();
    if (!activeShift) {
      throw new BadRequestException('No open business day for today');
    }

    const summary = await this.calculateShiftTotals(activeShift.id, activeShift.start_time, new Date().toISOString());

    const paymentBreakdownJson = JSON.stringify(summary.payment_breakdown);

    await this.db.run(
      `UPDATE shifts 
       SET ended_by = ?, 
           end_time = datetime('now', 'localtime'),
           status = 'closed',
           total_sales = ?,
           total_orders = ?,
           total_items_sold = ?,
           payment_breakdown = ?
       WHERE id = ?`,
      [
        userId,
        summary.total_sales,
        summary.total_orders,
        summary.total_items_sold,
        paymentBreakdownJson,
        activeShift.id,
      ],
    );

    const row = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`,
      [activeShift.id],
    );

    if (!row) throw new Error('Failed to retrieve updated shift');
    return this.rowToShift(row);
  }

  async calculateShiftTotals(
    shiftId: number,
    startTime: string,
    endTime: string,
  ): Promise<ShiftSummary> {
    const orders = await this.db.all(
      `SELECT o.id, o.total, o.globalDiscount, o.created_at
       FROM orders o
       WHERE o.status = 'completed'
         AND o.created_at >= ?
         AND o.created_at <= ?`,
      [startTime, endTime],
    );

    let totalSales = 0;
    const totalOrders = orders.length;
    let totalItemsSold = 0;

    const paymentBreakdown = {
      cash: 0,
      card: 0,
      other: 0,
    };

    const orderIds = orders.map((o: any) => o.id);

    if (orderIds.length === 0) {
      return {
        total_sales: 0,
        total_orders: 0,
        total_items_sold: 0,
        payment_breakdown: paymentBreakdown,
      };
    }

    const items = await this.db.all(
      `SELECT quantity 
       FROM order_items 
       WHERE order_id IN (${orderIds.join(',')})`,
    );

    totalItemsSold = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    orders.forEach((order: any) => {
      let discountAmount = 0;

      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }

      const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
      totalSales += orderTotalBeforeDiscount;

      paymentBreakdown.cash += orderTotalBeforeDiscount;
    });

    return {
      total_sales: totalSales,
      total_orders: totalOrders,
      total_items_sold: totalItemsSold,
      payment_breakdown: paymentBreakdown,
    };
  }

  async getAllShifts(limit: number = 50): Promise<Shift[]> {
    const rows = await this.db.all(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       ORDER BY start_time DESC 
       LIMIT ?`,
      [limit],
    );

    return rows.map((row: any) => this.rowToShift(row));
  }

  async getShiftById(shiftId: number): Promise<Shift | null> {
    const row = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`,
      [shiftId],
    );
    return row ? this.rowToShift(row) : null;
  }

  async getShiftsByBusinessDay(businessDayStart: string, businessDayEnd: string | null): Promise<Shift[]> {
    const endCondition = businessDayEnd || "datetime('now')";
    const endParam = businessDayEnd ? [businessDayStart, businessDayEnd] : [businessDayStart];

    const rows = await this.db.all(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE start_time >= ? 
         AND start_time <= ${endCondition}
       ORDER BY start_time ASC`,
      endParam,
    );

    return rows.map((row: any) => this.rowToShift(row));
  }
}
