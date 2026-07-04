"use strict";
/**
 * Sufra Backend Core - Embedded Backend Library
 *
 * This replaces the NestJS server with a direct library import.
 * No HTTP server, no ports, just pure business logic.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SufraBackendCore = void 0;
const database_service_1 = require("./database/database.service");
const auth_service_1 = require("./services/auth.service");
const users_service_1 = require("./services/users.service");
const orders_service_1 = require("./services/orders.service");
const items_service_1 = require("./services/items.service");
const categories_service_1 = require("./services/categories.service");
const finance_service_1 = require("./services/finance.service");
const reports_service_1 = require("./services/reports.service");
const printers_service_1 = require("./services/printers.service");
const shelves_service_1 = require("./services/shelves.service");
const shifts_service_1 = require("./services/shifts.service");
const kitchens_service_1 = require("./services/kitchens.service");
const tables_service_1 = require("./services/tables.service");
const halls_service_1 = require("./services/halls.service");
const floors_service_1 = require("./services/floors.service");
const offers_service_1 = require("./services/offers.service");
const business_day_service_1 = require("./services/business-day.service");
class SufraBackendCore {
    constructor() {
        // Private constructor - use static create() instead
        this.db = null;
        this.auth = null;
        this.users = null;
        this.orders = null;
        this.items = null;
        this.categories = null;
        this.finance = null;
        this.reports = null;
        this.printers = null;
        this.shelves = null;
        this.shifts = null;
        this.kitchens = null;
        this.tables = null;
        this.halls = null;
        this.floors = null;
        this.offers = null;
        this.businessDay = null;
    }
    /**
     * Initialize backend core (replaces NestFactory.create)
     *
     * @param userDataPath - Path to user data directory (from Electron)
     * @returns Initialized backend core instance
     */
    static async create(userDataPath) {
        console.log('[CORE] Initializing Sufra Backend Core...');
        // Set user data path env var if provided
        if (userDataPath) {
            process.env.ELECTRON_USER_DATA = userDataPath;
        }
        const core = new SufraBackendCore();
        try {
            // 1. Initialize database first
            console.log('[CORE] Initializing database...');
            core.db = new database_service_1.DatabaseService();
            await core.db.initialize();
            console.log('[CORE] ✓ Database initialized');
            // 2. Initialize services with manual dependency injection
            console.log('[CORE] Initializing services...');
            // Basic services (no dependencies)
            core.categories = new categories_service_1.CategoriesService(core.db);
            core.items = new items_service_1.ItemsService(core.db);
            core.floors = new floors_service_1.FloorsService(core.db);
            core.halls = new halls_service_1.HallsService(core.db);
            core.kitchens = new kitchens_service_1.KitchensService(core.db);
            core.printers = new printers_service_1.PrintersService(core.db);
            core.shelves = new shelves_service_1.ShelvesService(core.db);
            core.shifts = new shifts_service_1.ShiftsService(core.db);
            core.offers = new offers_service_1.OffersService(core.db);
            core.businessDay = new business_day_service_1.BusinessDayService(core.db);
            core.finance = new finance_service_1.FinanceService(core.db);
            core.reports = new reports_service_1.ReportsService(core.db, core.businessDay);
            // User management
            core.users = new users_service_1.UsersService(core.db);
            core.auth = new auth_service_1.AuthService(core.users);
            // Tables service (depends on users)
            core.tables = new tables_service_1.TablesService(core.db, core.users);
            // Orders service (depends on shelves and tables)
            core.orders = new orders_service_1.OrdersService(core.db, core.shelves, core.tables);
            console.log('[CORE] ✓ All services initialized');
            console.log('[CORE] ✅ Backend core ready!');
            return core;
        }
        catch (error) {
            console.error('[CORE] ✗ Failed to initialize backend core:', error);
            throw error;
        }
    }
    /**
     * Shutdown core (cleanup)
     */
    async shutdown() {
        console.log('[CORE] Shutting down backend core...');
        if (this.db) {
            await this.db.close();
        }
        console.log('[CORE] ✓ Backend core shut down');
    }
    /**
     * Check if core is ready
     */
    isReady() {
        return this.db && this.db.isReady();
    }
}
exports.SufraBackendCore = SufraBackendCore;
// Export types for external use
__exportStar(require("./types"), exports);
__exportStar(require("./utils/exceptions"), exports);
