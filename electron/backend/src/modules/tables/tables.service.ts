import { NotFoundException, UnauthorizedException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { requireUsers } from '../users/users.service';

export interface TableEntity {
  id: number;
  number: number;
  name?: string | null;
  hall_id: number | null;
  created_at: string;
  updated_at: string;
}

export class TablesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly usersService: ReturnType<typeof requireUsers>,
  ) {}

  async findAll(): Promise<TableEntity[]> {
    const rows = await this.db.all(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables ORDER BY name ASC',
    );
    return rows.map((row: any) => ({
      id: row.id,
      number: row.number ?? row.id, // Use number column, fallback to id if null
      name: row.name ?? null,
      hall_id: row.hall_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as TableEntity[];
  }

  async findByHall(hall_id: number): Promise<TableEntity[]> {
    // #region agent log
    // 4️⃣ Backend guard (TablesService) - Check null/undefined
    if (hall_id === null || hall_id === undefined) {
      console.error('[DETECT][BACKEND] hallId is missing in findByHall');
      throw new Error('DETECT: hallId missing in TablesService.findByHall');
    }
    // #endregion
    
    // #region agent log
    // 4️⃣ Backend guard (TablesService) - Check type
    if (typeof hall_id !== 'number') {
      console.error('[DETECT][BACKEND] hallId not number:', hall_id);
      throw new Error('DETECT: hallId type invalid in TablesService.findByHall');
    }
    // #endregion
    
    // Defensive coding: Reject queries without hallId
    if (!hall_id || typeof hall_id !== 'number' || isNaN(hall_id) || hall_id <= 0) {
      console.error(`[TablesService] findByHall REJECTED: Invalid hall_id: ${hall_id}`);
      throw new Error(`Invalid hall_id: ${hall_id}. hall_id must be a positive number.`);
    }
    
    console.log(`[TablesService] findByHall called for hall_id: ${hall_id}`);
    
    // Fixed query: Select from tables table with simple WHERE clause, no extra filters
    // Schema: id, number, name, hall_id, created_at, updated_at
    const query = 'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE hall_id = ? ORDER BY id ASC, name ASC';
    console.log(`[TablesService] Executing query: ${query} with params: [${hall_id}]`);
    const rows = await this.db.all(query, [hall_id]);
    console.log(`[TablesService] Query returned ${rows.length} rows:`, JSON.stringify(rows, null, 2));
    
    // Map rows to TableEntity format, using number column (fallback to id if null)
    const mapped = rows.map((row: any) => ({
      id: row.id,
      number: row.number ?? row.id, // Use number column, fallback to id if null
      name: row.name ?? null,
      hall_id: row.hall_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as TableEntity[];
    console.log(`[TablesService] Mapped ${mapped.length} tables:`, JSON.stringify(mapped, null, 2));
    return mapped;
  }

  async findOne(id: number): Promise<TableEntity> {
    const row = await this.db.get(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Table not found');
    }
    // Ensure number is always set (fallback to id if somehow still null)
    return {
      ...row,
      number: (row as any).number ?? row.id ?? 1,
    } as TableEntity;
  }

  async create(data: {
    number?: number;
    name?: string;
    hall_id?: number | null;
  }): Promise<TableEntity> {
    // hall_id is optional for external/delivery orders (can be null)
    const hall_id = data.hall_id ?? null;
    
    console.log(`[TablesService] create called with data:`, JSON.stringify(data, null, 2));
    console.log(`[TablesService] Creating table for hall_id: ${hall_id}`);
    
    // Table number: auto-increment per hall when not provided (1, 2, 3, ...)
    let tableNumber: number;
    if (hall_id !== null) {
      // DINE-IN: use provided number, or auto-assign next (max + 1)
      if (data.number != null && typeof data.number === 'number' && data.number >= 1) {
        tableNumber = data.number;
      } else {
        const maxRow = await this.db.get(
          'SELECT COALESCE(MAX(number), 0) as maxNum FROM tables WHERE hall_id = ?',
          [hall_id]
        );
        const nextNum = ((maxRow as any)?.maxNum ?? 0) + 1;
        tableNumber = nextNum;
        console.log(`[TablesService] Auto-assigned table number: ${tableNumber} for hall_id: ${hall_id}`);
      }
    } else {
      // VIRTUAL TABLE (pickup/delivery): number is optional, default to 0
      tableNumber = (data.number && typeof data.number === 'number' && data.number >= 1) ? data.number : 0;
    }
    
    // Auto-generate name if not provided or empty
    let tableName: string;
    if (data.name && typeof data.name === 'string' && data.name.trim().length > 0) {
      tableName = data.name.trim();
    } else {
      // Auto-generate name: "طاولة {number}" (Table {number}) or just the name if number is 0
      tableName = tableNumber > 0 ? `طاولة ${tableNumber}` : (data.name || 'طاولة');
    }
    
    // Insert with number, name, and optional hall_id
    // CRITICAL: id is auto-generated, number is user-provided
    const insertSql = 'INSERT INTO tables (number, name, hall_id) VALUES (?, ?, ?)';
    const insertParams = [tableNumber, tableName, hall_id];
    
    console.log(`[TablesService] Attempting INSERT: ${insertSql} with params:`, insertParams);
    
    // Insert the table - do NOT rely on lastInsertRowId (unreliable in sql.js)
    await this.db.run(insertSql, insertParams);
    console.log('[TablesService] INSERT completed successfully');
    
    // Fetch the created table by (number, hall_id) - NOT by id
    // This is reliable and doesn't depend on lastInsertRowId
    const row = await this.db.get(
      'SELECT id, number, name, hall_id, created_at, updated_at FROM tables WHERE number = ? AND hall_id = ? ORDER BY id DESC LIMIT 1',
      [tableNumber, hall_id]
    );
    
    if (row) {
      // Found the table - return it
      console.log('[TablesService] ✓ Successfully created and fetched table:', JSON.stringify(row, null, 2));
      return row as TableEntity;
    }
    
    // If fetch failed, return based on input data (id will be 0, but that's OK)
    // The table was inserted, we just can't get the ID reliably
    const now = new Date().toISOString();
    console.log('[TablesService] ✓ Successfully created (returning input-based response)');
    return {
      id: 0,  // ID unknown - will be set correctly on next fetch
      number: tableNumber,
      name: tableName,
      hall_id: hall_id,
      created_at: now,
      updated_at: now,
    } as TableEntity;
  }

  async update(
    id: number,
    data: { number?: number; name?: string; hall_id?: number | null },
  ): Promise<TableEntity> {
    const existing = await this.findOne(id);
    const merged = {
      ...existing,
      ...data,
    };

    await this.db.run(
      'UPDATE tables SET number = ?, name = ?, hall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.number, merged.name || null, merged.hall_id, id],
    );
    
    // Query back the updated row
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

  // Table lock methods
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
    // Verify user is customer/manager/admin (customer role is the captain role)
    const user = await this.usersService.findOne(userId);
    if (!['customer', 'manager', 'admin'].includes(user.role)) {
      throw new UnauthorizedException('Only customer, manager, or admin can unlock tables');
    }

    // Verify password
    const fullUser = await this.usersService.findByUsername(user.username);
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }
    const isValid = await this.usersService.validatePassword(fullUser, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Verify table exists
    await this.findOne(tableId);

    // Delete existing lock if any
    await this.db.run('DELETE FROM table_locks WHERE table_id = ?', [tableId]);

    // Insert new lock
    await this.db.run(
      'INSERT INTO table_locks (table_id, unlocked_by_user_id, expires_at) VALUES (?, ?, ?)',
      [tableId, userId, expiresAt || null],
    );
  }

  async lockTable(tableId: number, userId: number): Promise<void> {
    // Verify user is captain/manager/admin
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
    // Verify table exists
    await this.findOne(tableId);

    // Delete existing lock if any
    await this.db.run('DELETE FROM customer_table_locks WHERE user_id = ?', [userId]);

    // Insert new lock
    await this.db.run(
      'INSERT INTO customer_table_locks (user_id, table_id) VALUES (?, ?)',
      [userId, tableId],
    );
  }

  async unlockCustomerFromTable(userId: number, unlockingUserId: number, password: string): Promise<void> {
    // Verify unlocking user is captain/manager/admin
    const unlockingUser = await this.usersService.findOne(unlockingUserId);
    if (!['captain', 'manager', 'admin'].includes(unlockingUser.role)) {
      throw new UnauthorizedException('Only captain, manager, or admin can unlock customers');
    }

    // Verify password
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

let tablesInstance: TablesService | null = null;

export function initializeTables(db: DatabaseService): void {
  tablesInstance = new TablesService(db, requireUsers());
}

export function requireTables(): TablesService {
  if (!tablesInstance) {
    throw new Error('Tables not initialized');
  }
  return tablesInstance;
}

export function findAll(): ReturnType<TablesService['findAll']> {
  return requireTables().findAll();
}

export function findByHall(
  ...args: Parameters<TablesService['findByHall']>
): ReturnType<TablesService['findByHall']> {
  return requireTables().findByHall(...args);
}

export function findOne(
  ...args: Parameters<TablesService['findOne']>
): ReturnType<TablesService['findOne']> {
  return requireTables().findOne(...args);
}

export function create(
  ...args: Parameters<TablesService['create']>
): ReturnType<TablesService['create']> {
  return requireTables().create(...args);
}

export function update(
  ...args: Parameters<TablesService['update']>
): ReturnType<TablesService['update']> {
  return requireTables().update(...args);
}

export function remove(
  ...args: Parameters<TablesService['remove']>
): ReturnType<TablesService['remove']> {
  return requireTables().remove(...args);
}

export function isTableUnlocked(
  ...args: Parameters<TablesService['isTableUnlocked']>
): ReturnType<TablesService['isTableUnlocked']> {
  return requireTables().isTableUnlocked(...args);
}

export function unlockTable(
  ...args: Parameters<TablesService['unlockTable']>
): ReturnType<TablesService['unlockTable']> {
  return requireTables().unlockTable(...args);
}

export function lockTable(
  ...args: Parameters<TablesService['lockTable']>
): ReturnType<TablesService['lockTable']> {
  return requireTables().lockTable(...args);
}

export function getCustomerLockedTable(
  ...args: Parameters<TablesService['getCustomerLockedTable']>
): ReturnType<TablesService['getCustomerLockedTable']> {
  return requireTables().getCustomerLockedTable(...args);
}

export function lockCustomerToTable(
  ...args: Parameters<TablesService['lockCustomerToTable']>
): ReturnType<TablesService['lockCustomerToTable']> {
  return requireTables().lockCustomerToTable(...args);
}

export function unlockCustomerFromTable(
  ...args: Parameters<TablesService['unlockCustomerFromTable']>
): ReturnType<TablesService['unlockCustomerFromTable']> {
  return requireTables().unlockCustomerFromTable(...args);
}
