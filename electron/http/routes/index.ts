/**
 * HTTP route registration - aggregates all route modules.
 */
import type { RouteContext } from '../types';
import { registerHealthRoutes } from './health';
import { registerAuthRoutes } from './auth';
import { registerItemsRoutes } from './items';
import { registerOrdersRoutes } from './orders';
import { registerTablesRoutes } from './tables';
import { registerVenueRoutes } from './venue';
import { registerPrintersRoutes } from './printers';
import { registerPrintRoutes } from './print';
import { registerReportsRoutes } from './reports';
import { registerOffersRoutes } from './offers';
import { registerShelvesRoutes } from './shelves';
import { registerShiftsRoutes } from './shifts';
import { registerFinanceRoutes } from './finance';

export function registerAllRoutes(ctx: RouteContext) {
  registerHealthRoutes(ctx);
  registerAuthRoutes(ctx);
  registerItemsRoutes(ctx);
  registerOrdersRoutes(ctx);
  registerTablesRoutes(ctx);
  registerVenueRoutes(ctx);
  registerPrintersRoutes(ctx);
  registerPrintRoutes(ctx);
  registerReportsRoutes(ctx);
  registerOffersRoutes(ctx);
  registerShelvesRoutes(ctx);
  registerShiftsRoutes(ctx);
  registerFinanceRoutes(ctx);
}
