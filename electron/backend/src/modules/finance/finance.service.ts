import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { getCurrentBusinessDateFromSettings } from '../settings/resolve-order-shift';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import {
  RevenueData,
  ExpenseData,
  CashFlowData,
  ProfitSummary,
} from './dto/export-finance.dto';

export interface Revenue extends RevenueData {}
export interface Expense extends ExpenseData {}
export interface CashFlow extends CashFlowData {}

class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  // ============ REVENUE ============

  async getRevenues(filters?: {
    from?: string;
    to?: string;
    type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  }): Promise<Revenue[]> {
    let query = `SELECT r.* FROM revenues r WHERE 1=1`;
    const params: any[] = [];

    if (filters?.from) {
      query += ' AND DATE(r.date) >= DATE(?)';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND DATE(r.date) <= DATE(?)';
      params.push(filters.to);
    }
    if (filters?.type) {
      query += ' AND r.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY r.date DESC, r.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
      type: row.type,
      amount: row.amount,
      notes: row.notes,
      order_count:
        row.order_count !== undefined && row.order_count !== null ? Number(row.order_count) : null,
      created_at: row.created_at,
    }));
  }

  async createRevenue(dto: CreateRevenueDto): Promise<Revenue> {
    const dateVal = dto.date || new Date().toISOString().split('T')[0];
    await this.db.run(
      'INSERT INTO revenues (date, type, amount, notes, order_count, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [dateVal, dto.type, dto.amount, dto.notes || null, null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get('SELECT * FROM revenues WHERE id = ?', [id]);
    if (!row) {
      throw new Error('Failed to retrieve created revenue');
    }
    return {
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
      type: row.type,
      amount: row.amount,
      notes: row.notes,
      order_count:
        row.order_count !== undefined && row.order_count !== null ? Number(row.order_count) : null,
      created_at: row.created_at,
    };
  }

  /** Sync revenue from completed orders for a given date and write to revenues table. */
  async syncRevenueFromOrders(date: string): Promise<Revenue | null> {
    const dateNorm = date?.split?.('T')[0] || date;
    if (!dateNorm) return null;

    const totals = await this.db.get(
      `SELECT 
         COUNT(*) as order_count,
         COALESCE(SUM(total), 0) as total_sales
       FROM (
         SELECT total FROM dine_in_orders WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT total FROM pickup_orders WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT total FROM delivery_orders WHERE business_date = ? AND status IN ('completed', 'archived')
       )`,
      [dateNorm, dateNorm, dateNorm],
    );
    const totalSales = Number(totals?.total_sales ?? 0) || 0;
    const orderCount = Number(totals?.order_count ?? 0) || 0;

    const existing = await this.db.get(
      "SELECT id FROM revenues WHERE date = ? AND type = 'daily' AND (notes IS NULL OR notes = 'من الطلبات') LIMIT 1",
      [dateNorm],
    );

    const notesVal = orderCount > 0 ? 'من الطلبات' : null;

    if (existing) {
      await this.db.run(
        'UPDATE revenues SET amount = ?, notes = ?, order_count = ? WHERE id = ?',
        [totalSales, notesVal, orderCount, existing.id],
      );
      const row = await this.db.get('SELECT * FROM revenues WHERE id = ?', [existing.id]);
      if (!row) return null;
      return {
        id: row.id,
        date: row.date?.split?.('T')[0] ?? row.date ?? '',
        type: row.type,
        amount: row.amount,
        notes: row.notes,
        order_count:
          row.order_count !== undefined && row.order_count !== null ? Number(row.order_count) : null,
        created_at: row.created_at,
      };
    }

    if (totalSales === 0 && orderCount === 0) {
      return null;
    }

    await this.db.run(
      'INSERT INTO revenues (date, type, amount, notes, order_count, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [dateNorm, 'daily', totalSales, notesVal, orderCount],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get('SELECT * FROM revenues WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
      type: row.type,
      amount: row.amount,
      notes: row.notes,
      order_count:
        row.order_count !== undefined && row.order_count !== null ? Number(row.order_count) : null,
      created_at: row.created_at,
    };
  }

  /** @deprecated Use syncRevenueFromOrders. Kept for API compatibility. */
  async syncRevenueFromBusinessDay(_businessDayId: number): Promise<Revenue | null> {
    const today = await getCurrentBusinessDateFromSettings();
    return this.syncRevenueFromOrders(today);
  }

  /**
   * Sync today's revenue from orders and return totals (current business day).
   */
  async syncRevenueForToday(): Promise<{ total: number; orderCount: number }> {
    const today = await getCurrentBusinessDateFromSettings();
    const totals = await this.db.get(
      `SELECT 
         COUNT(*) as order_count,
         COALESCE(SUM(total), 0) as total_sales
       FROM (
         SELECT total FROM dine_in_orders WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT total FROM pickup_orders WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT total FROM delivery_orders WHERE business_date = ? AND status IN ('completed', 'archived')
       )`,
      [today, today, today],
    );
    await this.syncRevenueFromOrders(today);
    return {
      total: Number(totals?.total_sales ?? 0) || 0,
      orderCount: Number(totals?.order_count ?? 0) || 0,
    };
  }

  /** @deprecated Use syncRevenueForToday. Kept for API compatibility. */
  async syncRevenueFromActiveShift(): Promise<{ total: number; orderCount: number } | null> {
    return this.syncRevenueForToday();
  }

  // ============ EXPENSES ============

  async getExpenses(filters?: {
    from?: string;
    to?: string;
    category?: string;
  }): Promise<Expense[]> {
    // Materialize any due recurring expenses before listing
    try {
      await this.processDueRecurringExpenses();
    } catch (err) {
      console.error('[FINANCE] processDueRecurringExpenses failed:', err);
    }

    let query = `SELECT e.* FROM expenses e WHERE 1=1`;
    const params: any[] = [];

    if (filters?.from) {
      query += ' AND DATE(e.date) >= DATE(?)';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND DATE(e.date) <= DATE(?)';
      params.push(filters.to);
    }
    if (filters?.category) {
      query += ' AND e.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY e.date DESC, e.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
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

  /** All recurring expense templates (not limited by finance date range). */
  async getRecurringExpenses(): Promise<Expense[]> {
    try {
      await this.processDueRecurringExpenses();
    } catch (err) {
      console.error('[FINANCE] processDueRecurringExpenses failed (recurring list):', err);
    }

    const rows = await this.db.all(
      `SELECT e.* FROM expenses e
       WHERE e.is_recurring = 1
       ORDER BY
         CASE WHEN e.next_occurrence_date IS NULL OR e.next_occurrence_date = '' THEN 1 ELSE 0 END,
         DATE(e.next_occurrence_date) ASC,
         e.category ASC,
         e.id ASC`,
    );

    return rows.map((row: any) => ({
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
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

  /**
   * Materialize at most the latest due occurrence for each recurring template.
   * Past periods are skipped (no backfill) so registering/opening finance months
   * later does not flood expenses from the original start date.
   */
  async processDueRecurringExpenses(asOfDate?: string): Promise<{ created: number }> {
    const today = (asOfDate || new Date().toISOString().split('T')[0]).slice(0, 10);
    const templates = await this.db.all(
      `SELECT * FROM expenses
       WHERE is_recurring = 1
         AND next_occurrence_date IS NOT NULL
         AND next_occurrence_date != ''
         AND DATE(next_occurrence_date) <= DATE(?)
       ORDER BY id ASC`,
      [today],
    );

    if (!templates?.length) return { created: 0 };

    let created = 0;

    for (const tpl of templates) {
      const recurrenceType = tpl.recurrence_type as
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly'
        | null;
      if (!recurrenceType) continue;

      const interval = Number(tpl.recurrence_interval) > 0 ? Number(tpl.recurrence_interval) : 1;
      const from = String(tpl.next_occurrence_date).split('T')[0];
      const { dueDate, nextAfterDue } = this.resolveLatestDueOccurrence(
        from,
        recurrenceType,
        interval,
        today,
      );

      if (dueDate) {
        const existing = await this.db.get(
          `SELECT id FROM expenses
           WHERE DATE(date) = DATE(?)
             AND category = ?
             AND amount = ?
             AND is_recurring = 0
             AND COALESCE(notes, '') = COALESCE(?, '')
           LIMIT 1`,
          [dueDate, tpl.category, tpl.amount, tpl.notes ?? null],
        );

        if (!existing) {
          await this.db.run(
            `INSERT INTO expenses
              (date, category, amount, notes, user_id, is_recurring, recurrence_type, recurrence_interval, next_occurrence_date, created_at)
             VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, CURRENT_TIMESTAMP)`,
            [dueDate, tpl.category, tpl.amount, tpl.notes ?? null, tpl.user_id ?? null],
          );
          created++;
        }
      }

      await this.db.run('UPDATE expenses SET next_occurrence_date = ? WHERE id = ?', [
        nextAfterDue,
        tpl.id,
      ]);
    }

    if (created > 0) {
      console.log(`[FINANCE] ✓ Materialized ${created} recurring expense occurrence(s)`);
    }
    return { created };
  }

  /**
   * Walk from `fromDate` through due dates ≤ asOfDate without creating history.
   * Returns the latest due date (if any) and the first occurrence strictly after asOfDate.
   */
  private resolveLatestDueOccurrence(
    fromDate: string,
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number,
    asOfDate: string,
  ): { dueDate: string | null; nextAfterDue: string } {
    let cursor = String(fromDate).split('T')[0];
    let dueDate: string | null = null;
    let steps = 0;
    const maxSteps = 400;

    while (cursor && cursor <= asOfDate && steps < maxSteps) {
      dueDate = cursor;
      const advanced = this.calculateNextOccurrence(cursor, recurrenceType, interval);
      if (!advanced || advanced <= cursor) break;
      cursor = advanced;
      steps++;
    }

    return { dueDate, nextAfterDue: cursor };
  }

  /** First occurrence strictly after `afterDate` (typically today), starting from `fromDate`. */
  private firstOccurrenceAfter(
    fromDate: string,
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number,
    afterDate: string,
  ): string {
    let cursor = this.calculateNextOccurrence(fromDate, recurrenceType, interval);
    let steps = 0;
    const maxSteps = 400;
    while (cursor && cursor <= afterDate && steps < maxSteps) {
      const advanced = this.calculateNextOccurrence(cursor, recurrenceType, interval);
      if (!advanced || advanced <= cursor) break;
      cursor = advanced;
      steps++;
    }
    return cursor;
  }

  private calculateNextOccurrence(
    date: string,
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number = 1,
  ): string {
    const parts = String(date).split('T')[0].split('-').map((p) => Number(p));
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    const currentDate =
      Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
        ? new Date(y, m - 1, d)
        : new Date(date);
    const nextDate = new Date(currentDate);

    switch (recurrenceType) {
      case 'daily':
        nextDate.setDate(currentDate.getDate() + interval);
        break;
      case 'weekly':
        nextDate.setDate(currentDate.getDate() + 7 * interval);
        break;
      case 'monthly':
        nextDate.setMonth(currentDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(currentDate.getFullYear() + interval);
        break;
    }

    const yy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  async createExpense(dto: CreateExpenseDto): Promise<Expense> {
    const dateVal = dto.date || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const isRecurring = dto.is_recurring ? 1 : 0;
    const recurrenceType = dto.recurrence_type || null;
    const recurrenceInterval = dto.recurrence_interval ?? 1;
    // Never schedule next_occurrence in the past — avoids backfill floods on late registration
    const nextOccurrence =
      dto.is_recurring && dto.recurrence_type
        ? this.firstOccurrenceAfter(dateVal, dto.recurrence_type, recurrenceInterval, today)
        : null;

    await this.db.run(
      'INSERT INTO expenses (date, category, amount, notes, user_id, is_recurring, recurrence_type, recurrence_interval, next_occurrence_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        dateVal,
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
    if (!id) {
      throw new Error('Failed to create expense');
    }
    // Return from input data (id already known from insert)
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return {
      id,
      date: dateVal,
      category: dto.category,
      amount: dto.amount,
      notes: dto.notes || null,
      user_id: dto.user_id || null,
      is_recurring: Boolean(isRecurring),
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceInterval,
      next_occurrence_date: nextOccurrence,
      created_at: createdAt,
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
      const today = new Date().toISOString().split('T')[0];

      if (finalIsRecurring && finalRecurrenceType && finalDate) {
        updates.push('next_occurrence_date = ?');
        params.push(
          this.firstOccurrenceAfter(
            finalDate,
            finalRecurrenceType as 'daily' | 'weekly' | 'monthly' | 'yearly',
            Number(finalRecurrenceInterval) > 0 ? Number(finalRecurrenceInterval) : 1,
            today,
          ),
        );
      } else {
        updates.push('next_occurrence_date = ?');
        params.push(null);
      }
    }

    if (updates.length === 0) {
      const row = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
      if (!row) {
        throw new NotFoundException('Expense not found');
      }
      return {
        id: row.id,
        date: row.date?.split?.('T')[0] ?? row.date ?? '',
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

    params.push(id);

    await this.db.run(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    const row = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!row) {
      throw new NotFoundException('Expense not found after update');
    }
    return {
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
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
    from?: string;
    to?: string;
    type?: 'in' | 'out';
  }): Promise<CashFlow[]> {
    let query = `SELECT cf.* FROM cash_flow cf WHERE 1=1`;
    const params: any[] = [];

    if (filters?.from) {
      query += ' AND DATE(cf.date) >= DATE(?)';
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ' AND DATE(cf.date) <= DATE(?)';
      params.push(filters.to);
    }
    if (filters?.type) {
      query += ' AND cf.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY cf.date DESC, cf.created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
      type: row.type,
      reason: row.reason,
      amount: row.amount,
      linked_order_id: row.linked_order_id,
      created_at: row.created_at,
    }));
  }

  async createCashFlow(dto: CreateCashFlowDto): Promise<CashFlow> {
    const dateVal = dto.date || new Date().toISOString().split('T')[0];
    await this.db.run(
      'INSERT INTO cash_flow (date, type, reason, amount, linked_order_id, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [dateVal, dto.type, dto.reason, dto.amount, dto.linked_order_id || null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get('SELECT * FROM cash_flow WHERE id = ?', [id]);
    if (!row) {
      throw new Error('Failed to retrieve created cash flow');
    }
    return {
      id: row.id,
      date: row.date?.split?.('T')[0] ?? row.date ?? '',
      type: row.type,
      reason: row.reason,
      amount: row.amount,
      linked_order_id: row.linked_order_id,
      created_at: row.created_at,
    };
  }

  /** @deprecated No-op. Kept for API compatibility. */
  async syncCashFlowFromBusinessDay(_businessDayId: number): Promise<void> {
    // Date-based: no business day; frontend uses syncRevenueForToday for revenue sync.
  }

  /** @deprecated No-op. Kept for API compatibility. */
  async syncCashFlowFromOrders(_date: string): Promise<void> {
    // No-op; cash flow is created manually or via other flows.
  }

  // ============ PROFIT & LOSS ============

  async getProfitAndLoss(filters?: {
    from?: string;
    to?: string;
  }): Promise<ProfitSummary> {
    try {
      await this.processDueRecurringExpenses();
    } catch (err) {
      console.error('[FINANCE] processDueRecurringExpenses failed (P&L):', err);
    }

    const fromDate = filters?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = filters?.to || new Date().toISOString().split('T')[0];

    const revenueQuery = `
      SELECT COALESCE(SUM(r.amount), 0) as total 
      FROM revenues r
      WHERE DATE(r.date) >= DATE(?) AND DATE(r.date) <= DATE(?)
    `;
    const expenseQuery = `
      SELECT COALESCE(SUM(e.amount), 0) as total 
      FROM expenses e
      WHERE DATE(e.date) >= DATE(?) AND DATE(e.date) <= DATE(?)
    `;

    const revRow = await this.db.get(revenueQuery, [fromDate, toDate]);
    const expRow = await this.db.get(expenseQuery, [fromDate, toDate]);

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

let financeInstance: FinanceService | null = null;

export function initializeFinance(db: DatabaseService): void {
  financeInstance = new FinanceService(db);
}

function requireFinance(): FinanceService {
  if (!financeInstance) {
    throw new Error('Finance not initialized');
  }
  return financeInstance;
}

export function getRevenues(
  ...args: Parameters<FinanceService['getRevenues']>
): ReturnType<FinanceService['getRevenues']> {
  return requireFinance().getRevenues(...args);
}

export function createRevenue(
  ...args: Parameters<FinanceService['createRevenue']>
): ReturnType<FinanceService['createRevenue']> {
  return requireFinance().createRevenue(...args);
}

export function syncRevenueFromOrders(
  ...args: Parameters<FinanceService['syncRevenueFromOrders']>
): ReturnType<FinanceService['syncRevenueFromOrders']> {
  return requireFinance().syncRevenueFromOrders(...args);
}

export function getExpenses(
  ...args: Parameters<FinanceService['getExpenses']>
): ReturnType<FinanceService['getExpenses']> {
  return requireFinance().getExpenses(...args);
}

export function getRecurringExpenses(
  ...args: Parameters<FinanceService['getRecurringExpenses']>
): ReturnType<FinanceService['getRecurringExpenses']> {
  return requireFinance().getRecurringExpenses(...args);
}

export function processDueRecurringExpenses(
  ...args: Parameters<FinanceService['processDueRecurringExpenses']>
): ReturnType<FinanceService['processDueRecurringExpenses']> {
  return requireFinance().processDueRecurringExpenses(...args);
}

export function createExpense(
  ...args: Parameters<FinanceService['createExpense']>
): ReturnType<FinanceService['createExpense']> {
  return requireFinance().createExpense(...args);
}

export function updateExpense(
  ...args: Parameters<FinanceService['updateExpense']>
): ReturnType<FinanceService['updateExpense']> {
  return requireFinance().updateExpense(...args);
}

export function deleteExpense(
  ...args: Parameters<FinanceService['deleteExpense']>
): ReturnType<FinanceService['deleteExpense']> {
  return requireFinance().deleteExpense(...args);
}

export function getCashFlow(
  ...args: Parameters<FinanceService['getCashFlow']>
): ReturnType<FinanceService['getCashFlow']> {
  return requireFinance().getCashFlow(...args);
}

export function createCashFlow(
  ...args: Parameters<FinanceService['createCashFlow']>
): ReturnType<FinanceService['createCashFlow']> {
  return requireFinance().createCashFlow(...args);
}

export function syncCashFlowFromOrders(
  ...args: Parameters<FinanceService['syncCashFlowFromOrders']>
): ReturnType<FinanceService['syncCashFlowFromOrders']> {
  return requireFinance().syncCashFlowFromOrders(...args);
}

export function getProfitAndLoss(
  ...args: Parameters<FinanceService['getProfitAndLoss']>
): ReturnType<FinanceService['getProfitAndLoss']> {
  return requireFinance().getProfitAndLoss(...args);
}
