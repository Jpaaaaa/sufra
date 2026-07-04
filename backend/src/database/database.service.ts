import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// @ts-ignore - sql.js doesn't have types
import initSqlJs from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { getAppDataPath, ensureDirectoryExists } from '../utils/app-data-path';

interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  prepare(sql: string): any;
  exec(sql: string): any;
  export(): Uint8Array;
  close(): void;
}

/**
 * Type definitions for database query results
 */
export interface DatabaseRow {
  [key: string]: any;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: SqlJsDatabase;
  private migrationInProgress = false;
  private dbPath!: string;
  private SQL!: any;
  
  // Async initialization tracking
  private initPromise!: Promise<void>;
  private isInitialized = false;
  private initError: Error | null = null;

  async onModuleInit() {
    console.log('[DB] Starting database initialization...');
    
    // Create initialization promise
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
    // Initialize sql.js
    // Handle both dev mode (node_modules) and production bundled mode
    console.log('[DB] Loading sql.js WASM...');
    console.log('[DB] __dirname:', __dirname);
    console.log('[DB] process.cwd():', process.cwd());
    
    // Try multiple paths for WASM file (dev and production)
    // In bundled mode, sql.js WASM files are in backend/sql.js/dist (same directory as main.js)
    const possibleWasmPaths = [
      // Bundled mode: WASM files in same directory as main.js (most common case)
      path.join(__dirname, 'sql.js/dist'),
      // Alternative bundled path (if structure is different)
      path.join(__dirname, '../sql.js/dist'),
      // Try using the actual file location of this module (for bundled code)
      (() => {
        try {
          // Get the directory of the main.js file (in bundled mode, this is the bundle location)
          const mainModule = require.main;
          if (mainModule && mainModule.filename) {
            const mainDir = path.dirname(mainModule.filename);
            return path.join(mainDir, 'sql.js/dist');
          }
        } catch {
          // Ignore errors
        }
        return null;
      })(),
      // Dev mode: node_modules relative to dist
      path.join(__dirname, '../../node_modules/sql.js/dist'),
      // Try from process.cwd() (working directory)
      path.join(process.cwd(), 'node_modules/sql.js/dist'),
      // Try from require.resolve (if sql.js is available)
      (() => {
        try {
          const sqlJsPath = require.resolve('sql.js/package.json');
          return path.join(path.dirname(sqlJsPath), 'dist');
        } catch {
          return null;
        }
      })(),
    ].filter(Boolean) as string[];
    
    console.log('[DB] Trying WASM paths:', possibleWasmPaths);
    
    let sqlJsInitialized = false;
    for (const wasmPath of possibleWasmPaths) {
      try {
        if (fs.existsSync(wasmPath)) {
          console.log(`[DB] Trying WASM path: ${wasmPath}`);
          this.SQL = await initSqlJs({
            locateFile: (file: string) => {
              const fullPath = path.join(wasmPath, file);
              console.log(`[DB] Locating WASM file: ${file} -> ${fullPath}`);
              return fullPath;
            },
          });
          console.log('[DB] ✓ sql.js WASM loaded from:', wasmPath);
          sqlJsInitialized = true;
          break;
        }
      } catch (error: any) {
        console.warn(`[DB] Failed to load from ${wasmPath}:`, error.message);
        continue;
      }
    }
    
    // Final fallback: try without locateFile (sql.js will try to find it automatically)
    if (!sqlJsInitialized) {
      try {
        console.log('[DB] Trying automatic WASM location (no locateFile)...');
        this.SQL = await initSqlJs();
        console.log('[DB] ✓ sql.js loaded via automatic detection');
        sqlJsInitialized = true;
      } catch (error: any) {
        console.error('[DB] ✗ All sql.js initialization attempts failed');
        console.error('[DB] Error:', error.message);
        console.error('[DB] Stack:', error.stack);
        throw new Error(`Failed to initialize sql.js: ${error.message}. Check that sql.js WASM files are accessible.`);
      }
    }

    // CRITICAL: Always use Electron's userData directory in production
    // Never use __dirname, process.cwd(), or relative paths for database storage
    const dataDir = getAppDataPath();
    ensureDirectoryExists(dataDir);
    console.log('[DB] Data directory:', dataDir);

    // Database path MUST be in userData directory (never use DB_PATH env var that might point to temp location)
    // In production, getAppDataPath() will throw if ELECTRON_USER_DATA is not set correctly
    this.dbPath = getAppDataPath('sufra.sqlite');
    
    // Validate that database path is absolute and not in a temporary location
    if (!path.isAbsolute(this.dbPath)) {
      throw new Error(`Database path must be absolute, but got: ${this.dbPath}`);
    }
    
    // Ensure it's not using __dirname or process.cwd() (these are temporary in production)
    const normalizedDbPath = path.normalize(this.dbPath);
    const normalizedCwd = path.normalize(process.cwd());
    const normalizedDirname = path.normalize(__dirname);
    
    // In production, database should NOT be in process.cwd() or __dirname
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.ELECTRON_IS_DEV === '0' ||
                         (typeof process !== 'undefined' && process.versions && process.versions.electron);
    
    if (isProduction) {
      if (normalizedDbPath.startsWith(normalizedCwd + path.sep) || normalizedDbPath === normalizedCwd) {
        throw new Error(
          `CRITICAL: Database path is in process.cwd() (${normalizedCwd}), which is temporary in production. ` +
          `Database will be lost on restart. Path: ${this.dbPath}. ` +
          'Must use Electron app.getPath("userData") instead.'
        );
      }
      
      if (normalizedDbPath.startsWith(normalizedDirname + path.sep) || normalizedDbPath === normalizedDirname) {
        throw new Error(
          `CRITICAL: Database path is in __dirname (${normalizedDirname}), which is temporary in production. ` +
          `Database will be lost on restart. Path: ${this.dbPath}. ` +
          'Must use Electron app.getPath("userData") instead.'
        );
      }
    }
    
    console.log('[DB] Database path:', this.dbPath);
    console.log('[DB] Database path is absolute:', path.isAbsolute(this.dbPath));
    console.log('[DB] Database directory exists:', fs.existsSync(path.dirname(this.dbPath)));
    
    // Log the expected userData path for verification
    const electronUserData = process.env.ELECTRON_USER_DATA;
    if (electronUserData) {
      console.log('[DB] ✓ Database is stored in Electron userData directory:', electronUserData);
      console.log('[DB] ✓ Full database path:', this.dbPath);
      console.log('[DB] ✓ This path will persist across app restarts');
    } else {
      console.log('[DB] Dev mode: Database is stored in local data directory');
    }

    // Load existing database or create new one
    const isNewDatabase = !fs.existsSync(this.dbPath);
    
    if (isNewDatabase) {
      console.log('[DB] Creating new database...');
      this.db = new this.SQL.Database();
      console.log('[DB] ✓ Created new database');
    } else {
      console.log('[DB] Loading existing database...');
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(new Uint8Array(buffer));
      console.log(`[DB] ✓ Loaded existing database (${(buffer.length / 1024).toFixed(2)} KB)`);
    }

    console.log('[DB] Initializing schema and seeding data...');
    this.initializeSchemaAndSeed();
    
    // Only save to disk if this is a new database
    // Existing databases are already on disk and will be saved via run() method
    if (isNewDatabase) {
      await this.saveDatabase();
      console.log('[DB] ✓ Saved new database to disk');
    }
    
    // Mark as initialized
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
    
    // Wait for initialization to complete
    await this.initPromise;
  }

