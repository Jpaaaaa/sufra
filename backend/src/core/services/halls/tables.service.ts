import { NotFoundException, UnauthorizedException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { UsersService } from '../auth/users.service';

export interface TableEntity {
  id: number;
  number: number;
  name: string;
  hall_id: number | null;
  created_at: string;
  updated_at: string;
}

export class TablesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async findAll(): Promise<TableEntity[]> {
    const rows = await this.db.all(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables ORDER BY name ASC',
    );
    return rows as TableEntity[];
  }

  async findByHall(hall_id: number): Promise<TableEntity[]> {
    const rows = await this.db.all(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE hall_id = ? ORDER BY name ASC',
      [hall_id],
    );
    return rows as TableEntity[];
  }

  async findOne(id: number): Promise<TableEntity> {
    const row = await this.db.get(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Table not found');
    }
    return row as TableEntity;
  }

  async create(data: {
    name?: string;
    hall_id?: number | null;
    number?: number;
  }): Promise<TableEntity> {
    console.log('[TablesService] create called with data:', JSON.stringify(data));

    const hallId = data.hall_id ?? null;

    let tableNumber: number;
    if (hallId !== null) {
      if (!data.number || typeof data.number !== 'number' || data.number < 1) {
        console.error('[TablesService] Validation failed: number is required and must be >= 1 for dine-in tables');
        throw new Error('Table number is required and must be >= 1');
      }
      tableNumber = data.number;
    } else {
      tableNumber = (data.number && typeof data.number === 'number' && data.number >= 1) ? data.number : 0;
    }

    let tableName: string;
    if (data.name && typeof data.name === 'string' && data.name.trim().length > 0) {
      tableName = data.name.trim();
    } else {
      tableName = tableNumber > 0 ? `طاولة ${tableNumber}` : (data.name || 'طاولة');
    }

    try {
      await this.db.run(
        'INSERT INTO tables (number, name, hall_id) VALUES (?, ?, ?)',
        [tableNumber, tableName, hallId],
      );

      console.log('[TablesService] INSERT completed successfully');

      const row = await this.db.get(
        'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE number = ? AND hall_id = ? ORDER BY id DESC LIMIT 1',
        [tableNumber, hallId],
      );

      if (row) {
        const plainTable = JSON.parse(JSON.stringify(row));
        console.log('[TablesService] ✓ Successfully created and fetched table:', JSON.stringify(plainTable));
        return plainTable as TableEntity;
      }

      const now = new Date().toISOString();
      const table: TableEntity = {
        id: 0,
        number: tableNumber,
        name: tableName,
        hall_id: hallId,
        created_at: now,
        updated_at: now,
      };

      const plainTable = JSON.parse(JSON.stringify(table));
      console.log('[TablesService] ✓ Successfully created (returning input-based response):', JSON.stringify(plainTable));
      return plainTable;
    } catch (error: any) {
      console.error('[TablesService] Error in create method:', error);
      if (error.message && error.message.includes('Table name is required')) throw error;
      if (error.message && error.message.includes('Table number is required')) throw error;
      if (error.message && error.message.includes('Failed to get last insert row ID')) throw error;
      throw new Error(`Failed to create table: ${error.message || String(error)}`);
    }
  }

  async update(
    id: number,
    data: { name?: string; hall_id?: number; number?: number },
  ): Promise<TableEntity> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };

    await this.db.run(
      'UPDATE tables SET number = ?, name = ?, hall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.number, merged.name, merged.hall_id, id],
    );
    const row = await this.db.get(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Table not found after update');
    }
    return row as TableEntity;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM tables WHERE id = ?', [id]);
  }

  async isTableUnlocked(tableId: number): Promise<boolean> {
    const row = await this.db.get(
      `SELECT id FROM table_locks 
       WHERE table_id = ? 
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [tableId],
    );
    return !!row;
  }

  async unlockTable(tableId: number, userId: number, password: string, expiresAt?: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!['customer', 'manager', 'admin'].includes(user.role)) {
      throw new UnauthorizedException('Only customer, manager, or admin can unlock tables');
    }

    const fullUser = await this.usersService.findByUsername(user.username);
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }
    const isValid = await this.usersService.validatePassword(fullUser, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.findOne(tableId);

    await this.db.run('DELETE FROM table_locks WHERE table_id = ?', [tableId]);

    await this.db.run(
      'INSERT INTO table_locks (table_id, unlocked_by_user_id, expires_at) VALUES (?, ?, ?)',
      [tableId, userId, expiresAt || null],
    );
  }

  async lockTable(tableId: number, userId: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!['captain', 'manager', 'admin'].includes(user.role)) {
      throw new UnauthorizedException('Only captain, manager, or admin can lock tables');
    }

    await this.db.run('DELETE FROM table_locks WHERE table_id = ?', [tableId]);
  }

  async getCustomerLockedTable(userId: number): Promise<number | null> {
    const row = await this.db.get(
      'SELECT table_id FROM customer_table_locks WHERE user_id = ?',
      [userId],
    );
    return row ? row.table_id : null;
  }

  async lockCustomerToTable(userId: number, tableId: number): Promise<void> {
    await this.findOne(tableId);

    await this.db.run('DELETE FROM customer_table_locks WHERE user_id = ?', [userId]);

    await this.db.run(
      'INSERT INTO customer_table_locks (user_id, table_id) VALUES (?, ?)',
      [userId, tableId],
    );
  }

  async unlockCustomerFromTable(userId: number, unlockingUserId: number, password: string): Promise<void> {
    const unlockingUser = await this.usersService.findOne(unlockingUserId);
    if (!['captain', 'manager', 'admin'].includes(unlockingUser.role)) {
      throw new UnauthorizedException('Only captain, manager, or admin can unlock customers');
    }

    const fullUser = await this.usersService.findByUsername(unlockingUser.username);
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }
    const isValid = await this.usersService.validatePassword(fullUser, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.db.run('DELETE FROM customer_table_locks WHERE user_id = ?', [userId]);
  }
}
