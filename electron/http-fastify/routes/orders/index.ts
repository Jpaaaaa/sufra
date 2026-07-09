/**
 * Orders routes aggregator — dine-in, pickup, delivery.
 */
import type { FastifyRouteContext } from '../../types';
import { registerDineInOrderRoutes } from './dine-in';
import { registerPickupOrderRoutes } from './pickup';
import { registerDeliveryRoutes } from './delivery';

export function registerOrdersRoutes(ctx: FastifyRouteContext): void {
  registerDineInOrderRoutes(ctx);
  registerPickupOrderRoutes(ctx);
  registerDeliveryRoutes(ctx);
}