  /**
   * Check if database is ready (synchronous check)
   */
  isReady(): boolean {
    return this.isInitialized && !this.initError;
  }

  async onModuleDestroy() {
    if (this.db) {
      // Await save to ensure data is persisted before closing
      await this.saveDatabase();
      this.db.close();
    }
  }

  getConnection(): SqlJsDatabase {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call ensureInitialized() first or wait for onModuleInit() to complete.');
    }
    return this.db;
  }

  // Public helper methods for services to use
  // All methods now wait for initialization before executing
  async run(sql: string, params: any[] = []): Promise<void> {
    await this.ensureInitialized();
    
    try {
      if (params.length > 0) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
      } else {
        this.db.run(sql);
      }
      // Auto-save after modifications - await to ensure it completes
      await this.saveDatabase();
    } catch (error) {
      console.error('[DB] Run error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  // Run an INSERT/UPDATE/DELETE and return the last insert row ID
  // This should be used when you need the ID immediately after INSERT
  async runAndGetId(sql: string, params: any[] = []): Promise<number> {
    await this.ensureInitialized();
    
    try {
      let lastInsertRowId = 0;
      if (params.length > 0) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        // Get last_insert_rowid() immediately after the INSERT, before freeing the statement
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        idStmt.step();
        const result = idStmt.getAsObject();
        idStmt.free();
        lastInsertRowId = (result.id as number) || 0;
        stmt.free();
      } else {
        this.db.run(sql);
        // Get last_insert_rowid() immediately after the INSERT
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        idStmt.step();
        const result = idStmt.getAsObject();
        idStmt.free();
        lastInsertRowId = (result.id as number) || 0;
      }
      // Auto-save after modifications
      await this.saveDatabase();
      return lastInsertRowId;
    } catch (error) {
      console.error('[DB] RunAndGetId error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  async get(sql: string, params: any[] = []): Promise<DatabaseRow | null> {
    await this.ensureInitialized();
    
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const hasRow = stmt.step();
      if (!hasRow) {
        stmt.free();
        return null;
      }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
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
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: DatabaseRow[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (error) {
      console.error('[DB] All error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  }

  async getLastInsertRowId(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      // Use a prepared statement to get last_insert_rowid()
      const stmt = this.db.prepare('SELECT last_insert_rowid() as id');
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      const id = result.id as number;
      console.log('[DB] getLastInsertRowId result:', id);
      return id || 0;
    } catch (error) {
      console.error('[DB] getLastInsertRowId error:', error);
      throw error;
    }
  }

  private async saveDatabase(): Promise<void> {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      // Ensure directory exists before writing
      const dbDir = path.dirname(this.dbPath);
      ensureDirectoryExists(dbDir);
      // Use async writeFile with promisify to avoid blocking
      await fs.promises.writeFile(this.dbPath, buffer);
    } catch (error) {
      // Log error but don't throw - in-memory DB has the data, disk save failure is non-critical
      // This prevents 500 errors when disk write fails but DB operation succeeded
      console.error('[DB] Failed to save database to disk (non-critical):', error);
    }
  }

  // Internal sync methods for use during initialization only
  // These don't check initialization because they're called during init
  private runSync(sql: string, params: any[] = []): void {
    try {
      if (params.length > 0) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
      } else {
        this.db.run(sql);
      }
    } catch (error) {
      console.error('[DB] RunSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  }

  private getSync(sql: string, params: any[] = []): DatabaseRow | null {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const hasRow = stmt.step();
      if (!hasRow) {
        stmt.free();
        return null;
      }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    } catch (error) {
      console.error('[DB] GetSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  }

  private allSync(sql: string, params: any[] = []): DatabaseRow[] {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: DatabaseRow[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (error) {
      console.error('[DB] AllSync error:', error);
      console.error('[DB] SQL:', sql);
      throw error;
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
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
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        kitchen_id INTEGER,
        service_type TEXT DEFAULT 'dine-in',
        shelf_item_id INTEGER,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
        FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL
      )`,
    );

    // ====================================================================
    // NEW DOMAIN-SEPARATED ORDER TABLES (OPTION 3: Full Domain Separation)
    // ====================================================================
    
    // Table sessions - tracks when a table is opened for service (dine-in only)
    this.runSync(
      `CREATE TABLE IF NOT EXISTS table_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        hall_id INTEGER NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
      )`,
    );

    // Dine-in orders - requires hall, table, and table session
    this.runSync(
      `CREATE TABLE IF NOT EXISTS dine_in_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        hall_id INTEGER NOT NULL,
        table_session_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'printed', 'completed', 'cancelled')),
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE,
        FOREIGN KEY(table_session_id) REFERENCES table_sessions(id) ON DELETE CASCADE
      )`,
    );

    // Pickup orders - NO hall, NO table, NO session
    // Lifecycle: draft → preparing → ready → completed → archived
    this.runSync(
      `CREATE TABLE IF NOT EXISTS pickup_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'preparing', 'ready', 'completed', 'archived')),
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Delivery orders - NO hall, NO table, NO session, but REQUIRES customer info
    // Lifecycle: draft → preparing → out_for_delivery → delivered → archived
    // Note: customer fields are nullable for draft orders
    this.runSync(
      `CREATE TABLE IF NOT EXISTS delivery_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'preparing', 'out_for_delivery', 'delivered', 'archived')),
        total INTEGER NOT NULL DEFAULT 0,
        discount INTEGER DEFAULT 0,
        globalDiscount TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    // Migration: Update existing pickup_orders status values to new lifecycle
    // 'pending' → 'preparing', 'printed' → 'ready', 'completed' → 'completed', 'cancelled' → 'archived'
    try {
      this.runSync(`UPDATE pickup_orders SET status = 'preparing' WHERE status = 'pending'`);
      this.runSync(`UPDATE pickup_orders SET status = 'ready' WHERE status = 'printed'`);
      this.runSync(`UPDATE pickup_orders SET status = 'archived' WHERE status = 'cancelled'`);
    } catch (e) {
      // Ignore migration errors (table might not exist yet)
    }

    // Migration: Update existing delivery_orders status values to new lifecycle
    try {
      this.runSync(`UPDATE delivery_orders SET status = 'preparing' WHERE status = 'pending'`);
      this.runSync(`UPDATE delivery_orders SET status = 'out_for_delivery' WHERE status = 'printed'`);
      this.runSync(`UPDATE delivery_orders SET status = 'delivered' WHERE status = 'completed'`);
      this.runSync(`UPDATE delivery_orders SET status = 'archived' WHERE status = 'cancelled'`);
    } catch (e) {
      // Ignore migration errors (table might not exist yet)
    }

    // New shared order_items table with domain support
    // This replaces the old order_items table after migration
    this.runSync(
      `CREATE TABLE IF NOT EXISTS order_items_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_domain TEXT NOT NULL CHECK(order_domain IN ('DINE_IN', 'PICKUP', 'DELIVERY')),
        order_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        kitchen_id INTEGER,
        shelf_item_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
        FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL,
        -- Domain-specific foreign keys (enforced at application level)
        -- DINE_IN: order_id references dine_in_orders(id)
        -- PICKUP: order_id references pickup_orders(id)
        -- DELIVERY: order_id references delivery_orders(id)
        CHECK(
          (order_domain = 'DINE_IN' AND order_id > 0) OR
          (order_domain = 'PICKUP' AND order_id > 0) OR
          (order_domain = 'DELIVERY' AND order_id > 0)
        )
      )`,
    );

    // Create indexes for better query performance
    this.runSync('CREATE INDEX IF NOT EXISTS idx_order_items_v2_domain_order ON order_items_v2(order_domain, order_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_table ON dine_in_orders(table_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_session ON dine_in_orders(table_session_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status)');

    // ====================================================================
    // MIGRATION: Move data from old orders table to new domain tables
    // ====================================================================
    this.migrateOrdersToDomainTables();

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
            hall_id INTEGER NOT NULL,
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
      // Table exists - check if hall_id is nullable, if not, migrate it
      const hallIdNullableCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('tables') WHERE name='hall_id' AND \"notnull\"=0",
      );
      if (!hallIdNullableCheck || hallIdNullableCheck.cnt === 0) {
        // hall_id is NOT NULL, need to make it nullable for external orders
        console.log('[DB] 🔄 Making hall_id nullable in tables table for external orders...');
        try {
          // SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
          this.runSync('ALTER TABLE tables RENAME TO tables_migration_temp');
          this.runSync(
            `CREATE TABLE tables (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              number INTEGER NOT NULL,
              name TEXT NOT NULL,
              hall_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
            )`,
          );
          // Check if number column exists in temp table, if not use default value
          let numberCheckRow;
          try {
            numberCheckRow = this.getSync(
              "SELECT COUNT(*) as cnt FROM pragma_table_info('tables_migration_temp') WHERE name='number'",
            );
          } catch (error) {
            numberCheckRow = null;
          }
          const hasNumberColumn = numberCheckRow && numberCheckRow.cnt > 0;
          const insertQuery = hasNumberColumn
            ? `INSERT INTO tables (id, number, name, hall_id, created_at, updated_at)
               SELECT id, number, name, hall_id, created_at, updated_at FROM tables_migration_temp`
            : `INSERT INTO tables (id, number, name, hall_id, created_at, updated_at)
               SELECT id, COALESCE(1, 1) AS number, name, hall_id, created_at, updated_at FROM tables_migration_temp`;
          this.runSync(insertQuery);
          this.runSync('DROP TABLE tables_migration_temp');
          console.log('[DB] ✅ Successfully made hall_id nullable in tables table');
        } catch (error) {
          console.error('[DB] Failed to migrate hall_id to nullable:', error);
          // Try to restore original table
          try {
            this.runSync('DROP TABLE IF EXISTS tables');
            this.runSync('ALTER TABLE tables_migration_temp RENAME TO tables');
          } catch (restoreError) {
            console.error('[DB] Failed to restore tables table:', restoreError);
          }
        }
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
      // Table exists with correct schema, nothing to do
    }

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
                    COALESCE(openedAt, datetime('now'))
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
        const userRow = this.getSync('SELECT id FROM users WHERE role = "admin" LIMIT 1');
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
                 start_time = COALESCE(openedAt, datetime('now')),
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

    // ====================================================================
    // MIGRATION: Add shift_id to order tables for shift-based POS system
    // ====================================================================
    
    // Migration: Add shift_id to dine_in_orders if it doesn't exist
    const dineInShiftIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('dine_in_orders') WHERE name='shift_id'",
    );
    if (dineInShiftIdCheck && dineInShiftIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE dine_in_orders ADD COLUMN shift_id INTEGER REFERENCES shifts(id)');
        console.log('[DB] ✅ Added shift_id column to dine_in_orders table');
      } catch (error) {
        console.error('[DB] Failed to add shift_id to dine_in_orders', error);
      }
    }

    // Migration: Add shift_id to pickup_orders if it doesn't exist
    const pickupShiftIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('pickup_orders') WHERE name='shift_id'",
    );
    if (pickupShiftIdCheck && pickupShiftIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE pickup_orders ADD COLUMN shift_id INTEGER REFERENCES shifts(id)');
        console.log('[DB] ✅ Added shift_id column to pickup_orders table');
      } catch (error) {
        console.error('[DB] Failed to add shift_id to pickup_orders', error);
      }
    }

    // Migration: Add shift_id to delivery_orders if it doesn't exist
    const deliveryShiftIdCheck = this.getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('delivery_orders') WHERE name='shift_id'",
    );
    if (deliveryShiftIdCheck && deliveryShiftIdCheck.cnt === 0) {
      try {
        this.runSync('ALTER TABLE delivery_orders ADD COLUMN shift_id INTEGER REFERENCES shifts(id)');
        console.log('[DB] ✅ Added shift_id column to delivery_orders table');
      } catch (error) {
        console.error('[DB] Failed to add shift_id to delivery_orders', error);
      }
    }

    // Create indexes for shift_id on order tables for better query performance
    this.runSync('CREATE INDEX IF NOT EXISTS idx_dine_in_orders_shift ON dine_in_orders(shift_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_pickup_orders_shift ON pickup_orders(shift_id)');
    this.runSync('CREATE INDEX IF NOT EXISTS idx_delivery_orders_shift ON delivery_orders(shift_id)');

    // ====================================================================
    // MIGRATION: Link existing orders to shifts retroactively
    // This creates shifts for orders that don't have a shift_id yet
    // ====================================================================
    this.migrateOrdersToShifts();

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

    // Migration: Migrate printer_name to printer_ip if printer_name exists but printer_ip is null
    // This allows existing installations to migrate their data
    try {
      const migrateCheck = this.getSync(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_name'",
      );
      if (migrateCheck && migrateCheck.cnt > 0) {
        // Check if there are rows with printer_name but no printer_ip
        const rowsToMigrate = this.allSync(
          "SELECT id, printer_name FROM printer_settings WHERE printer_ip IS NULL AND printer_name IS NOT NULL AND printer_name != ''",
        );
        if (rowsToMigrate && rowsToMigrate.length > 0) {
          console.log(`[MIGRATION] Found ${rowsToMigrate.length} printer settings to migrate from printer_name to printer_ip`);
          // Note: We can't automatically convert printer names to IPs, so we'll leave them null
          // Users will need to reconfigure their printers with IP addresses
        }
      }
    } catch (error) {
      console.error('Failed to check printer_name migration', error);
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
                    COALESCE(createdAt, datetime('now')) as date,
                    COALESCE(description, 'Uncategorized') as category,
                    amount,
                    NULL as notes,
                    NULL as user_id,
                    COALESCE(createdAt, datetime('now')) as created_at
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
          this.runSync('ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT "Uncategorized"');
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
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer')),
            require_captain_approval INTEGER DEFAULT 0,
            customer_free_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
        );

        // Copy all data from old table to new table
        this.runSync(
          `INSERT INTO users_new (id, username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at)
           SELECT id, username, password_hash, role, 
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

    // Seed default admin user if users table is empty
    const usersCount = this.getSync('SELECT COUNT(*) as count FROM users');
    if (usersCount && usersCount.count === 0) {
      // Hash default password 'admin123'
      const defaultPasswordHash = bcrypt.hashSync('admin123', 10);

      try {
        this.runSync(
          'INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
          ['admin', defaultPasswordHash, 'admin'],
        );
        console.log('[DB] ✅ Seeded default admin user (username: admin, password: admin123)');
      } catch (error) {
        console.error('[DB] Failed to seed default admin user', error);
      }
    }

    // Seed active business day if none exists
    const businessDaysCount = this.getSync('SELECT COUNT(*) as count FROM business_days WHERE is_active = 1');
    if (businessDaysCount && businessDaysCount.count === 0) {
      try {
        this.runSync('INSERT INTO business_days (start_at, is_active) VALUES (datetime("now"), 1)');
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

    // Seed basic categories/items if empty
    const categoriesCount = this.getSync('SELECT COUNT(*) as count FROM categories');
    if (categoriesCount && categoriesCount.count === 0) {
      const stmtCat = this.db.prepare('INSERT INTO categories (name) VALUES (?)');
      const baseCategories = ['مشويات', 'مقبلات', 'مشروبات'];
      baseCategories.forEach((name) => {
        stmtCat.bind([name]);
        stmtCat.step();
      });
      stmtCat.free();

      const stmtItem = this.db.prepare('INSERT INTO items (name, price, categoryId) VALUES (?, ?, ?)');
      stmtItem.bind(['كباب', 5000, 1]);
      stmtItem.step();
      stmtItem.reset();
      stmtItem.bind(['تبولة', 3000, 2]);
      stmtItem.step();
      stmtItem.reset();
      stmtItem.bind(['بيبسي', 1000, 3]);
      stmtItem.step();
      stmtItem.free();
    }
  }

  /**
   * Migration: Move orders from old orders table to new domain-separated tables
   * This identifies orders from virtual tables ("سفري", "توصيل") and migrates them
   * to pickup_orders and delivery_orders respectively.
   * Real table orders are migrated to dine_in_orders.
   */
  private migrateOrdersToDomainTables() {
    try {
      // Check if migration has already been run (check if order_items_v2 has any data)
      const v2ItemsCount = this.getSync('SELECT COUNT(*) as count FROM order_items_v2');
      if (v2ItemsCount && v2ItemsCount.count > 0) {
        console.log('[DB] Order domain migration already completed, skipping...');
        return;
      }

      // Check if old orders table has any data to migrate
      const oldOrdersCount = this.getSync('SELECT COUNT(*) as count FROM orders');
      if (!oldOrdersCount || oldOrdersCount.count === 0) {
        console.log('[DB] No orders to migrate, skipping domain migration...');
        return;
      }

      console.log('[DB] 🔄 Starting order domain migration...');
      console.log(`[DB] Found ${oldOrdersCount.count} orders to migrate`);

      // Find virtual hall and tables
      const virtualHall = this.getSync(
        `SELECT id FROM halls WHERE name IN ('طلبات خارجية', 'طلبات سفري / توصيل') LIMIT 1`
      );
      
      if (!virtualHall) {
        console.log('[DB] ⚠️ No virtual hall found, migrating all orders as dine-in orders');
      }

      let safariTableId: number | null = null;
      let deliveryTableId: number | null = null;

      if (virtualHall) {
        const safariTable = this.getSync(
          `SELECT id FROM tables WHERE hall_id = ? AND name = 'سفري'`,
          [virtualHall.id]
        );
        const deliveryTable = this.getSync(
          `SELECT id FROM tables WHERE hall_id = ? AND name = 'توصيل'`,
          [virtualHall.id]
        );
        
        safariTableId = safariTable?.id || null;
        deliveryTableId = deliveryTable?.id || null;
      }

      console.log('[DB] Virtual table IDs:', { safariTableId, deliveryTableId });

      // Get all orders from old table
      const allOrders = this.allSync(
        `SELECT o.*, t.name as table_name, t.hall_id, h.name as hall_name 
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         LEFT JOIN halls h ON t.hall_id = h.id
         ORDER BY o.id`
      );

      let migratedDineIn = 0;
      let migratedPickup = 0;
      let migratedDelivery = 0;
      let skipped = 0;

      for (const order of allOrders) {
        try {
          // Determine order domain based on table name
          const tableName = order.table_name || '';
          const isSafariTable = safariTableId && order.table_id === safariTableId;
          const isDeliveryTable = deliveryTableId && order.table_id === deliveryTableId;
          const isVirtualHall = virtualHall && order.hall_id === virtualHall.id;

          // Get order items
          const orderItems = this.allSync(
            'SELECT * FROM order_items WHERE order_id = ?',
            [order.id]
          );

          if (isSafariTable || (tableName === 'سفري' && isVirtualHall)) {
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
                order.updated_at || new Date().toISOString()
              ]
            );

            // Migrate order items to order_items_v2
            for (const item of orderItems) {
              this.runSync(
                `INSERT INTO order_items_v2 (order_domain, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, created_at)
                 VALUES ('PICKUP', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  order.id,
                  item.item_id,
                  item.item_name,
                  item.quantity,
                  item.price,
                  item.kitchen_id || null,
                  item.shelf_item_id || null,
                  order.created_at || new Date().toISOString()
                ]
              );
            }

            migratedPickup++;
            console.log(`[DB] ✅ Migrated order ${order.id} to pickup_orders`);

          } else if (isDeliveryTable || (tableName === 'توصيل' && isVirtualHall)) {
            // Migrate to delivery_orders (requires customer info)
            if (!order.customer_name || !order.customer_phone || !order.customer_location) {
              console.warn(`[DB] ⚠️ Order ${order.id} is marked as delivery but missing customer info, migrating to pickup instead`);
              // Migrate as pickup if customer info is missing
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
                  order.updated_at || new Date().toISOString()
                ]
              );

              for (const item of orderItems) {
                this.runSync(
                  `INSERT INTO order_items_v2 (order_domain, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, created_at)
                   VALUES ('PICKUP', ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    order.id,
                    item.item_id,
                    item.item_name,
                    item.quantity,
                    item.price,
                    item.kitchen_id || null,
                    item.shelf_item_id || null,
                    order.created_at || new Date().toISOString()
                  ]
                );
              }
              migratedPickup++;
            } else {
              this.runSync(
                `INSERT INTO delivery_orders (id, customer_name, customer_phone, customer_address, status, total, discount, globalDiscount, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  order.id,
                  order.customer_name,
                  order.customer_phone,
                  order.customer_location, // customer_location -> customer_address
                  order.status || 'pending',
                  order.total || 0,
                  order.discount || 0,
                  order.globalDiscount || null,
                  order.note || null,
                  order.created_at || new Date().toISOString(),
                  order.updated_at || new Date().toISOString()
                ]
              );

              // Migrate order items to order_items_v2
              for (const item of orderItems) {
                this.runSync(
                  `INSERT INTO order_items_v2 (order_domain, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, created_at)
                   VALUES ('DELIVERY', ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    order.id,
                    item.item_id,
                    item.item_name,
                    item.quantity,
                    item.price,
                    item.kitchen_id || null,
                    item.shelf_item_id || null,
                    order.created_at || new Date().toISOString()
                  ]
                );
              }

              migratedDelivery++;
              console.log(`[DB] ✅ Migrated order ${order.id} to delivery_orders`);
            }

          } else {
            // Migrate to dine_in_orders (requires table_id, hall_id, and table_session_id)
            if (!order.table_id || !order.hall_id) {
              console.warn(`[DB] ⚠️ Order ${order.id} is missing table_id or hall_id, skipping...`);
              skipped++;
              continue;
            }

            // Find or create an active table session for this table
            let session = this.getSync(
              `SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
              [order.table_id]
            );

            if (!session) {
              // Create a new table session for this order
              const createdAt = order.created_at || new Date().toISOString();
              this.runSync(
                `INSERT INTO table_sessions (table_id, hall_id, started_at, status, created_at)
                 VALUES (?, ?, ?, 'active', ?)`,
                [
                  order.table_id,
                  order.hall_id,
                  createdAt,
                  createdAt
                ]
              );
              // Get the last inserted session ID
              const lastSession = this.getSync(
                `SELECT id FROM table_sessions WHERE table_id = ? ORDER BY id DESC LIMIT 1`,
                [order.table_id]
              );
              if (lastSession && lastSession.id) {
                session = { id: lastSession.id };
              }
            }

            if (!session || !session.id) {
              console.warn(`[DB] ⚠️ Failed to create/find table session for order ${order.id}, skipping...`);
              skipped++;
              continue;
            }

            this.runSync(
              `INSERT INTO dine_in_orders (id, table_id, hall_id, table_session_id, status, total, discount, globalDiscount, note, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                order.id,
                order.table_id,
                order.hall_id,
                session.id,
                order.status || 'pending',
                order.total || 0,
                order.discount || 0,
                order.globalDiscount || null,
                order.note || null,
                order.created_at || new Date().toISOString(),
                order.updated_at || new Date().toISOString()
              ]
            );

            // Migrate order items to order_items_v2
            for (const item of orderItems) {
              this.runSync(
                `INSERT INTO order_items_v2 (order_domain, order_id, item_id, item_name, quantity, price, kitchen_id, shelf_item_id, created_at)
                 VALUES ('DINE_IN', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  order.id,
                  item.item_id,
                  item.item_name,
                  item.quantity,
                  item.price,
                  item.kitchen_id || null,
                  item.shelf_item_id || null,
                  order.created_at || new Date().toISOString()
                ]
              );
            }

            migratedDineIn++;
            console.log(`[DB] ✅ Migrated order ${order.id} to dine_in_orders`);
          }

        } catch (error: any) {
          console.error(`[DB] ✗ Failed to migrate order ${order.id}:`, error);
          skipped++;
        }
      }

      console.log(`[DB] ✅ Order domain migration completed:`);
      console.log(`[DB]   - Dine-in orders: ${migratedDineIn}`);
      console.log(`[DB]   - Pickup orders: ${migratedPickup}`);
      console.log(`[DB]   - Delivery orders: ${migratedDelivery}`);
      console.log(`[DB]   - Skipped: ${skipped}`);

    } catch (error: any) {
      console.error('[DB] ✗ Order domain migration failed:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  /**
   * Migration: Link existing orders to shifts retroactively
   * For orders that don't have a shift_id, this creates shifts based on order dates
   * and links the orders to those shifts.
   */
  private migrateOrdersToShifts() {
    try {
      // Check if there are any orders without shift_id
      const orphanedOrdersCheck = this.getSync(`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM dine_in_orders WHERE shift_id IS NULL
          UNION ALL
          SELECT id FROM pickup_orders WHERE shift_id IS NULL
          UNION ALL
          SELECT id FROM delivery_orders WHERE shift_id IS NULL
        )
      `);

      if (!orphanedOrdersCheck || orphanedOrdersCheck.count === 0) {
        console.log('[DB] ✅ No orphaned orders found - shift migration not needed');
        return;
      }

      console.log(`[DB] 🔄 Found ${orphanedOrdersCheck.count} orders without shift_id - starting migration...`);

      // Get unique dates with orphaned orders
      const uniqueDates = this.allSync(`
        SELECT DISTINCT DATE(created_at) as order_date FROM (
          SELECT created_at FROM dine_in_orders WHERE shift_id IS NULL AND created_at IS NOT NULL
          UNION
          SELECT created_at FROM pickup_orders WHERE shift_id IS NULL AND created_at IS NOT NULL
          UNION
          SELECT created_at FROM delivery_orders WHERE shift_id IS NULL AND created_at IS NOT NULL
        ) ORDER BY order_date ASC
      `);

      if (!uniqueDates || uniqueDates.length === 0) {
        console.log('[DB] ✅ No valid order dates found for shift migration');
        return;
      }

      console.log(`[DB] 🔄 Creating shifts for ${uniqueDates.length} dates...`);

      // Get admin user id for shift creation (fallback to 1)
      const adminUser = this.getSync("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const adminUserId = adminUser?.id || 1;

      let shiftsCreated = 0;
      let ordersUpdated = 0;

      for (const { order_date } of uniqueDates) {
        if (!order_date) continue;

        // Check if a shift already exists for this date
        let existingShift = this.getSync(`
          SELECT id FROM shifts WHERE DATE(start_time) = DATE(?)
        `, [order_date]);

        let shiftId: number;

        if (existingShift && existingShift.id) {
          // Use existing shift
          shiftId = existingShift.id;
          console.log(`[DB]   Using existing shift ${shiftId} for date ${order_date}`);
        } else {
          // Create a new shift for this date (as closed)
          const startTime = `${order_date} 09:00:00`;
          const endTime = `${order_date} 23:59:59`;

          this.runSync(`
            INSERT INTO shifts (started_by, start_time, end_time, status, total_sales, total_orders, created_at)
            VALUES (?, ?, ?, 'closed', 0, 0, ?)
          `, [adminUserId, startTime, endTime, startTime]);

          const newShift = this.getSync('SELECT last_insert_rowid() as id');
          shiftId = newShift?.id;

          if (!shiftId) {
            console.error(`[DB]   Failed to create shift for date ${order_date}`);
            continue;
          }

          shiftsCreated++;
          console.log(`[DB]   Created shift ${shiftId} for date ${order_date}`);
        }

        // Update all orders on this date to use this shift
        const dineInResult = this.runSync(`
          UPDATE dine_in_orders SET shift_id = ? WHERE DATE(created_at) = ? AND shift_id IS NULL
        `, [shiftId, order_date]);

        const pickupResult = this.runSync(`
          UPDATE pickup_orders SET shift_id = ? WHERE DATE(created_at) = ? AND shift_id IS NULL
        `, [shiftId, order_date]);

        const deliveryResult = this.runSync(`
          UPDATE delivery_orders SET shift_id = ? WHERE DATE(created_at) = ? AND shift_id IS NULL
        `, [shiftId, order_date]);

        // Note: runSync returns void; we approximate updated count (sql.js run doesn't expose changes)
        const updated = 0;
        ordersUpdated += updated;

        // Update shift totals for this date
        const totals = this.getSync(`
          SELECT 
            COUNT(*) as order_count,
            COALESCE(SUM(total), 0) as total_sales
          FROM (
            SELECT total FROM dine_in_orders WHERE shift_id = ? AND status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT total FROM pickup_orders WHERE shift_id = ? AND status IN ('pending', 'preparing', 'ready', 'completed')
            UNION ALL
            SELECT total FROM delivery_orders WHERE shift_id = ? AND status IN ('pending', 'preparing', 'out_for_delivery', 'delivered')
          )
        `, [shiftId, shiftId, shiftId]);

        if (totals) {
          this.runSync(`
            UPDATE shifts SET total_sales = ?, total_orders = ? WHERE id = ?
          `, [totals.total_sales || 0, totals.order_count || 0, shiftId]);
        }
      }

      console.log(`[DB] ✅ Shift migration completed:`);
      console.log(`[DB]   - Shifts created: ${shiftsCreated}`);
      console.log(`[DB]   - Orders updated: ${ordersUpdated}`);

    } catch (error: any) {
      console.error('[DB] ✗ Shift migration failed:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }
}
