"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablesService = void 0;
const exceptions_1 = require("../utils/exceptions");
class TablesService {
    constructor(db, usersService) {
        this.db = db;
        this.usersService = usersService;
    }
    async findByHall(hall_id) {
        const rows = await this.db.all('SELECT id, name, hall_id, created_at, updated_at FROM tables WHERE hall_id = ? ORDER BY name ASC', [hall_id]);
        return rows;
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name, hall_id, created_at, updated_at FROM tables WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Table not found');
        }
        return row;
    }
    async create(data) {
        // Insert with name only (no table_number)
        await this.db.run('INSERT INTO tables (name, hall_id) VALUES (?, ?)', [data.name, data.hall_id]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT id, name, hall_id, created_at, updated_at FROM tables WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created table');
        }
        return row;
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = {
            ...existing,
            ...data,
        };
        await this.db.run('UPDATE tables SET name = ?, hall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [merged.name, merged.hall_id, id]);
        const row = await this.db.get('SELECT id, name, hall_id, created_at, updated_at FROM tables WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Table not found after update');
        }
        return row;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM tables WHERE id = ?', [id]);
    }
    // Table lock methods
    async isTableUnlocked(tableId) {
        const row = await this.db.get(`SELECT id FROM table_locks 
       WHERE table_id = ? 
       AND (expires_at IS NULL OR expires_at > datetime('now'))`, [tableId]);
        return !!row;
    }
    async unlockTable(tableId, userId, password, expiresAt) {
        // Verify user is customer/manager/admin (customer role is the captain role)
        const user = await this.usersService.findOne(userId);
        if (!['customer', 'manager', 'admin'].includes(user.role)) {
            throw new exceptions_1.UnauthorizedException('Only customer, manager, or admin can unlock tables');
        }
        // Verify password
        const fullUser = await this.usersService.findByUsername(user.username);
        if (!fullUser) {
            throw new exceptions_1.UnauthorizedException('User not found');
        }
        const isValid = await this.usersService.validatePassword(fullUser, password);
        if (!isValid) {
            throw new exceptions_1.UnauthorizedException('Invalid password');
        }
        // Verify table exists
        await this.findOne(tableId);
        // Delete existing lock if any
        await this.db.run('DELETE FROM table_locks WHERE table_id = ?', [tableId]);
        // Insert new lock
        await this.db.run('INSERT INTO table_locks (table_id, unlocked_by_user_id, expires_at) VALUES (?, ?, ?)', [tableId, userId, expiresAt || null]);
    }
    async lockTable(tableId, userId) {
        // Verify user is captain/manager/admin
        const user = await this.usersService.findOne(userId);
        if (!['captain', 'manager', 'admin'].includes(user.role)) {
            throw new exceptions_1.UnauthorizedException('Only captain, manager, or admin can lock tables');
        }
        await this.db.run('DELETE FROM table_locks WHERE table_id = ?', [tableId]);
    }
    async getCustomerLockedTable(userId) {
        const row = await this.db.get('SELECT table_id FROM customer_table_locks WHERE user_id = ?', [userId]);
        return row ? row.table_id : null;
    }
    async lockCustomerToTable(userId, tableId) {
        // Verify table exists
        await this.findOne(tableId);
        // Delete existing lock if any
        await this.db.run('DELETE FROM customer_table_locks WHERE user_id = ?', [userId]);
        // Insert new lock
        await this.db.run('INSERT INTO customer_table_locks (user_id, table_id) VALUES (?, ?)', [userId, tableId]);
    }
    async unlockCustomerFromTable(userId, unlockingUserId, password) {
        // Verify unlocking user is captain/manager/admin
        const unlockingUser = await this.usersService.findOne(unlockingUserId);
        if (!['captain', 'manager', 'admin'].includes(unlockingUser.role)) {
            throw new exceptions_1.UnauthorizedException('Only captain, manager, or admin can unlock customers');
        }
        // Verify password
        const fullUser = await this.usersService.findByUsername(unlockingUser.username);
        if (!fullUser) {
            throw new exceptions_1.UnauthorizedException('User not found');
        }
        const isValid = await this.usersService.validatePassword(fullUser, password);
        if (!isValid) {
            throw new exceptions_1.UnauthorizedException('Invalid password');
        }
        await this.db.run('DELETE FROM customer_table_locks WHERE user_id = ?', [userId]);
    }
}
exports.TablesService = TablesService;
