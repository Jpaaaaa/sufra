/**
 * Fastify route registration.
 */
import type { FastifyRouteContext } from '../types';
import { registerHealthRoutes } from './health';
import { registerAuthRoutes } from './auth';
import { registerOrdersRoutes } from './orders';
import { registerItemsRoutes } from './items';
import { registerFloorPlanRoutes } from './floor-plan';
import { registerOffersRoutes } from './offers';
import { registerReportsRoutes } from './reports';
import { registerShiftsRoutes } from './shifts';
import { registerShelvesRoutes } from './shelves';
import { registerFinanceRoutes } from './finance';
import { registerPrintersRoutes } from './printers';
import { registerPrintRoutes } from './print';
import { registerSettingsRoutes } from './settings';

export function registerAllFastifyRoutes(ctx: FastifyRouteContext): void {
  registerHealthRoutes(ctx);
  registerAuthRoutes(ctx);
  registerOrdersRoutes(ctx);
  registerItemsRoutes(ctx);
  registerFloorPlanRoutes(ctx);
  registerOffersRoutes(ctx);
  registerReportsRoutes(ctx);
  registerShiftsRoutes(ctx);
  registerShelvesRoutes(ctx);
  registerFinanceRoutes(ctx);
  registerPrintersRoutes(ctx);
  registerPrintRoutes(ctx);
  registerSettingsRoutes(ctx);
}
