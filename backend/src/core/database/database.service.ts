// @ts-ignore - sql.js doesn't have types
import initSqlJs from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { getAppDataPath, ensureDirectoryExists } from '../utils/app-data-path';
import { initAllSchemas } from '../../database/schema';

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

export class DatabaseService {
  private db!: SqlJsDatabase;
  private migrationInProgress = false;
  private dbPath!: string;
  private SQL!: any;
  
  // Async initialization tracking
  private initPromise!: Promise<void>;
  private isInitialized = false;
  private initError: Error | null = null;

  /**
   * Initialize the database service
   * Call this method instead of NestJS onModuleInit
   */
  async initialize() {
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

    // Use Electron's userData directory in production, or local data in dev
    const dataDir = getAppDataPath();
    ensureDirectoryExists(dataDir);
    console.log('[DB] Data directory:', dataDir);

    this.dbPath = process.env.DB_PATH || getAppDataPath('sufra.sqlite');
    console.log('[DB] Database path:', this.dbPath);

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      console.log('[DB] Loading existing database...');
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(new Uint8Array(buffer));
      console.log(`[DB] ✓ Loaded existing database (${(buffer.length / 1024).toFixed(2)} KB)`);
    } else {
      console.log('[DB] Creating new database...');
      this.db = new this.SQL.Database();
      console.log('[DB] ✓ Created new database');
    }

    console.log('[DB] Initializing schema and seeding data...');
    this.initializeSchemaAndSeed();
    await this.saveDatabase();
    
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

  /**
   * Close the database connection
   * Call this method instead of NestJS onModuleDestroy
   */
  async close() {
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
        // Use the same database connection to ensure we get the correct ID
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        idStmt.step();
        const result = idStmt.getAsObject();
        lastInsertRowId = Number(result.id) || 0;
        console.log('[DB] runAndGetId: Got ID from last_insert_rowid():', lastInsertRowId);
        idStmt.free();
        stmt.free();
      } else {
        this.db.run(sql);
        // Get last_insert_rowid() immediately after the INSERT
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        idStmt.step();
        const result = idStmt.getAsObject();
        lastInsertRowId = Number(result.id) || 0;
        console.log('[DB] runAndGetId: Got ID from last_insert_rowid():', lastInsertRowId);
        idStmt.free();
      }
      // Auto-save after modifications (but ID is already retrieved)
      await this.saveDatabase();
      console.log('[DB] runAndGetId: Returning ID:', lastInsertRowId);
      return lastInsertRowId;
    } catch (error) {
      console.error('[DB] RunAndGetId error:', error);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
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

  private initializeSchemaAndSeed() {
    // Initialize all schemas using the extracted schema modules
    initAllSchemas({
      runSync: (sql: string, params?: any[]) => this.runSync(sql, params),
      getSync: (sql: string, params?: any[]) => this.getSync(sql, params),
      allSync: (sql: string, params?: any[]) => this.allSync(sql, params),
      run: (sql: string, params?: any[]) => this.run(sql, params),
      db: this.db,
      migrationInProgress: { value: this.migrationInProgress },
    });
  }
}
