/**
 * Floor plan — venue (halls/floors/kitchens) + tables.
 */
import type { FastifyRouteContext } from '../../types';
import { registerVenueRoutes } from './venue';
import { registerTablesRoutes } from './tables';

/** Register hall-linked table routes before generic hall :id CRUD where order matters. */
export function registerFloorPlanRoutes(ctx: FastifyRouteContext): void {
  registerTablesRoutes(ctx);
  registerVenueRoutes(ctx);
}
