/**
 * Sufra Backend Core - Embedded Backend Library
 * 
 * This replaces the NestJS server with a direct library import.
 * No HTTP server, no ports, just pure business logic.
 */

import { DatabaseService } from './database/database.service';
import { AuthService, UsersService } from './services/auth';
import { CategoriesService, ItemsService } from './services/catalog';
import { FloorsService, HallsService, TablesService, KitchensService } from './services/halls';
import { OrdersService } from './services/orders';
import { ShelvesService } from './services/shelves';
import { OffersService } from './services/offers';
import { FinanceService } from './services/finance';
import { ReportsService } from './services/reports';
import { PrintersService } from './services/printers';
import { ShiftsService, BusinessDayService } from './services/shared';

export class SufraBackendCore {
  // Database
  public db: DatabaseService;
  
  // Services (public for IPC access)
  public auth: AuthService;
  public users: UsersService;
  public orders: OrdersService;
  public items: ItemsService;
  public categories: CategoriesService;
  public finance: FinanceService;
  public reports: ReportsService;
  public printers: PrintersService;
  public shelves: ShelvesService;
  public shifts: ShiftsService;
  public kitchens: KitchensService;
  public tables: TablesService;
  public halls: HallsService;
  public floors: FloorsService;
  public offers: OffersService;
  public businessDay: BusinessDayService;
  
  private constructor() {
    // Private constructor - use static create() instead
    this.db = null as any;
    this.auth = null as any;
    this.users = null as any;
    this.orders = null as any;
    this.items = null as any;
    this.categories = null as any;
    this.finance = null as any;
    this.reports = null as any;
    this.printers = null as any;
    this.shelves = null as any;
    this.shifts = null as any;
    this.kitchens = null as any;
    this.tables = null as any;
    this.halls = null as any;
    this.floors = null as any;
    this.offers = null as any;
    this.businessDay = null as any;
  }
  
  /**
   * Initialize backend core (replaces NestFactory.create)
   * 
   * @param userDataPath - Path to user data directory (from Electron)
   * @returns Initialized backend core instance
   */
  static async create(userDataPath?: string): Promise<SufraBackendCore> {
    console.log('[CORE] Initializing Sufra Backend Core...');
    
    // Set user data path env var if provided
    if (userDataPath) {
      process.env.ELECTRON_USER_DATA = userDataPath;
    }
    
    const core = new SufraBackendCore();
    
    try {
      // 1. Initialize database first
      console.log('[CORE] Initializing database...');
      core.db = new DatabaseService();
      await core.db.initialize();
      console.log('[CORE] ✓ Database initialized');
      
      // 2. Initialize services with manual dependency injection
      console.log('[CORE] Initializing services...');
      
      // Basic services (no dependencies)
      core.categories = new CategoriesService(core.db);
      core.items = new ItemsService(core.db);
      core.floors = new FloorsService(core.db);
      core.halls = new HallsService(core.db);
      core.kitchens = new KitchensService(core.db);
      core.printers = new PrintersService(core.db);
      core.shelves = new ShelvesService(core.db);
      core.shifts = new ShiftsService(core.db);
      core.offers = new OffersService(core.db);
      core.businessDay = new BusinessDayService(core.db);
      core.finance = new FinanceService(core.db);
      core.reports = new ReportsService(core.db, core.businessDay);
      
      // User management
      core.users = new UsersService(core.db);
      core.auth = new AuthService(core.users);
      
      // Tables service (depends on users)
      core.tables = new TablesService(core.db, core.users);
      
      // Orders service (depends on shelves and tables)
      core.orders = new OrdersService(core.db, core.shelves, core.tables);
      
      console.log('[CORE] ✓ All services initialized');
      console.log('[CORE] ✅ Backend core ready!');
      
      return core;
    } catch (error: any) {
      console.error('[CORE] ✗ Failed to initialize backend core:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown core (cleanup)
   */
  async shutdown(): Promise<void> {
    console.log('[CORE] Shutting down backend core...');
    
    if (this.db) {
      await this.db.close();
    }
    
    console.log('[CORE] ✓ Backend core shut down');
  }
  
  /**
   * Check if core is ready
   */
  isReady(): boolean {
    return this.db && this.db.isReady();
  }
}

// Export types for external use
export * from './types';
export * from './utils/exceptions';

