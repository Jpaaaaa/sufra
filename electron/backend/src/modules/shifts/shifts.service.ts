import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { getShiftConfig } from '../settings/settings.service';
import { computeBusinessDate, getCurrentBusinessDate } from '../../utils/business-date';

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

class ShiftsService {
  constructor(private readonly db: DatabaseService) {}

  /** Map DB row to Shift (business day from configured shift start). */
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

  /**
   * Get the active shift for the current business day (overnight-aware).
   */
  async getActiveShift(): Promise<Shift | null> {
    const { business_day_start_time: shiftStart } = await getShiftConfig();
    const currentBd = getCurrentBusinessDate(shiftStart);

    const openRows = await this.db.all(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE status = 'open'
       ORDER BY start_time DESC`,
    );
    const openForBd = (openRows || []).find(
      (row: any) => computeBusinessDate(row.start_time, shiftStart) === currentBd,
    );
    if (openForBd) {
      return this.rowToShift(openForBd);
    }

    const closedRows = await this.db.all(
      `SELECT id, start_time FROM shifts 
       WHERE status = 'closed'
       ORDER BY end_time DESC
       LIMIT 50`,
    );
    const closedForBd = (closedRows || []).find(
      (row: any) => computeBusinessDate(row.start_time, shiftStart) === currentBd,
    );
    if (closedForBd) {
      return null;
    }

    await this.db.run(
      `INSERT INTO shifts (started_by, start_time, status) 
       VALUES (0, datetime('now', 'localtime'), 'open')`,
    );
    const created = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE status = 'open'
       ORDER BY start_time DESC LIMIT 1`,
    );
    return created ? this.rowToShift(created) : null;
  }

  /**
   * Get the active shift or throw if today's shift was already closed.
   * Used to ensure orders cannot be created after "end of day" was pressed.
   */
  async requireActiveShift(): Promise<Shift> {
    const activeShift = await this.getActiveShift();
    if (!activeShift) {
      throw new BadRequestException('تم إغلاق يوم العمل الحالي. الطلبات متاحة غداً (Today\'s business day is closed. Orders available tomorrow)');
    }
    return activeShift;
  }

  /**
   * No-op for compatibility: "open shift" is automatic per day.
   * Returns today's shift (creating it if needed).
   */
  async startShift(userId: number): Promise<Shift> {
    const shift = await this.getActiveShift();
    if (!shift) {
      throw new BadRequestException('تم إغلاق يوم العمل الحالي (Today\'s business day is already closed)');
    }
    return shift;
  }

  /**
   * Close today's shift (end of business day). After this, no orders until next day.
   */
  async finishShift(userId: number): Promise<Shift> {
    const activeShift = await this.getActiveShift();
    if (!activeShift) {
      throw new BadRequestException('لا يوجد يوم عمل مفتوح (No open business day for today)');
    }

    // Calculate shift totals
    const summary = await this.calculateShiftTotals(activeShift.id, activeShift.start_time, new Date().toISOString());

    // Update shift with calculated totals and close it
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

    // Get updated shift
    const row = await this.db.get(
      `SELECT id, started_by, ended_by, start_time, end_time, status, 
              total_sales, total_orders, total_items_sold, payment_breakdown, created_at
       FROM shifts 
       WHERE id = ?`,
      [activeShift.id],
    );

    if (!row) {
      throw new Error('Failed to retrieve updated shift');
    }

    return this.rowToShift(row);
  }

  async calculateShiftTotals(
    shiftId: number,
    startTime: string,
    endTime: string,
  ): Promise<ShiftSummary> {
    // Get all orders linked to this shift by shift_id (primary method)
    // Also fall back to time-based matching for orders created before shift_id was added
    const orders = await this.db.all(
      `SELECT id, total, globalDiscount, created_at, 'dine_in' as order_type
       FROM dine_in_orders 
       WHERE shift_id = ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, 'pickup' as order_type
       FROM pickup_orders 
       WHERE shift_id = ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, 'delivery' as order_type
       FROM delivery_orders 
       WHERE shift_id = ? AND status IN ('completed', 'archived')`,
      [shiftId, shiftId, shiftId],
    );

    let totalSales = 0;
    let totalOrders = orders.length;
    let totalItemsSold = 0;

    // Calculate payment breakdown (for now, assume all cash - can be enhanced later)
    const paymentBreakdown = {
      cash: 0,
      card: 0,
      other: 0,
    };

    if (orders.length === 0) {
      return {
        total_sales: 0,
        total_orders: 0,
        total_items_sold: 0,
        payment_breakdown: paymentBreakdown,
      };
    }

    // Get order items count for each order type
    const dineInIds = orders.filter((o: any) => o.order_type === 'dine_in').map((o: any) => o.id);
    const pickupIds = orders.filter((o: any) => o.order_type === 'pickup').map((o: any) => o.id);
    const deliveryIds = orders.filter((o: any) => o.order_type === 'delivery').map((o: any) => o.id);

    // Count items from order_items table (using order_type to identify the source)
    if (dineInIds.length > 0) {
      const dineInItems = await this.db.all(
        `SELECT SUM(quantity) as total FROM order_items WHERE order_id IN (${dineInIds.join(',')}) AND order_type = 'dine_in'`,
      );
      totalItemsSold += dineInItems[0]?.total || 0;
    }
    if (pickupIds.length > 0) {
      const pickupItems = await this.db.all(
        `SELECT SUM(quantity) as total FROM order_items WHERE order_id IN (${pickupIds.join(',')}) AND order_type = 'pickup'`,
      );
      totalItemsSold += pickupItems[0]?.total || 0;
    }
    if (deliveryIds.length > 0) {
      const deliveryItems = await this.db.all(
        `SELECT SUM(quantity) as total FROM order_items WHERE order_id IN (${deliveryIds.join(',')}) AND order_type = 'delivery'`,
      );
      totalItemsSold += deliveryItems[0]?.total || 0;
    }

    // Calculate total sales (including discounts)
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
    const endCondition = businessDayEnd || "CURRENT_TIMESTAMP";
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

let shiftsInstance: ShiftsService | null = null;

export function initializeShifts(db: DatabaseService): void {
  shiftsInstance = new ShiftsService(db);
}

function requireShifts(): ShiftsService {
  if (!shiftsInstance) {
    throw new Error('Shifts not initialized');
  }
  return shiftsInstance;
}

export function getAllShifts(
  ...args: Parameters<ShiftsService['getAllShifts']>
): ReturnType<ShiftsService['getAllShifts']> {
  return requireShifts().getAllShifts(...args);
}

export function getActiveShift(): ReturnType<ShiftsService['getActiveShift']> {
  return requireShifts().getActiveShift();
}

export function getShiftById(
  ...args: Parameters<ShiftsService['getShiftById']>
): ReturnType<ShiftsService['getShiftById']> {
  return requireShifts().getShiftById(...args);
}

export function startShift(
  ...args: Parameters<ShiftsService['startShift']>
): ReturnType<ShiftsService['startShift']> {
  return requireShifts().startShift(...args);
}

export function finishShift(
  ...args: Parameters<ShiftsService['finishShift']>
): ReturnType<ShiftsService['finishShift']> {
  return requireShifts().finishShift(...args);
}
