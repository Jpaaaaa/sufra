import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { CreateRevenueDto } from '../../types/finance/create-revenue.dto';
import { CreateExpenseDto } from '../../types/finance/create-expense.dto';
import { UpdateExpenseDto } from '../../types/finance/update-expense.dto';
import { CreateCashFlowDto } from '../../types/finance/create-cash-flow.dto';
import {
  RevenueData,
  ExpenseData,
  CashFlowData,
  ProfitSummary,
} from '../../types/finance/export-finance.dto';

export interface Revenue extends RevenueData {}
export interface Expense extends ExpenseData {}
export interface CashFlow extends CashFlowData {}

export class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  // ============ REVENUE ============

  async getRevenues(filters?: {
    business_day_id?: number;
    from?: string;
    to?: string;
    type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  }): Promise<Revenue[]> {
    let query = `
      SELECT r.*, bd.start_at as business_day_start, bd.end_at as business_day_end 
      FROM revenues r
      LEFT JOIN business_days bd ON r.business_day_id = bd.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by specific business day
    if (filters?.business_day_id) {
      query += ' AND r.business_day_id = ?';
      params.push(filters.business_day_id);
    }

    // Filter by business day date range (using business_days.start_at)
    if (filters?.from) {
      query += ' AND DATE(bd.start_at) >= DATE(?)';
      params.push(filters.from);
    }

    if (filters?.to) {
      query += ' AND DATE(bd.start_at) <= DATE(?)';
      params.push(filters.to);
    }

    if (filters?.type) {
      query += ' AND r.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY bd.start_at DESC, r.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date, // Use business day start date
      type: row.type,
      amount: row.amount,
      notes: row.notes,
      created_at: row.created_at,
    }));
  }

  async createRevenue(dto: CreateRevenueDto): Promise<Revenue> {
    // Get current business day if not provided
    let businessDayId = dto.business_day_id;
    if (!businessDayId) {
      const currentBusinessDay = await this.db.get(
        'SELECT id FROM business_days WHERE is_active = 1 ORDER BY start_at DESC LIMIT 1'
      );
      businessDayId = currentBusinessDay?.id || null;
    }

    await this.db.run(
      'INSERT INTO revenues (business_day_id, date, type, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [businessDayId, dto.date || null, dto.type, dto.amount, dto.notes || null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      `SELECT r.*, bd.start_at as business_day_start 
       FROM revenues r 
       LEFT JOIN business_days bd ON r.business_day_id = bd.id 
       WHERE r.id = ?`,
      [id]
    );
    if (!row) {
      throw new Error('Failed to retrieve created revenue');
    }
    return {
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      type: row.type,
      amount: row.amount,
      notes: row.notes,
      created_at: row.created_at,
    };
  }

  // Auto-sync revenue from orders (for business day)
  async syncRevenueFromBusinessDay(businessDayId: number): Promise<Revenue | null> {
    // Get business day details
    const businessDay = await this.db.get(
      'SELECT * FROM business_days WHERE id = ?',
      [businessDayId]
    );

    if (!businessDay) {
      throw new Error('Business day not found');
    }

    // Check if revenue for this business day already exists
    const existing = await this.db.get(
      'SELECT * FROM revenues WHERE business_day_id = ? AND type = ?',
      [businessDayId, 'daily'],
    );

    // Get total sales from completed orders for this business day
    const endTime = businessDay.end_at || "datetime('now')";
    const sumRows = await this.db.all(
      `SELECT SUM(total) as total FROM orders 
       WHERE status = 'completed' 
       AND created_at >= ? 
       AND created_at < ${endTime}`,
      [businessDay.start_at],
    );

    const totalAmount = sumRows[0]?.total || 0;

    if (existing) {
      // Update existing revenue
      await this.db.run(
        'UPDATE revenues SET amount = ? WHERE id = ?',
        [totalAmount, existing.id],
      );
      const row = await this.db.get(
        `SELECT r.*, bd.start_at as business_day_start 
         FROM revenues r 
         LEFT JOIN business_days bd ON r.business_day_id = bd.id 
         WHERE r.id = ?`,
        [existing.id]
      );
      if (!row) {
        throw new Error('Failed to retrieve updated revenue');
      }
      return {
        id: row.id,
        business_day_id: row.business_day_id,
        date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
        type: row.type,
        amount: totalAmount,
        notes: row.notes,
        created_at: row.created_at,
      };
    } else if (totalAmount > 0) {
      // Create new revenue entry
      const dateStr = businessDay.start_at.split('T')[0];
      await this.db.run(
        'INSERT INTO revenues (business_day_id, date, type, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [businessDayId, dateStr, 'daily', totalAmount, 'Auto-synced from orders'],
      );
      const id = await this.db.getLastInsertRowId();
      const row = await this.db.get(
        `SELECT r.*, bd.start_at as business_day_start 
         FROM revenues r 
         LEFT JOIN business_days bd ON r.business_day_id = bd.id 
         WHERE r.id = ?`,
        [id]
      );
      if (!row) {
        throw new Error('Failed to retrieve created revenue');
      }
      return {
        id: row.id,
        business_day_id: row.business_day_id,
        date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
        type: row.type,
        amount: row.amount,
        notes: row.notes,
        created_at: row.created_at,
      };
    } else {
      return null;
    }
  }

  // Legacy method for backward compatibility - converts date to business_day_id
  async syncRevenueFromOrders(date: string): Promise<Revenue | null> {
    // Find business day that started on this date
    const businessDay = await this.db.get(
      "SELECT id FROM business_days WHERE DATE(start_at) = DATE(?) ORDER BY start_at DESC LIMIT 1",
      [date]
    );

    if (!businessDay) {
      console.warn(`[Finance] No business day found for date ${date}`);
      return null;
    }

    return this.syncRevenueFromBusinessDay(businessDay.id);
  }

  // ============ EXPENSES ============

  async getExpenses(filters?: {
    business_day_id?: number;
    from?: string;
    to?: string;
    category?: string;
  }): Promise<Expense[]> {
    let query = `
      SELECT e.*, bd.start_at as business_day_start, bd.end_at as business_day_end 
      FROM expenses e
      LEFT JOIN business_days bd ON e.business_day_id = bd.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by specific business day
    if (filters?.business_day_id) {
      query += ' AND e.business_day_id = ?';
      params.push(filters.business_day_id);
    }

    // Filter by business day date range (using business_days.start_at)
    if (filters?.from) {
      query += ' AND DATE(bd.start_at) >= DATE(?)';
      params.push(filters.from);
    }

    if (filters?.to) {
      query += ' AND DATE(bd.start_at) <= DATE(?)';
      params.push(filters.to);
    }

    if (filters?.category) {
      query += ' AND e.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY bd.start_at DESC, e.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      category: row.category,
      amount: row.amount,
      notes: row.notes,
      user_id: row.user_id,
      is_recurring: Boolean(row.is_recurring),
      recurrence_type: row.recurrence_type || null,
      recurrence_interval: row.recurrence_interval || null,
      next_occurrence_date: row.next_occurrence_date || null,
      created_at: row.created_at,
    }));
  }

  private calculateNextOccurrence(
    date: string,
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number = 1,
  ): string {
    const currentDate = new Date(date);
    const nextDate = new Date(currentDate);

    switch (recurrenceType) {
      case 'daily':
        nextDate.setDate(currentDate.getDate() + interval);
        break;
      case 'weekly':
        nextDate.setDate(currentDate.getDate() + (7 * interval));
        break;
      case 'monthly':
        nextDate.setMonth(currentDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(currentDate.getFullYear() + interval);
        break;
    }

    return nextDate.toISOString().split('T')[0];
  }

  async createExpense(dto: CreateExpenseDto): Promise<Expense> {
    // Get current business day if not provided
    let businessDayId = dto.business_day_id;
    if (!businessDayId) {
      const currentBusinessDay = await this.db.get(
        'SELECT id FROM business_days WHERE is_active = 1 ORDER BY start_at DESC LIMIT 1'
      );
      businessDayId = currentBusinessDay?.id || null;
    }

    const isRecurring = dto.is_recurring ? 1 : 0;
    const recurrenceType = dto.recurrence_type || null;
    const recurrenceInterval = dto.recurrence_interval || 1;
    const nextOccurrence = dto.is_recurring && dto.recurrence_type && dto.date
      ? this.calculateNextOccurrence(dto.date, dto.recurrence_type, recurrenceInterval)
      : null;

    await this.db.run(
      'INSERT INTO expenses (business_day_id, date, category, amount, notes, user_id, is_recurring, recurrence_type, recurrence_interval, next_occurrence_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      [
        businessDayId,
        dto.date || null,
        dto.category,
        dto.amount,
        dto.notes || null,
        dto.user_id || null,
        isRecurring,
        recurrenceType,
        recurrenceInterval,
        nextOccurrence,
      ],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      `SELECT e.*, bd.start_at as business_day_start 
       FROM expenses e 
       LEFT JOIN business_days bd ON e.business_day_id = bd.id 
       WHERE e.id = ?`,
      [id]
    );
    if (!row) {
      throw new Error('Failed to retrieve created expense');
    }
    return {
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      category: row.category,
      amount: row.amount,
      notes: row.notes,
      user_id: row.user_id,
      is_recurring: Boolean(row.is_recurring),
      recurrence_type: row.recurrence_type || null,
      recurrence_interval: row.recurrence_interval || null,
      next_occurrence_date: row.next_occurrence_date || null,
      created_at: row.created_at,
    };
  }

  async updateExpense(id: number, dto: UpdateExpenseDto): Promise<Expense> {
    // Check if expense exists
    const existing = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (dto.date !== undefined) {
      updates.push('date = ?');
      params.push(dto.date);
    }
    if (dto.category !== undefined) {
      updates.push('category = ?');
      params.push(dto.category);
    }
    if (dto.amount !== undefined) {
      updates.push('amount = ?');
      params.push(dto.amount);
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      params.push(dto.notes);
    }
    if (dto.user_id !== undefined) {
      updates.push('user_id = ?');
      params.push(dto.user_id);
    }
    if (dto.is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      params.push(dto.is_recurring ? 1 : 0);
    }
    if (dto.recurrence_type !== undefined) {
      updates.push('recurrence_type = ?');
      params.push(dto.recurrence_type || null);
    }
    if (dto.recurrence_interval !== undefined) {
      updates.push('recurrence_interval = ?');
      params.push(dto.recurrence_interval || 1);
    }

    // Calculate next occurrence if recurring fields changed
    if (dto.is_recurring !== undefined || dto.recurrence_type !== undefined || dto.recurrence_interval !== undefined || dto.date !== undefined) {
      const finalIsRecurring = dto.is_recurring !== undefined ? dto.is_recurring : Boolean(existing.is_recurring);
      const finalRecurrenceType = dto.recurrence_type !== undefined ? dto.recurrence_type : existing.recurrence_type;
      const finalRecurrenceInterval = dto.recurrence_interval !== undefined ? dto.recurrence_interval : (existing.recurrence_interval || 1);
      const finalDate = dto.date !== undefined ? dto.date : existing.date;

      if (finalIsRecurring && finalRecurrenceType) {
        updates.push('next_occurrence_date = ?');
        params.push(this.calculateNextOccurrence(finalDate, finalRecurrenceType, finalRecurrenceInterval));
      } else {
        updates.push('next_occurrence_date = ?');
        params.push(null);
      }
    }

    if (updates.length === 0) {
      return {
        id: existing.id,
        date: existing.date,
        category: existing.category,
        amount: existing.amount,
        notes: existing.notes,
        user_id: existing.user_id,
        is_recurring: Boolean(existing.is_recurring),
        recurrence_type: existing.recurrence_type || null,
        recurrence_interval: existing.recurrence_interval || null,
        next_occurrence_date: existing.next_occurrence_date || null,
        created_at: existing.created_at,
      };
    }

    params.push(id);

    await this.db.run(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    const row = await this.db.get(
      `SELECT e.*, bd.start_at as business_day_start 
       FROM expenses e 
       LEFT JOIN business_days bd ON e.business_day_id = bd.id 
       WHERE e.id = ?`,
      [id]
    );
    if (!row) {
      throw new NotFoundException('Expense not found after update');
    }
    return {
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      category: row.category,
      amount: row.amount,
      notes: row.notes,
      user_id: row.user_id,
      is_recurring: Boolean(row.is_recurring),
      recurrence_type: row.recurrence_type || null,
      recurrence_interval: row.recurrence_interval || null,
      next_occurrence_date: row.next_occurrence_date || null,
      created_at: row.created_at,
    };
  }

  async deleteExpense(id: number): Promise<void> {
    await this.db.run('DELETE FROM expenses WHERE id = ?', [id]);
  }

  // ============ CASH FLOW ============

  async getCashFlow(filters?: {
    business_day_id?: number;
    from?: string;
    to?: string;
    type?: 'in' | 'out';
  }): Promise<CashFlow[]> {
    let query = `
      SELECT cf.*, bd.start_at as business_day_start, bd.end_at as business_day_end 
      FROM cash_flow cf
      LEFT JOIN business_days bd ON cf.business_day_id = bd.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by specific business day
    if (filters?.business_day_id) {
      query += ' AND cf.business_day_id = ?';
      params.push(filters.business_day_id);
    }

    // Filter by business day date range (using business_days.start_at)
    if (filters?.from) {
      query += ' AND DATE(bd.start_at) >= DATE(?)';
      params.push(filters.from);
    }

    if (filters?.to) {
      query += ' AND DATE(bd.start_at) <= DATE(?)';
      params.push(filters.to);
    }

    if (filters?.type) {
      query += ' AND cf.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY bd.start_at DESC, cf.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      type: row.type,
      reason: row.reason,
      amount: row.amount,
      linked_order_id: row.linked_order_id,
      created_at: row.created_at,
    }));
  }

  async createCashFlow(dto: CreateCashFlowDto): Promise<CashFlow> {
    // Get current business day if not provided
    let businessDayId = dto.business_day_id;
    if (!businessDayId) {
      const currentBusinessDay = await this.db.get(
        'SELECT id FROM business_days WHERE is_active = 1 ORDER BY start_at DESC LIMIT 1'
      );
      businessDayId = currentBusinessDay?.id || null;
    }

    await this.db.run(
      'INSERT INTO cash_flow (business_day_id, date, type, reason, amount, linked_order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [businessDayId, dto.date || null, dto.type, dto.reason, dto.amount, dto.linked_order_id || null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      `SELECT cf.*, bd.start_at as business_day_start 
       FROM cash_flow cf 
       LEFT JOIN business_days bd ON cf.business_day_id = bd.id 
       WHERE cf.id = ?`,
      [id]
    );
    if (!row) {
      throw new Error('Failed to retrieve created cash flow');
    }
    return {
      id: row.id,
      business_day_id: row.business_day_id,
      date: row.business_day_start ? row.business_day_start.split('T')[0] : row.date,
      type: row.type,
      reason: row.reason,
      amount: row.amount,
      linked_order_id: row.linked_order_id,
      created_at: row.created_at,
    };
  }

  // Auto-sync cash flow from orders for a business day
  async syncCashFlowFromBusinessDay(businessDayId: number): Promise<void> {
    // Get business day details
    const businessDay = await this.db.get(
      'SELECT * FROM business_days WHERE id = ?',
      [businessDayId]
    );

    if (!businessDay) {
      throw new Error('Business day not found');
    }

    // Get completed orders for cash in
    const endTime = businessDay.end_at || "datetime('now')";
    const orders = await this.db.all(
      `SELECT id, total FROM orders 
       WHERE status = 'completed' 
       AND created_at >= ? 
       AND created_at < ${endTime}`,
      [businessDay.start_at],
    );

    const dateStr = businessDay.start_at.split('T')[0];

    // Create cash flow entries for each order
    for (const order of orders) {
      // Check if cash flow entry already exists
      const existing = await this.db.get(
        'SELECT id FROM cash_flow WHERE business_day_id = ? AND linked_order_id = ? AND type = ?',
        [businessDayId, order.id, 'in'],
      );

      if (!existing) {
        await this.db.run(
          'INSERT INTO cash_flow (business_day_id, date, type, reason, amount, linked_order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
          [businessDayId, dateStr, 'in', 'Daily sales', order.total, order.id],
        );
      }
    }
  }

  // Legacy method for backward compatibility - converts date to business_day_id
  async syncCashFlowFromOrders(date: string): Promise<void> {
    // Find business day that started on this date
    const businessDay = await this.db.get(
      "SELECT id FROM business_days WHERE DATE(start_at) = DATE(?) ORDER BY start_at DESC LIMIT 1",
      [date]
    );

    if (!businessDay) {
      console.warn(`[Finance] No business day found for date ${date}`);
      return;
    }

    return this.syncCashFlowFromBusinessDay(businessDay.id);
  }

  // ============ PROFIT & LOSS ============

  async getProfitAndLoss(filters?: {
    business_day_id?: number;
    from?: string;
    to?: string;
  }): Promise<ProfitSummary> {
    const fromDate = filters?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = filters?.to || new Date().toISOString().split('T')[0];

    let revenueQuery = `
      SELECT COALESCE(SUM(r.amount), 0) as total 
      FROM revenues r
      LEFT JOIN business_days bd ON r.business_day_id = bd.id
      WHERE 1=1
    `;
    let expenseQuery = `
      SELECT COALESCE(SUM(e.amount), 0) as total 
      FROM expenses e
      LEFT JOIN business_days bd ON e.business_day_id = bd.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by specific business day
    if (filters?.business_day_id) {
      revenueQuery += ' AND r.business_day_id = ?';
      expenseQuery += ' AND e.business_day_id = ?';
      params.push(filters.business_day_id);
    } else {
      // Filter by date range using business_days.start_at
      revenueQuery += ' AND DATE(bd.start_at) >= DATE(?) AND DATE(bd.start_at) <= DATE(?)';
      expenseQuery += ' AND DATE(bd.start_at) >= DATE(?) AND DATE(bd.start_at) <= DATE(?)';
    }

    // Get total revenue
    const revRow = filters?.business_day_id
      ? await this.db.get(revenueQuery, params)
      : await this.db.get(revenueQuery, [fromDate, toDate]);

    // Get total expenses
    const expRow = filters?.business_day_id
      ? await this.db.get(expenseQuery, params)
      : await this.db.get(expenseQuery, [fromDate, toDate]);

    const totalRevenue = (revRow?.total !== undefined && revRow?.total !== null) ? revRow.total : 0;
    const totalExpenses = (expRow?.total !== undefined && expRow?.total !== null) ? expRow.total : 0;
    const netProfit = totalRevenue - totalExpenses;

    return {
      period: 'daily' as const, // Default, can be enhanced
      from: fromDate,
      to: toDate,
      totalRevenue,
      totalExpenses,
      netProfit,
    };
  }
}

