import Database, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { getAppDataPath, ensureDirectoryExists } from '../utils/app-data-path';
import {
  computeBusinessDate,
  DEFAULT_BUSINESS_DAY_START,
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
} from '../utils/business-date';
import { resolveOrderShift } from '../utils/shift-window';

/**
 * Type definitions for database query results
 */
export interface DatabaseRow {
  [key: string]: any;
}

export class DatabaseService {
  private db!: BetterSqliteDatabase;
  private migrationInProgress = false;
  private dbPath!: string;
  private lastInsertRowId = 0;

  // Async initialization tracking
  private initPromise!: Promise<void>;
  private isInitialized = false;
  private initError: Error | null = null;

  async initialize() {
    console.log('[DB] Starting database initialization...');

    this.initPromise = this.initializeDatabase();

    try {
      await this.initPromise;
      console.log('[DB] ✓ Database initialized successfully');
    } catch (error: any) {
      console.error('[DB] ✕ Database initialization failed:', error);
      this.initError = error;
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    const dataDir = getAppDataPath();
    ensureDirectoryExists(dataDir);
    console.log('[DB] Data directory:', dataDir);

    this.dbPath = getAppDataPath('sufra.sqlite');
    console.log('[DB] Database path:', this.dbPath);

    const isNewDatabase = !fs.existsSync(this.dbPath);
    if (isNewDatabase) {
      console.log('[DB] Creating new database...');
    } else {
      console.log('[DB] Opening existing database...');
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    console.log('[DB] ✓ better-sqlite3 connected:', this.dbPath);

    console.log('[DB] Initializing schema and seeding data...');
    this.initializeSchemaAndSeed();

    this.isInitialized = true;
    console.log('[DB] ✓ Database ready for queries');
  }

  /**
   * Wait for database to be fully initialized before executing queries
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initError) {
      throw new Error(`Database initialization failed: ${this.initError.message}`);
    }

    if (!this.initPromise) {
      throw new Error('Database initialization not started');
    }

    await this.initPromise;
  }

  /**
   * Check if database is ready (synchronous check)
   */
  isReady(): boolean {
    return this.isInitialized && !this.initError;
  }

  async shutdown() {
    if (this.db) {
      try {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (error) {
        console.warn('[DB] WAL checkpoint during shutdown failed:', error);
      }
      this.db.close();
    }
  }

  /** Hot checkpoint before copying sufra.sqlite for backup (app keeps running). */
  checkpointWal(): void {
    if (!this.db) return;
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (error) {
      console.warn('[DB] WAL checkpoint failed:', error);
    }
  }

  getConnection(): BetterSqliteDatabase {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call ensureInitialized() first or wait for initialize() to complete.');
    }
    return this.db;
  }

  // Public helper methods for services to use
  async run(sql: string, params: any[] = []): Promise<void> {
    await this.runInsert(sql, params).then(() => undefined);
  }

  async runInsert(sql: string, params: any[] = []): Promise<number> {
    await this.ensureInitialized();

    try {
      const result = this.db.prepare(sql).run(...params);
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        this.lastInsertRowId = Number(result.lastInsertRowid);
      }
      return this.lastInsertRowId;
    } catch (error) {
      console.error('[DB] Run error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  async get(sql: string, params: any[] = []): Promise<DatabaseRow | null> {
    await this.ensureInitialized();

    try {
      const row = this.db.prepare(sql).get(...params) as DatabaseRow | undefined;
      return row ?? null;
    } catch (error) {
      console.error('[DB] Get error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  async all(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    await this.ensureInitialized();

    try {
      return this.db.prepare(sql).all(...params) as DatabaseRow[];
    } catch (error) {
      console.error('[DB] All error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  async getLastInsertRowId(): Promise<number> {
    await this.ensureInitialized();
    console.log('[DB] getLastInsertRowId result:', this.lastInsertRowId);
    return this.lastInsertRowId;
  }

  // Internal sync methods for use during initialization only
  private runSync(sql: string, params: any[] = []): void {
    try {
      const result = this.db.prepare(sql).run(...params);
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        this.lastInsertRowId = Number(result.lastInsertRowid);
      }
    } catch (error) {
      console.error('[DB] RunSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  }

  private getSync(sql: string, params: any[] = []): DatabaseRow | null {
    try {
      const row = this.db.prepare(sql).get(...params) as DatabaseRow | undefined;
      return row ?? null;
    } catch (error) {
      console.error('[DB] GetSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  }

  private allSync(sql: string, params: any[] = []): DatabaseRow[] {
    try {
      return this.db.prepare(sql).all(...params) as DatabaseRow[];
    } catch (error) {
      console.error('[DB] AllSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  }

  /**
   * Ensures order_items.options_json exists on old and rebuilt schemas.
   * Safe to call multiple times; must run again after any table recreate.
   */
  private ensureOrderItemsOptionsJsonColumn(): void {
    const check = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='options_json'",
    );
    if (check && check.cnt === 0) {
      try {
        this.runSync('ALTER TABLE order_items ADD COLUMN options_json TEXT');
        console.log('[DB] ✅ Added options_json column to order_items table');
      } catch (error) {
        console.error('[DB] Failed to add options_json to order_items', error);
      }
    }
  }

  private createTablesTable() {
    try {
      this.runSync(
        `CREATE TABLE IF NOT EXISTS tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          number INTEGER NOT NULL,
          name TEXT NOT NULL,
          hall_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
        )`,
      );
    } catch (error) {
      console.error('[DB] Failed to create tables table', error);
    }
  }

  private initializeSchemaAndSeed() {
    // Core tables
    this.runSync(
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )`,
    );

    const categoriesSortOrderCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('categories') WHERE name='sort_order'",
    );
    if (categoriesSortOrderCheck && categoriesSortOrderCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE categories ADD COLUMN sort_order INTEGER');
        this.runSync('UPDATE categories SET sort_order = id WHERE sort_order IS NULL');
        console.log('[DB] ✅ Added sort_order column to categories table');
      } catch (error) {
        console.error('[DB] Failed to add sort_order to categories', error);
      }
    }

    const categoriesMenuActiveCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('categories') WHERE name='is_menu_active'",
    );
    if (categoriesMenuActiveCheck && categoriesMenuActiveCheck.cnt === 0) {
      try {
        this.runSync(
          'ALTER TABLE categories ADD COLUMN is_menu_active INTEGER NOT NULL DEFAULT 1',
        );
        console.log('[DB] ✅ Added is_menu_active column to categories table');
      } catch (error) {
        console.error('[DB] Failed to add is_menu_active to categories', error);
      }
    }

    // Create kitchens table first (needed for items FK)
    this.runSync(
      `CREATE TABLE IF NOT EXISTS kitchens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        floor_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(floor_id) REFERENCES floors(id) ON DELETE SET NULL
      )`,
    );

    // Migration: Add floor_id column to existing kitchens table if it doesn't exist
    const kitchensFloorIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('kitchens') WHERE name='floor_id'",
    );
    if (kitchensFloorIdCheck && kitchensFloorIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE kitchens ADD COLUMN floor_id INTEGER');
        console.log('[DB] ✅ Added floor_id column to kitchens table');
      } catch (error) {
        console.error('[DB] Failed to add floor_id to kitchens', error);
      }
    }

    this.runSync(
      `CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        categoryId INTEGER,
        kitchen_id INTEGER,
        FOREIGN KEY (categoryId) REFERENCES categories(id),
        FOREIGN KEY (kitchen_id) REFERENCES kitchens(id)
      )`,
    );

    // Migration: Add kitchen_id column to existing items table if it doesn't exist
    const itemsKitchenIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='kitchen_id'",
    );
    if (itemsKitchenIdCheck && itemsKitchenIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN kitchen_id INTEGER');
        console.log('[DB] ✅ Added kitchen_id column to items table');
      } catch (error) {
        console.error('[DB] Failed to add kitchen_id to items', error);
      }
    }

    // Migration: Add image_url column to existing items table if it doesn't exist
    const itemsImageUrlCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='image_url'",
    );
    if (itemsImageUrlCheck && itemsImageUrlCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN image_url TEXT');
        console.log('[DB] ✅ Added image_url column to items table');
      } catch (error) {
        console.error('[DB] Failed to add image_url to items', error);
      }
    }

    // Migration: Add is_out_of_stock column to existing items table if it doesn't exist
    const itemsStockCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='is_out_of_stock'",
    );
    if (itemsStockCheck && itemsStockCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN is_out_of_stock INTEGER DEFAULT 0');
        console.log('[DB] ✅ Added is_out_of_stock column to items table');
      } catch (error) {
        console.error('[DB] Failed to add is_out_of_stock to items', error);
      }
    }

    const itemsHiddenMenuCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='hidden_from_menu'",
    );
    if (itemsHiddenMenuCheck && itemsHiddenMenuCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN hidden_from_menu INTEGER NOT NULL DEFAULT 0');
        console.log('[DB] ✅ Added hidden_from_menu column to items table');
      } catch (error) {
        console.error('[DB] Failed to add hidden_from_menu to items', error);
      }
    }

    // Migration: Add description column to items (short description / components of food)
    const itemsDescCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='description'",
    );
    if (itemsDescCheck && itemsDescCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN description TEXT');
        console.log('[DB] ✅ Added description column to items table');
      } catch (error) {
        console.error('[DB] Failed to add description to items', error);
      }
    }

    const itemsHasOptionsCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='has_options'",
    );
    if (itemsHasOptionsCheck && itemsHasOptionsCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE items ADD COLUMN has_options INTEGER NOT NULL DEFAULT 0');
        console.log('[DB] ✅ Added has_options column to items table');
      } catch (error) {
        console.error('[DB] Failed to add has_options to items', error);
      }
    }

    this.runSync(
      `CREATE TABLE IF NOT EXISTS item_option_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        pricing_mode TEXT NOT NULL,
        min_select INTEGER NOT NULL DEFAULT 1,
        max_select INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
      )`,
    );

    this.runSync(
      `CREATE TABLE IF NOT EXISTS item_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_out_of_stock INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(group_id) REFERENCES item_option_groups(id) ON DELETE CASCADE
      )`,
    );

    // Shelf items table for barcoded products
    this.runSync(
      `CREATE TABLE IF NOT EXISTS shelf_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT NOT NULL UNIQUE,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Shelf sales table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS shelf_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shelf_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE CASCADE
      )`,
    );

    // Orders and order items
    this.runSync(
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        order_type TEXT DEFAULT 'dine-in',
        status TEXT DEFAULT 'pending',
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES tables(id)
      )`,
    );

    // Migration: Add discount column to existing orders table if it doesn't exist
    const ordersDiscountCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='discount'",
    );
    if (ordersDiscountCheck && ordersDiscountCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN discount INTEGER DEFAULT 0');
        console.log('[DB] ✅ Added discount column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add discount to orders', error);
      }
    }

    // Migration: Add globalDiscount column to existing orders table if it doesn't exist
    const ordersGlobalDiscountCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='globalDiscount'",
    );
    if (ordersGlobalDiscountCheck && ordersGlobalDiscountCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN globalDiscount TEXT');
        console.log('[DB] ✅ Added globalDiscount column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add globalDiscount to orders', error);
      }
    }

    // Migration: Add order_type column to existing orders table if it doesn't exist
    const ordersOrderTypeCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='order_type'",
    );
    if (ordersOrderTypeCheck && ordersOrderTypeCheck.cnt === 0) {
      try {
        this.runSync("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine-in'");
        console.log('[DB] ✅ Added order_type column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add order_type to orders', error);
      }
    }

    // Migration: Add customer_name column to existing orders table if it doesn't exist
    const ordersCustomerNameCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_name'",
    );
    if (ordersCustomerNameCheck && ordersCustomerNameCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN customer_name TEXT');
        console.log('[DB] ✅ Added customer_name column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add customer_name to orders', error);
      }
    }

    // Migration: Add customer_phone column to existing orders table if it doesn't exist
    const ordersCustomerPhoneCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_phone'",
    );
    if (ordersCustomerPhoneCheck && ordersCustomerPhoneCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
        console.log('[DB] ✅ Added customer_phone column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add customer_phone to orders', error);
      }
    }

