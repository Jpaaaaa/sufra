"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const exceptions_1 = require("../utils/exceptions");
class FinanceService {
    constructor(db) {
        this.db = db;
    }
    // ============ REVENUE ============
    async getRevenues(filters) {
        let query = 'SELECT * FROM revenues WHERE 1=1';
        const params = [];
        if (filters?.from) {
            query += ' AND date >= ?';
            params.push(filters.from);
        }
        if (filters?.to) {
            query += ' AND date <= ?';
            params.push(filters.to);
        }
        if (filters?.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }
        query += ' ORDER BY date DESC, created_at DESC';
        const rows = await this.db.all(query, params);
        return rows.map((row) => ({
            id: row.id,
            date: row.date,
            type: row.type,
            amount: row.amount,
            notes: row.notes,
            created_at: row.created_at,
        }));
    }
    async createRevenue(dto) {
        await this.db.run('INSERT INTO revenues (date, type, amount, notes, created_at) VALUES (?, ?, ?, ?, datetime("now"))', [dto.date, dto.type, dto.amount, dto.notes || null]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT * FROM revenues WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created revenue');
        }
        return {
            id: row.id,
            date: row.date,
            type: row.type,
            amount: row.amount,
            notes: row.notes,
            created_at: row.created_at,
        };
    }
    // Auto-sync revenue from orders (for daily sales)
    async syncRevenueFromOrders(date) {
        // Check if revenue for this date already exists
        const existing = await this.db.get('SELECT * FROM revenues WHERE date = ? AND type = ?', [date, 'daily']);
        // Get total sales from completed orders for this date
        // SQLite datetime format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
        const sumRows = await this.db.all(`SELECT SUM(total) as total FROM orders 
       WHERE status = 'completed' 
       AND date(created_at) = date(?)`, [date]);
        const totalAmount = sumRows[0]?.total || 0;
        if (existing) {
            // Update existing revenue
            await this.db.run('UPDATE revenues SET amount = ? WHERE id = ?', [totalAmount, existing.id]);
            return {
                id: existing.id,
                date: existing.date,
                type: existing.type,
                amount: totalAmount,
                notes: existing.notes,
                created_at: existing.created_at,
            };
        }
        else if (totalAmount > 0) {
            // Create new revenue entry
            await this.db.run('INSERT INTO revenues (date, type, amount, notes, created_at) VALUES (?, ?, ?, ?, datetime("now"))', [date, 'daily', totalAmount, 'Auto-synced from orders']);
            const id = await this.db.getLastInsertRowId();
            const row = await this.db.get('SELECT * FROM revenues WHERE id = ?', [id]);
            if (!row) {
                throw new Error('Failed to retrieve created revenue');
            }
            return {
                id: row.id,
                date: row.date,
                type: row.type,
                amount: row.amount,
                notes: row.notes,
                created_at: row.created_at,
            };
        }
        else {
            return null;
        }
    }
    // ============ EXPENSES ============
    async getExpenses(filters) {
        let query = 'SELECT * FROM expenses WHERE 1=1';
        const params = [];
        if (filters?.from) {
            query += ' AND date >= ?';
            params.push(filters.from);
        }
        if (filters?.to) {
            query += ' AND date <= ?';
            params.push(filters.to);
        }
        if (filters?.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }
        query += ' ORDER BY date DESC, created_at DESC';
        const rows = await this.db.all(query, params);
        return rows.map((row) => ({
            id: row.id,
            date: row.date,
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
    calculateNextOccurrence(date, recurrenceType, interval = 1) {
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
    async createExpense(dto) {
        const isRecurring = dto.is_recurring ? 1 : 0;
        const recurrenceType = dto.recurrence_type || null;
        const recurrenceInterval = dto.recurrence_interval || 1;
        const nextOccurrence = dto.is_recurring && dto.recurrence_type
            ? this.calculateNextOccurrence(dto.date, dto.recurrence_type, recurrenceInterval)
            : null;
        await this.db.run('INSERT INTO expenses (date, category, amount, notes, user_id, is_recurring, recurrence_type, recurrence_interval, next_occurrence_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))', [
            dto.date,
            dto.category,
            dto.amount,
            dto.notes || null,
            dto.user_id || null,
            isRecurring,
            recurrenceType,
            recurrenceInterval,
            nextOccurrence,
        ]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created expense');
        }
        return {
            id: row.id,
            date: row.date,
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
    async updateExpense(id, dto) {
        // Check if expense exists
        const existing = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Expense not found');
        }
        // Build update query dynamically
        const updates = [];
        const params = [];
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
            }
            else {
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
        await this.db.run(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`, params);
        const row = await this.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Expense not found after update');
        }
        return {
            id: row.id,
            date: row.date,
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
    async deleteExpense(id) {
        await this.db.run('DELETE FROM expenses WHERE id = ?', [id]);
    }
    // ============ CASH FLOW ============
    async getCashFlow(filters) {
        let query = 'SELECT * FROM cash_flow WHERE 1=1';
        const params = [];
        if (filters?.from) {
            query += ' AND date >= ?';
            params.push(filters.from);
        }
        if (filters?.to) {
            query += ' AND date <= ?';
            params.push(filters.to);
        }
        if (filters?.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }
        query += ' ORDER BY date DESC, created_at DESC';
        const rows = await this.db.all(query, params);
        return rows.map((row) => ({
            id: row.id,
            date: row.date,
            type: row.type,
            reason: row.reason,
            amount: row.amount,
            linked_order_id: row.linked_order_id,
            created_at: row.created_at,
        }));
    }
    async createCashFlow(dto) {
        await this.db.run('INSERT INTO cash_flow (date, type, reason, amount, linked_order_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))', [dto.date, dto.type, dto.reason, dto.amount, dto.linked_order_id || null]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT * FROM cash_flow WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created cash flow');
        }
        return {
            id: row.id,
            date: row.date,
            type: row.type,
            reason: row.reason,
            amount: row.amount,
            linked_order_id: row.linked_order_id,
            created_at: row.created_at,
        };
    }
    // Auto-sync cash flow from orders and expenses
    async syncCashFlowFromOrders(date) {
        // Get completed orders for cash in
        const orders = await this.db.all(`SELECT id, total FROM orders 
       WHERE status = 'completed' 
       AND date(created_at) = date(?)`, [date]);
        // Create cash flow entries for each order
        for (const order of orders) {
            // Check if cash flow entry already exists
            const existing = await this.db.get('SELECT id FROM cash_flow WHERE date = ? AND linked_order_id = ? AND type = ?', [date, order.id, 'in']);
            if (!existing) {
                await this.db.run('INSERT INTO cash_flow (date, type, reason, amount, linked_order_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))', [date, 'in', 'Daily sales', order.total, order.id]);
            }
        }
    }
    // ============ PROFIT & LOSS ============
    async getProfitAndLoss(filters) {
        const fromDate = filters?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = filters?.to || new Date().toISOString().split('T')[0];
        // Get total revenue
        const revRow = await this.db.get('SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date >= ? AND date <= ?', [fromDate, toDate]);
        // Get total expenses
        const expRow = await this.db.get('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ?', [fromDate, toDate]);
        const totalRevenue = (revRow?.total !== undefined && revRow?.total !== null) ? revRow.total : 0;
        const totalExpenses = (expRow?.total !== undefined && expRow?.total !== null) ? expRow.total : 0;
        const netProfit = totalRevenue - totalExpenses;
        return {
            period: 'daily', // Default, can be enhanced
            from: fromDate,
            to: toDate,
            totalRevenue,
            totalExpenses,
            netProfit,
        };
    }
}
exports.FinanceService = FinanceService;
