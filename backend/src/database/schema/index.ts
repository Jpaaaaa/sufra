import { initCoreSchema } from './core';
import { initMenuSchema } from './menu';
import { initOrdersSchema } from './orders';
import { initFinanceSchema } from './finance';
import { initOffersSchema } from './offers';
import { initPrintersSchema } from './printers';

interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initAllSchemas(helpers: SchemaHelpers) {
  // Initialize schemas in the same order as the original code
  // 1. Menu (categories, kitchens, items, shelf_items, shelf_sales)
  initMenuSchema(helpers);
  // 2. Orders (orders, order_items, table_locks, customer_table_locks, tables migration, floors, halls)
  initOrdersSchema(helpers);
  // 3. Core (shifts, reports, business_days, users)
  initCoreSchema(helpers);
  // 4. Printers (printer_settings)
  initPrintersSchema(helpers);
  // 5. Finance (revenues, expenses, cash_flow)
  initFinanceSchema(helpers);
  // 6. Offers (daily_deals, combos, combo_items, scheduled_offers, featured_items, happy_hour)
  initOffersSchema(helpers);
}