    // Migration: Add customer_location column to existing orders table if it doesn't exist
    const ordersCustomerLocationCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_location'",
    );
    if (ordersCustomerLocationCheck && ordersCustomerLocationCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN customer_location TEXT');
        console.log('[DB] ✅ Added customer_location column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add customer_location to orders', error);
      }
    }

    // Migration: Add note column to existing orders table if it doesn't exist
    const ordersNoteCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='note'",
    );
    if (ordersNoteCheck && ordersNoteCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE orders ADD COLUMN note TEXT');
        console.log('[DB] ✅ Added note column to orders table');
      } catch (error) {
        console.error('[DB] Failed to add note to orders', error);
      }
    }

    this.runSync(
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        kitchen_id INTEGER,
        service_type TEXT DEFAULT 'dine-in',
        shelf_item_id INTEGER,
        order_type TEXT DEFAULT 'dine_in',
        options_json TEXT,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
        FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL
      )`,
    );

    // Table locks - tracks which tables are unlocked by captain
    this.runSync(
      `CREATE TABLE IF NOT EXISTS table_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL UNIQUE,
        unlocked_by_user_id INTEGER NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY(unlocked_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    );

    // Customer table locks - tracks which table each customer is locked to
    this.runSync(
      `CREATE TABLE IF NOT EXISTS customer_table_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        table_id INTEGER NOT NULL,
        locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE
      )`,
    );

    // Migration: Add service_type column to existing order_items table if it doesn't exist
    const orderItemsServiceTypeCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='service_type'",
    );
    if (orderItemsServiceTypeCheck && orderItemsServiceTypeCheck.cnt === 0) {
      try {
        this.runSync("ALTER TABLE order_items ADD COLUMN service_type TEXT DEFAULT 'dine-in'");
        console.log('[DB] ✅ Added service_type column to order_items table');
      } catch (error) {
        console.error('[DB] Failed to add service_type to order_items', error);
      }
    }

    // Migration: Add shelf_item_id column to existing order_items table if it doesn't exist
    const orderItemsShelfItemIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='shelf_item_id'",
    );
    if (orderItemsShelfItemIdCheck && orderItemsShelfItemIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE order_items ADD COLUMN shelf_item_id INTEGER');
        console.log('[DB] ✅ Added shelf_item_id column to order_items table');
      } catch (error) {
        console.error('[DB] Failed to add shelf_item_id to order_items', error);
      }
    }

    // Migration: Add order_type column to existing order_items table if it doesn't exist
    // This column is used to distinguish between dine_in, pickup, and delivery orders
    // Critical for proper domain separation and filtering
    const orderItemsOrderTypeCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='order_type'",
    );
    if (orderItemsOrderTypeCheck && orderItemsOrderTypeCheck.cnt === 0) {
      try {
        this.runSync("ALTER TABLE order_items ADD COLUMN order_type TEXT DEFAULT 'dine_in'");
        // Update existing rows to have order_type='dine_in' (safe default for existing data)
        this.runSync("UPDATE order_items SET order_type='dine_in' WHERE order_type IS NULL");
        console.log('[DB] ✅ Added order_type column to order_items table');
      } catch (error) {
        console.error('[DB] Failed to add order_type to order_items', error);
      }
    }

    // Ensure options_json before any rebuild so data is preserved across migrates.
    this.ensureOrderItemsOptionsJsonColumn();

    // Migration: order_items.order_id used to FK orders(id), but dine_in/pickup/delivery
    // orders now live in separate tables. Drop that FK so inserts work with FK enforcement on.
    const orderItemsSchema = this.getSync(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items'",
    );
    if (orderItemsSchema?.sql && orderItemsSchema.sql.includes('REFERENCES orders(id)')) {
      console.log('[DB] 🔄 Migrating order_items: removing legacy orders(id) foreign key...');
      try {
        this.db.pragma('foreign_keys = OFF');
        this.runSync(
          `CREATE TABLE order_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            item_id INTEGER,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            price INTEGER NOT NULL,
            kitchen_id INTEGER,
            service_type TEXT DEFAULT 'dine-in',
            shelf_item_id INTEGER,
            order_type TEXT DEFAULT 'dine_in',
            options_json TEXT,
            FOREIGN KEY(item_id) REFERENCES items(id),
            FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
            FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL
          )`,
        );
        this.runSync(
          `INSERT INTO order_items_new (
            id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id, order_type, options_json
          )
          SELECT
            id, order_id,
            CASE WHEN shelf_item_id IS NOT NULL THEN NULL ELSE item_id END,
            item_name, quantity, price, kitchen_id, service_type, shelf_item_id,
            COALESCE(order_type, 'dine_in'),
            options_json
          FROM order_items`,
        );
        this.runSync('DROP TABLE order_items');
        this.runSync('ALTER TABLE order_items_new RENAME TO order_items');
        this.db.pragma('foreign_keys = ON');
        console.log('[DB] ✅ Migrated order_items without legacy orders(id) foreign key');
      } catch (error) {
        this.db.pragma('foreign_keys = ON');
        console.error('[DB] Failed to migrate order_items foreign keys', error);
      }
    }

    // Migration: allow NULL item_id for shelf-only order lines (shelf_item_id set).
    const orderItemsItemIdSchema = this.getSync(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items'",
    );
    if (
      orderItemsItemIdSchema?.sql &&
      orderItemsItemIdSchema.sql.includes('item_id INTEGER NOT NULL')
    ) {
      console.log('[DB] 🔄 Migrating order_items: nullable item_id for shelf lines...');
      try {
        this.db.pragma('foreign_keys = OFF');
        this.runSync(
          `CREATE TABLE order_items_shelf_fix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            item_id INTEGER,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            price INTEGER NOT NULL,
            kitchen_id INTEGER,
            service_type TEXT DEFAULT 'dine-in',
            shelf_item_id INTEGER,
            order_type TEXT DEFAULT 'dine_in',
            options_json TEXT,
            FOREIGN KEY(item_id) REFERENCES items(id),
            FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
            FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL
          )`,
        );
        this.runSync(
          `INSERT INTO order_items_shelf_fix (
            id, order_id, item_id, item_name, quantity, price, kitchen_id, service_type, shelf_item_id, order_type, options_json
          )
          SELECT
            id, order_id,
            CASE WHEN shelf_item_id IS NOT NULL THEN NULL ELSE item_id END,
            item_name, quantity, price, kitchen_id, service_type, shelf_item_id,
            COALESCE(order_type, 'dine_in'),
            options_json
          FROM order_items`,
        );
        this.runSync('DROP TABLE order_items');
        this.runSync('ALTER TABLE order_items_shelf_fix RENAME TO order_items');
        this.db.pragma('foreign_keys = ON');
        console.log('[DB] ✅ order_items item_id nullable for shelf lines');
      } catch (error) {
        this.db.pragma('foreign_keys = ON');
        console.error('[DB] Failed to migrate order_items nullable item_id', error);
      }
    }

    // Rebuild migrations above used to drop options_json; re-ensure for already-broken DBs
    // and any future recreate that forgets the column.
    this.ensureOrderItemsOptionsJsonColumn();

    // Migration: Migrate from table_number to name column
    // Check if table_number column exists (old schema) - MUST run BEFORE CREATE TABLE
    let tablesTableNumberCheck;
    try {
      tablesTableNumberCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('tables') WHERE name='table_number'",
      );
    } catch (error) {
      // Table might not exist yet, that's fine - continue to create it
      console.log('[DB] Tables table does not exist yet, will create with new schema');
      this.createTablesTable();
      tablesTableNumberCheck = null;
    }

    if (tablesTableNumberCheck && tablesTableNumberCheck.cnt > 0) {
      // Old schema exists with table_number - need to recreate table
      console.log('[DB] 🔄 Detected old schema with table_number, migrating to name...');

      // Step 1: Rename existing tables table to tables_old
      try {
        this.runSync('ALTER TABLE tables RENAME TO tables_old');

        // Step 2: Create new tables table with number column (migrated from table_number)
        this.runSync(
          `CREATE TABLE tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL,
            name TEXT NOT NULL,
            hall_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
          )`,
        );

        // Step 3: Copy data from old table to new table
        // Check if name column exists in old table
        let nameCheckRow;
        try {
          nameCheckRow = this.getSync(
            "SELECT COUNT(*) as cnt FROM pragma_table_info('tables_old') WHERE name='name'",
          );
        } catch (error) {
          nameCheckRow = null;
        }

        const hasNameColumn = nameCheckRow && nameCheckRow.cnt > 0;

        const insertQuery = hasNameColumn
          ? `INSERT INTO tables (id, number, name, hall_id, created_at, updated_at)
             SELECT 
               id,
               COALESCE(table_number, 1) AS number,
               COALESCE(
                 NULLIF(name, ''),
                 'طاولة ' || CAST(table_number AS TEXT)
               ) AS name,
               hall_id,
               COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at,
               COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
             FROM tables_old`
          : `INSERT INTO tables (id, number, name, hall_id, created_at, updated_at)
             SELECT 
               id,
               COALESCE(table_number, 1) AS number,
               'طاولة ' || CAST(table_number AS TEXT) AS name,
               hall_id,
               COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at,
               COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
             FROM tables_old`;

        try {
          this.runSync(insertQuery);

          // Step 4: Drop the old table
          this.runSync('DROP TABLE tables_old');
          console.log('[DB] ✅ Successfully migrated tables table: migrated table_number to number column');
        } catch (error) {
          console.error('[DB] Failed to copy data from old tables table', error);
        }
      } catch (error) {
        console.error('[DB] Failed to rename tables table', error);
        // Try to continue anyway - maybe table doesn't exist
        this.createTablesTable();
      }
    } else {
      // No table_number column - check if table exists, if not create it
      let tableExistsRow;
      try {
        tableExistsRow = this.getSync(
          "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='tables'",
        );
      } catch (error) {
        tableExistsRow = null;
      }

      if (!tableExistsRow || tableExistsRow.cnt === 0) {
        // Table doesn't exist, create it
        this.createTablesTable();
      }
      // Migration: Add number column to existing tables table if it doesn't exist
      const tablesNumberCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('tables') WHERE name='number'",
      );
      if (tablesNumberCheck && tablesNumberCheck.cnt === 0) {
        try {
          this.runSync('ALTER TABLE tables ADD COLUMN number INTEGER NOT NULL DEFAULT 1');
          console.log('[DB] ✅ Added number column to tables table');
        } catch (error) {
          console.error('[DB] Failed to add number column to tables', error);
        }
      }
    }

    // Migration: Make name column nullable (SQLite doesn't support changing NOT NULL directly)
    // We handle this in application code by allowing empty strings/null
    // But if we need to change the schema, we'd need to recreate the table

    // Create floors table first (needed for halls FK)
    this.runSync(
      `CREATE TABLE IF NOT EXISTS floors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        floor_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    this.runSync(
      `CREATE TABLE IF NOT EXISTS halls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hall_number INTEGER NOT NULL,
        floor_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(floor_id) REFERENCES floors(id) ON DELETE SET NULL
      )`,
    );

    // Migration: Add floor_id column to existing halls table if it doesn't exist
    const hallsFloorIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('halls') WHERE name='floor_id'",
    );
    if (hallsFloorIdCheck && hallsFloorIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE halls ADD COLUMN floor_id INTEGER');
        console.log('[DB] ✅ Added floor_id column to halls table');
      } catch (error) {
        console.error('[DB] Failed to add floor_id to halls', error);
      }
    }

    // Shifts table - tracks work shifts within business days
    this.runSync(
      `CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_by INTEGER NOT NULL,
        ended_by INTEGER,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
        total_sales INTEGER DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        total_items_sold INTEGER DEFAULT 0,
        payment_breakdown TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(started_by) REFERENCES users(id),
        FOREIGN KEY(ended_by) REFERENCES users(id)
      )`,
    );

    // Migration: Migrate old shifts table to new schema if needed
    const shiftsOpenedAtCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('shifts') WHERE name='openedAt'",
    );
    if (shiftsOpenedAtCheck && shiftsOpenedAtCheck.cnt > 0) {
      // Old schema exists - migrate it
      console.log('🔄 Migrating shifts table to new schema...');

      // Rename old table
      try {
        this.runSync('ALTER TABLE shifts RENAME TO shifts_old');

        // Create new table
        this.runSync(
          `CREATE TABLE shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_by INTEGER NOT NULL,
            ended_by INTEGER,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
            total_sales INTEGER DEFAULT 0,
            total_orders INTEGER DEFAULT 0,
            total_items_sold INTEGER DEFAULT 0,
            payment_breakdown TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(started_by) REFERENCES users(id),
            FOREIGN KEY(ended_by) REFERENCES users(id)
          )`,
        );

        // Copy data from old table (if any)
        try {
          this.runSync(
            `INSERT INTO shifts (id, start_time, end_time, status, created_at)
             SELECT id, openedAt, closedAt, 
                    CASE WHEN closedAt IS NULL THEN 'open' ELSE 'closed' END,
                    COALESCE(openedAt, CURRENT_TIMESTAMP)
             FROM shifts_old`,
          );

          // Drop old table
          this.runSync('DROP TABLE shifts_old');
          console.log('✅ Successfully migrated shifts table');
        } catch (error) {
          console.error('Failed to copy shifts data', error);
        }
      } catch (error) {
        console.error('Failed to rename shifts table', error);
      }
    } else {
      // Check if new columns exist, add them if missing
      const shiftsStartedByCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('shifts') WHERE name='started_by'",
      );
      if (shiftsStartedByCheck && shiftsStartedByCheck.cnt === 0) {
        // Table exists but missing new columns - add them
        console.log('🔄 Adding new columns to shifts table...');

        // Get admin user ID as default
        const userRow = this.getSync('SELECT id FROM users WHERE role = \'admin\' LIMIT 1');
        const defaultUserId = userRow?.id || 1;

        // Add new columns one by one
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN started_by INTEGER');
        } catch (error) {
          console.error('[DB] Failed to add started_by', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN ended_by INTEGER');
        } catch (error) {
          console.error('[DB] Failed to add ended_by', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN start_time DATETIME');
        } catch (error) {
          console.error('[DB] Failed to add start_time', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN end_time DATETIME');
        } catch (error) {
          console.error('[DB] Failed to add end_time', error);
        }
        try {
          this.runSync("ALTER TABLE shifts ADD COLUMN status TEXT DEFAULT 'open'");
        } catch (error) {
          console.error('[DB] Failed to add status', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN total_sales INTEGER DEFAULT 0');
        } catch (error) {
          console.error('[DB] Failed to add total_sales', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN total_orders INTEGER DEFAULT 0');
        } catch (error) {
          console.error('[DB] Failed to add total_orders', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN total_items_sold INTEGER DEFAULT 0');
        } catch (error) {
          console.error('[DB] Failed to add total_items_sold', error);
        }
        try {
          this.runSync('ALTER TABLE shifts ADD COLUMN payment_breakdown TEXT');
        } catch (error) {
          console.error('[DB] Failed to add payment_breakdown', error);
        }

        // Migrate existing data
        try {
          this.runSync(
            `UPDATE shifts 
             SET started_by = ?, 
                 start_time = COALESCE(openedAt, CURRENT_TIMESTAMP),
                 end_time = closedAt,
                 status = CASE WHEN closedAt IS NULL THEN 'open' ELSE 'closed' END
             WHERE started_by IS NULL`,
            [defaultUserId],
          );
          console.log('✅ Successfully added new columns to shifts table');
        } catch (error) {
          console.error('Failed to update existing shifts', error);
        }
      }
    }

    this.runSync(
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      )`,
    );

    // Printer settings table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS printer_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kitchen_id INTEGER,
        printer_ip TEXT,
        printer_port INTEGER DEFAULT 9100,
        printer_name TEXT,
        connection_type TEXT NOT NULL DEFAULT 'network',
        printer_type TEXT NOT NULL CHECK(printer_type IN ('kitchen', 'customer')),
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(kitchen_id) REFERENCES kitchens(id) ON DELETE CASCADE
      )`,
    );

    // Migration: Add printer_ip and printer_port columns if they don't exist
    const printerIpCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_ip'",
    );
    if (printerIpCheck && printerIpCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE printer_settings ADD COLUMN printer_ip TEXT');
        console.log('[DB] ✅ Added printer_ip column to printer_settings table');
      } catch (error) {
        console.error('[DB] Failed to add printer_ip to printer_settings', error);
      }
    }

    const printerPortCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_port'",
    );
    if (printerPortCheck && printerPortCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE printer_settings ADD COLUMN printer_port INTEGER DEFAULT 9100');
        console.log('[DB] ✅ Added printer_port column to printer_settings table');
      } catch (error) {
        console.error('[DB] Failed to add printer_port to printer_settings', error);
      }
    }

    // Migration: connection_type (network | windows_spooler)
    const connectionTypeCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='connection_type'",
    );
    if (connectionTypeCheck && connectionTypeCheck.cnt === 0) {
      try {
        this.runSync(
          "ALTER TABLE printer_settings ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'network'",
        );
        console.log('[DB] ✅ Added connection_type column to printer_settings table');
      } catch (error) {
        console.error('[DB] Failed to add connection_type to printer_settings', error);
      }
    }

    // Migration: printer_name (Windows Spooler queue name)
    const printerNameCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_name'",
    );
    if (printerNameCheck && printerNameCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE printer_settings ADD COLUMN printer_name TEXT');
        console.log('[DB] ✅ Added printer_name column to printer_settings table');
      } catch (error) {
        console.error('[DB] Failed to add printer_name to printer_settings', error);
      }
    }

    // Finance tables
    this.runSync(
      `CREATE TABLE IF NOT EXISTS revenues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly', 'yearly', 'extra')),
        amount INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    const revenuesOrderCountCol = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('revenues') WHERE name='order_count'",
    );
    if (revenuesOrderCountCol && revenuesOrderCountCol.cnt === 0) {
      this.runSync('ALTER TABLE revenues ADD COLUMN order_count INTEGER');
    }

    // Create expenses table with correct schema
    this.runSync(
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        notes TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Migration: Check if expenses table has old schema and migrate it
    const expensesDateCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='date'",
    );
    if (expensesDateCheck && expensesDateCheck.cnt === 0) {
      // Old schema exists (has description, createdAt instead of date, category, notes, user_id, created_at)
      // Check if it has the old columns
      const expensesDescriptionCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='description'",
      );
      if (expensesDescriptionCheck && expensesDescriptionCheck.cnt > 0) {
        // Old schema detected - need to migrate
        console.log('[DB] ⚠️ Detected old expenses table schema. Migrating...');

        // Create new table with temp name
        try {
          this.runSync(
            `CREATE TABLE expenses_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,
              category TEXT NOT NULL,
              amount INTEGER NOT NULL,
              notes TEXT,
              user_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
          );

          // Copy data from old to new (use createdAt as date, description as category)
          this.runSync(
            `INSERT INTO expenses_new (id, date, category, amount, notes, user_id, created_at)
             SELECT id, 
                    COALESCE(createdAt, CURRENT_TIMESTAMP) as date,
                    COALESCE(description, 'Uncategorized') as category,
                    amount,
                    NULL as notes,
                    NULL as user_id,
                    COALESCE(createdAt, CURRENT_TIMESTAMP) as created_at
             FROM expenses`,
          );

          // Drop old table and rename new one
          this.runSync('DROP TABLE expenses');
          this.runSync('ALTER TABLE expenses_new RENAME TO expenses');
          console.log('[DB] ✅ Migrated expenses table to new schema');
        } catch (error) {
          console.error('[DB] Failed to migrate expenses table', error);
        }
      }
    } else {
      // New schema already exists, but check if category column exists
      const expensesCategoryCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='category'",
      );
      if (expensesCategoryCheck && expensesCategoryCheck.cnt === 0) {
        // Has date but no category - add missing columns
        try {
          this.runSync('ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT \'Uncategorized\'');
          console.log('[DB] ✅ Added category column to expenses table');
        } catch (error) {
          console.error('[DB] Failed to add category to expenses', error);
        }
      }
    }

    // Migration: Add recurring expense fields
    const expensesRecurringCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='is_recurring'",
    );
    if (expensesRecurringCheck && expensesRecurringCheck.cnt === 0) {
      // Add recurring expense fields
      try {
        this.runSync(`ALTER TABLE expenses ADD COLUMN is_recurring INTEGER DEFAULT 0`);
        console.log('[DB] ✅ Added is_recurring column to expenses table');
      } catch (error) {
        console.error('[DB] Failed to add is_recurring column', error);
      }

      try {
        this.runSync(`ALTER TABLE expenses ADD COLUMN recurrence_type TEXT`);
        console.log('[DB] ✅ Added recurrence_type column to expenses table');
      } catch (error) {
        console.error('[DB] Failed to add recurrence_type column', error);
      }

      try {
        this.runSync(`ALTER TABLE expenses ADD COLUMN recurrence_interval INTEGER DEFAULT 1`);
        console.log('[DB] ✅ Added recurrence_interval column to expenses table');
      } catch (error) {
        console.error('[DB] Failed to add recurrence_interval column', error);
      }

      try {
        this.runSync(`ALTER TABLE expenses ADD COLUMN next_occurrence_date TEXT`);
        console.log('[DB] ✅ Added next_occurrence_date column to expenses table');
      } catch (error) {
        console.error('[DB] Failed to add next_occurrence_date column', error);
      }
    }

    this.runSync(
      `CREATE TABLE IF NOT EXISTS cash_flow (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('in', 'out')),
        reason TEXT NOT NULL,
        amount INTEGER NOT NULL,
        linked_order_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(linked_order_id) REFERENCES orders(id) ON DELETE SET NULL
      )`,
    );

    // Business days table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS business_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_at DATETIME NOT NULL,
        end_at DATETIME,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Users table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Migration: Add require_captain_approval column to users table if it doesn't exist
    const usersRequireCaptainCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='require_captain_approval'",
    );
    if (usersRequireCaptainCheck && usersRequireCaptainCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE users ADD COLUMN require_captain_approval INTEGER DEFAULT 0');
        console.log('[DB] ✅ Added require_captain_approval column to users table');
      } catch (error) {
        console.error('[DB] Failed to add require_captain_approval to users', error);
      }
    }

    // Migration: Add customer_free_order column to users table if it doesn't exist
    const usersCustomerFreeOrderCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='customer_free_order'",
    );
    if (usersCustomerFreeOrderCheck && usersCustomerFreeOrderCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE users ADD COLUMN customer_free_order INTEGER DEFAULT 0');
        console.log('[DB] ✅ Added customer_free_order column to users table');
      } catch (error) {
        console.error('[DB] Failed to add customer_free_order to users', error);
      }
    }

    // Migration: Update users table CHECK constraint to include 'customer' role
    // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
    const usersTableCheck = this.getSync(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'",
    );
    if (usersTableCheck && usersTableCheck.sql && !usersTableCheck.sql.includes("'customer'") && !this.migrationInProgress) {
      this.migrationInProgress = true;
      console.log('[DB] 🔄 Migrating users table to include customer role...');

      // Begin transaction
      try {
        this.runSync('BEGIN TRANSACTION');

        // Create new table with correct constraint
        this.runSync(
          `CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_plain TEXT,
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer')),
            require_captain_approval INTEGER DEFAULT 0,
            customer_free_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
        );

        // Copy all data from old table to new table
        this.runSync(
          `INSERT INTO users_new (id, username, password_hash, password_plain, role, require_captain_approval, customer_free_order, created_at, updated_at)
           SELECT id, username, password_hash, NULL, role, 
                  COALESCE(require_captain_approval, 0) as require_captain_approval,
                  COALESCE(customer_free_order, 0) as customer_free_order,
                  created_at, updated_at
           FROM users`,
        );

        // Drop old table
        this.runSync('DROP TABLE users');

        // Rename new table to users
        this.runSync('ALTER TABLE users_new RENAME TO users');

        // Commit transaction
        this.runSync('COMMIT');
        console.log('[DB] ✅ Successfully migrated users table to include customer role');
        this.migrationInProgress = false;
      } catch (error) {
        console.error('[DB] Failed to migrate users table', error);
        try {
          this.runSync('ROLLBACK');
        } catch (rollbackError) {
          console.error('[DB] Failed to rollback transaction', rollbackError);
        }
        this.migrationInProgress = false;
      }
    }

    // Migration: store plain login code for admin display (login still uses password_hash)
    const usersPasswordPlainCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='password_plain'",
    );
    if (usersPasswordPlainCheck && usersPasswordPlainCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE users ADD COLUMN password_plain TEXT');
        console.log('[DB] ✅ Added password_plain column to users table');
      } catch (error) {
        console.error('[DB] Failed to add password_plain to users', error);
      }
    }

    // Seed default admin user if users table is empty
    const usersCount = this.getSync('SELECT COUNT(*) as count FROM users');
    if (usersCount && usersCount.count === 0) {
      // Hash default password 'admin123'
      const defaultPasswordHash = bcrypt.hashSync('admin123', 10);

      try {
        this.runSync(
          'INSERT INTO users (username, password_hash, password_plain, role, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          ['admin', defaultPasswordHash, 'admin123', 'admin'],
        );
        console.log('[DB] ✅ Seeded default admin user (username: admin, password: admin123)');
      } catch (error) {
        console.error('[DB] Failed to seed default admin user', error);
      }
    }

    // Backfill default admin code when still using factory password and plain is missing
    try {
      const adminRow = this.getSync(
        "SELECT id, password_hash, password_plain FROM users WHERE username = 'admin' AND role = 'admin' LIMIT 1",
      );
      if (adminRow && !adminRow.password_plain && adminRow.password_hash) {
        if (bcrypt.compareSync('admin123', String(adminRow.password_hash))) {
          this.runSync('UPDATE users SET password_plain = ? WHERE id = ?', [
            'admin123',
            adminRow.id,
          ]);
          console.log('[DB] ✅ Backfilled password_plain for default admin');
        }
      }
    } catch (error) {
      console.error('[DB] Failed to backfill admin password_plain', error);
    }

    // Seed active business day if none exists
    const businessDaysCount = this.getSync('SELECT COUNT(*) as count FROM business_days WHERE is_active = 1');
    if (businessDaysCount && businessDaysCount.count === 0) {
      try {
        this.runSync('INSERT INTO business_days (start_at, is_active) VALUES (CURRENT_TIMESTAMP, 1)');
        console.log('[DB] ✅ Seeded initial business day');
      } catch (error) {
        console.error('[DB] Failed to seed business day', error);
      }
    }

    // Offers tables
    // Daily deals table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS daily_deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        special_price INTEGER NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
      )`,
    );

    const dailyDealsIsActiveCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('daily_deals') WHERE name='is_active'",
    );
    if (dailyDealsIsActiveCheck && dailyDealsIsActiveCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE daily_deals ADD COLUMN is_active INTEGER DEFAULT 1');
        this.runSync('UPDATE daily_deals SET is_active = 1 WHERE is_active IS NULL');
        console.log('[DB] ✅ Added is_active column to daily_deals');
      } catch (error) {
        console.error('[DB] Failed to add is_active to daily_deals', error);
      }
    }

    // Combos table - stores combo offer configuration
    this.runSync(
      `CREATE TABLE IF NOT EXISTS combos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        combo_name TEXT NOT NULL,
        combo_price INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Combo items - links products to combos
    this.runSync(
      `CREATE TABLE IF NOT EXISTS combo_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        combo_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        FOREIGN KEY(combo_id) REFERENCES combos(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
      )`,
    );

    // Scheduled offers table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS scheduled_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        combo_id INTEGER,
        special_price INTEGER NOT NULL,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY(combo_id) REFERENCES combos(id) ON DELETE CASCADE,
        CHECK((product_id IS NOT NULL AND combo_id IS NULL) OR (product_id IS NULL AND combo_id IS NOT NULL))
      )`,
    );

    // Featured items table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS featured_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL UNIQUE,
        featured INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
      )`,
    );

    // Happy hour table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS happy_hour (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        happy_hour_price INTEGER NOT NULL,
        time_start TEXT NOT NULL,
        time_end TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
      )`,
    );

    const happyHourWeekdaysCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('happy_hour') WHERE name='weekdays'",
    );
    if (happyHourWeekdaysCheck && happyHourWeekdaysCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE happy_hour ADD COLUMN weekdays TEXT');
        console.log('[DB] ✅ Added weekdays column to happy_hour');
      } catch (error) {
        console.error('[DB] Failed to add weekdays to happy_hour', error);
      }
    }

    const combosWeekdaysCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('combos') WHERE name='weekdays'",
    );
    if (combosWeekdaysCheck && combosWeekdaysCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE combos ADD COLUMN weekdays TEXT');
        console.log('[DB] ✅ Added weekdays column to combos');
      } catch (error) {
        console.error('[DB] Failed to add weekdays to combos', error);
      }
    }

    // Seed basic categories/items if empty
    const categoriesCount = this.getSync('SELECT COUNT(*) as count FROM categories');
    if (categoriesCount && categoriesCount.count === 0) {
      const baseCategories = ['مشويات', 'مقبلات', 'مشروبات'];
      for (const name of baseCategories) {
        this.runSync('INSERT INTO categories (name) VALUES (?)', [name]);
      }

      this.runSync('INSERT INTO items (name, price, categoryId) VALUES (?, ?, ?)', ['كباب', 5000, 1]);
      this.runSync('INSERT INTO items (name, price, categoryId) VALUES (?, ?, ?)', ['تبولة', 3000, 2]);
      this.runSync('INSERT INTO items (name, price, categoryId) VALUES (?, ?, ?)', ['بيبسي', 1000, 3]);
    }

    // Domain separation tables (Option 3)
    // Create table_sessions table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS table_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        hall_id INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
      )`,
    );

    // Create dine_in_orders table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS dine_in_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        hall_id INTEGER NOT NULL,
        table_session_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER NOT NULL DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE,
        FOREIGN KEY(table_session_id) REFERENCES table_sessions(id) ON DELETE CASCADE
      )`,
    );

    // Create pickup_orders table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS pickup_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL DEFAULT 'pending',
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER NOT NULL DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Migration: Add customer_name and customer_phone to pickup_orders if they don't exist
    const pickupCustomerNameCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('pickup_orders') WHERE name='customer_name'",
    );
    if (pickupCustomerNameCheck && pickupCustomerNameCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE pickup_orders ADD COLUMN customer_name TEXT');
        this.runSync('ALTER TABLE pickup_orders ADD COLUMN customer_phone TEXT');
        console.log('[DB] ✅ Added customer_name and customer_phone columns to pickup_orders table');
      } catch (error) {
        console.error('[DB] Failed to add customer columns to pickup_orders', error);
      }
    }

    // Create delivery_orders table
    this.runSync(
      `CREATE TABLE IF NOT EXISTS delivery_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER NOT NULL DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Migration: created_by_user_id — المستخدم الذي سجّل الطلب (لتقارير أداء الموظفين)
    const dineCreatedBy = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('dine_in_orders') WHERE name='created_by_user_id'",
    );
    if (dineCreatedBy && dineCreatedBy.cnt === 0) {
      try {
        this.runSync('ALTER TABLE dine_in_orders ADD COLUMN created_by_user_id INTEGER');
        console.log('[DB] ✅ Added created_by_user_id to dine_in_orders');
      } catch (error) {
        console.error('[DB] Failed to add created_by_user_id to dine_in_orders', error);
      }
    }
    const pickupCreatedBy = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('pickup_orders') WHERE name='created_by_user_id'",
    );
    if (pickupCreatedBy && pickupCreatedBy.cnt === 0) {
      try {
        this.runSync('ALTER TABLE pickup_orders ADD COLUMN created_by_user_id INTEGER');
        console.log('[DB] ✅ Added created_by_user_id to pickup_orders');
      } catch (error) {
        console.error('[DB] Failed to add created_by_user_id to pickup_orders', error);
      }
    }
    const deliveryCreatedBy = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('delivery_orders') WHERE name='created_by_user_id'",
    );
    if (deliveryCreatedBy && deliveryCreatedBy.cnt === 0) {
      try {
        this.runSync('ALTER TABLE delivery_orders ADD COLUMN created_by_user_id INTEGER');
        console.log('[DB] ✅ Added created_by_user_id to delivery_orders');
      } catch (error) {
        console.error('[DB] Failed to add created_by_user_id to delivery_orders', error);
      }
    }

    // Delivery aggregator platforms (Talabat, Toters, …) — commission % for delivery orders only
    this.runSync(
      `CREATE TABLE IF NOT EXISTS delivery_platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        commission_percent REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    const deliveryPlatformCols = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('delivery_orders') WHERE name='delivery_platform_id'",
    );
    if (deliveryPlatformCols && deliveryPlatformCols.cnt === 0) {
      try {
        this.runSync('ALTER TABLE delivery_orders ADD COLUMN delivery_platform_id INTEGER');
        this.runSync('ALTER TABLE delivery_orders ADD COLUMN delivery_platform_name TEXT');
        this.runSync('ALTER TABLE delivery_orders ADD COLUMN delivery_platform_commission_percent REAL');
        console.log('[DB] ✅ Added delivery platform columns to delivery_orders');
      } catch (error) {
        console.error('[DB] Failed to add delivery platform columns to delivery_orders', error);
      }
    }

    // Create indexes for performance
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_table ON dine_in_orders(table_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_hall ON dine_in_orders(hall_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_session ON dine_in_orders(table_session_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status)');

    console.log('[DB] ✅ Domain separation tables created (dine_in_orders, pickup_orders, delivery_orders, table_sessions)');

    // Migration: Migrate existing orders from orders table to domain tables
    try {
      const ordersTableExists = this.getSync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
      );
      
      if (ordersTableExists) {
        const existingOrdersCount = this.getSync('SELECT COUNT(*) as count FROM orders');
        const migratedFlag = this.getSync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_domain_migration_complete'"
        );

        if (existingOrdersCount && existingOrdersCount.count > 0 && !migratedFlag) {
          console.log('[DB] 🔄 Starting migration of existing orders to domain tables...');
          
          // Get all existing orders
          const oldOrders = this.allSync('SELECT * FROM orders ORDER BY id');
          
          for (const order of oldOrders) {
            try {
              // Determine order type
              let orderType = order.order_type;
              if (!orderType) {
                // Try to detect from table name (legacy support)
                if (order.table_id) {
                  const table = this.getSync('SELECT name FROM tables WHERE id = ?', [order.table_id]);
                  if (table && (table.name === 'سفري' || table.name === 'توصيل')) {
                    orderType = table.name === 'سفري' ? 'pickup' : 'delivery';
                  } else {
                    orderType = 'dine-in';
                  }
                } else {
                  // No table_id means it's pickup or delivery
                  if (order.customer_name || order.customer_phone || order.customer_location) {
                    orderType = 'delivery';
                  } else {
                    orderType = 'pickup';
                  }
                }
              }

              let newOrderId: number;

              if (orderType === 'dine-in' && order.table_id) {
                // Migrate to dine_in_orders
                // First, get or create table session
                const table = this.getSync('SELECT hall_id FROM tables WHERE id = ?', [order.table_id]);
                if (!table) {
                  console.warn(`[DB] ⚠️  Skipping order ${order.id}: table ${order.table_id} not found`);
                  continue;
                }

                let session = this.getSync(
                  'SELECT id FROM table_sessions WHERE table_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1',
                  [order.table_id, 'active']
                );

                if (!session) {
                  const now = new Date().toISOString();
                  this.runSync(
                    'INSERT INTO table_sessions (table_id, hall_id, started_at, status, created_at) VALUES (?, ?, ?, ?, ?)',
                    [order.table_id, table.hall_id, now, 'active', now]
                  );
                  session = this.getSync(
                    'SELECT id FROM table_sessions WHERE table_id = ? ORDER BY id DESC LIMIT 1',
                    [order.table_id]
                  );
                }

                if (!session || !session.id) {
                  console.warn(`[DB] ⚠️  Skipping order ${order.id}: failed to create table session`);
                  continue;
                }

                this.runSync(
                  `INSERT INTO dine_in_orders (id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    order.id,
                    order.table_id,
                    table.hall_id,
                    session.id,
                    order.status || 'pending',
                    order.total || 0,
                    order.discount || 0,
                    order.globalDiscount || null,
                    order.note || null,
                    order.created_at || new Date().toISOString(),
                    order.updated_at || new Date().toISOString(),
                  ]
                );
                newOrderId = order.id;

              } else if (orderType === 'pickup') {
                // Migrate to pickup_orders
                this.runSync(
                  `INSERT INTO pickup_orders (id, status, total, discount, globalDiscount, note, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    order.id,
                    order.status || 'pending',
                    order.total || 0,
                    order.discount || 0,
                    order.globalDiscount || null,
                    order.note || null,
                    order.created_at || new Date().toISOString(),
                    order.updated_at || new Date().toISOString(),
                  ]
                );
                newOrderId = order.id;

              } else if (orderType === 'delivery') {
                // Migrate to delivery_orders
                this.runSync(
                  `INSERT INTO delivery_orders (id, customer_name, customer_phone, customer_address, status, total, discount, globalDiscount, note, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    order.id,
                    order.customer_name || 'Unknown',
                    order.customer_phone || '',
                    order.customer_location || order.customer_address || '',
                    order.status || 'pending',
                    order.total || 0,
                    order.discount || 0,
                    order.globalDiscount || null,
                    order.note || null,
                    order.created_at || new Date().toISOString(),
                    order.updated_at || new Date().toISOString(),
                  ]
                );
                newOrderId = order.id;
              } else {
                console.warn(`[DB] ⚠️  Skipping order ${order.id}: unknown order type`);
                continue;
              }

              // Order items already exist in order_items table, no migration needed

            } catch (error: any) {
              console.error(`[DB] ⚠️  Failed to migrate order ${order.id}:`, error.message);
              continue;
            }
          }

          // Mark migration as complete
          this.runSync(
            'CREATE TABLE IF NOT EXISTS _domain_migration_complete (id INTEGER PRIMARY KEY, migrated_at TEXT DEFAULT CURRENT_TIMESTAMP)'
          );
          this.runSync('INSERT INTO _domain_migration_complete (id) VALUES (1)');
          
          console.log(`[DB] ✅ Migrated ${oldOrders.length} orders to domain tables`);
        }
      }
    } catch (error: any) {
      console.error('[DB] ⚠️  Error during order migration:', error.message);
      // Don't throw - allow app to continue even if migration fails
    }

    this.migrateAppSettingsAndBusinessDate();
  }

  /** App settings (shift hours) + business_date on order tables. */
  private migrateAppSettingsAndBusinessDate(): void {
    this.runSync(
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    );

    this.runSync(
      `CREATE TABLE IF NOT EXISTS shift_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
    );

    const seedSetting = (key: string, value: string) => {
      const exists = this.getSync('SELECT 1 FROM app_settings WHERE key = ?', [key]);
      if (!exists) {
        this.runSync('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
      }
    };
    seedSetting('shift_mode', 'single');
    seedSetting('business_day_start_time', DEFAULT_BUSINESS_DAY_START);
    seedSetting('shift_start_time', DEFAULT_SHIFT_START);
    seedSetting('shift_end_time', DEFAULT_SHIFT_END);

    const legacyStart = this.getSync("SELECT value FROM app_settings WHERE key = 'shift_start_time'");
    const businessStart = this.getSync(
      "SELECT value FROM app_settings WHERE key = 'business_day_start_time'",
    );
    if (legacyStart?.value && !businessStart?.value) {
      this.runSync(
        `INSERT INTO app_settings (key, value) VALUES ('business_day_start_time', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [legacyStart.value],
      );
    }

    const orderTables = ['dine_in_orders', 'pickup_orders', 'delivery_orders'] as const;
    for (const table of orderTables) {
      const col = this.getSync(
        `SELECT COUNT(*) as cnt FROM pragma_table_info('${table}') WHERE name='business_date'`,
      );
      if (col && col.cnt === 0) {
        try {
          this.runSync(`ALTER TABLE ${table} ADD COLUMN business_date TEXT`);
          this.runSync(
            `CREATE INDEX IF NOT EXISTS idx_${table}_business_date ON ${table}(business_date)`,
          );
          console.log(`[DB] ✅ Added business_date to ${table}`);
        } catch (error) {
          console.error(`[DB] Failed to add business_date to ${table}`, error);
        }
      }

      const shiftCol = this.getSync(
        `SELECT COUNT(*) as cnt FROM pragma_table_info('${table}') WHERE name='shift_definition_id'`,
      );
      if (shiftCol && shiftCol.cnt === 0) {
        try {
          this.runSync(`ALTER TABLE ${table} ADD COLUMN shift_definition_id INTEGER`);
          this.runSync(
            `CREATE INDEX IF NOT EXISTS idx_${table}_shift_def ON ${table}(shift_definition_id)`,
          );
          console.log(`[DB] ✅ Added shift_definition_id to ${table}`);
        } catch (error) {
          console.error(`[DB] Failed to add shift_definition_id to ${table}`, error);
        }
      }
    }

    const shelfCol = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('shelf_sales') WHERE name='business_date'",
    );
    if (shelfCol && shelfCol.cnt === 0) {
      try {
        this.runSync('ALTER TABLE shelf_sales ADD COLUMN business_date TEXT');
        this.runSync(
          'CREATE INDEX IF NOT EXISTS idx_shelf_sales_business_date ON shelf_sales(business_date)',
        );
        console.log('[DB] ✅ Added business_date to shelf_sales');
      } catch (error) {
        console.error('[DB] Failed to add business_date to shelf_sales', error);
      }
    }

    const modeRow = this.getSync("SELECT value FROM app_settings WHERE key = 'shift_mode'");
    const mode = modeRow?.value === 'multi' ? 'multi' : 'single';
    const dayStartRow = this.getSync(
      "SELECT value FROM app_settings WHERE key = 'business_day_start_time'",
    );
    const dayStart = dayStartRow?.value || DEFAULT_BUSINESS_DAY_START;

    const definitionRows = (this.allSync(
      'SELECT id, name, start_time, end_time FROM shift_definitions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC',
    ) || []) as Array<{ id: number; name: string; start_time: string; end_time: string }>;

    const backfillOrderTable = (table: string) => {
      const nullFilter =
        mode === 'multi'
          ? `business_date IS NULL OR business_date = '' OR shift_definition_id IS NULL`
          : `business_date IS NULL OR business_date = ''`;
      const rows = this.allSync(`SELECT id, created_at FROM ${table} WHERE ${nullFilter}`);
      if (!rows?.length) return;
      const stmt = this.db.prepare(
        `UPDATE ${table} SET business_date = ?, shift_definition_id = ? WHERE id = ?`,
      );
      let updated = 0;
      for (const row of rows) {
        if (!row.created_at) continue;
        const resolved = resolveOrderShift(
          String(row.created_at),
          mode as 'single' | 'multi',
          dayStart,
          definitionRows,
        );
        stmt.run(resolved.business_date, resolved.shift_definition_id, row.id);
        updated++;
      }
      if (updated > 0) {
        console.log(`[DB] ✅ Backfilled business_date on ${updated} rows in ${table}`);
      }
    };

    for (const table of orderTables) {
      backfillOrderTable(table);
    }

    const shelfRows = this.allSync('SELECT id, created_at FROM shelf_sales');
    if (shelfRows?.length) {
      const stmt = this.db.prepare('UPDATE shelf_sales SET business_date = ? WHERE id = ?');
      for (const row of shelfRows) {
        if (row.created_at) {
          stmt.run(computeBusinessDate(String(row.created_at), dayStart), row.id);
        }
      }
    }
  }
}
