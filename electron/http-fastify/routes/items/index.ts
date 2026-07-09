/**
 * Items + categories — migrated from electron/http/routes/items.ts
 */
import type { FastifyRouteContext } from '../../types';
import { registerItemUploadRoutes } from './upload';
import { registerItemCatalogRoutes } from './catalog';
import { registerCategoryRoutes } from './categories';

export function registerItemsRoutes(ctx: FastifyRouteContext): void {
  registerItemUploadRoutes(ctx);
  registerItemCatalogRoutes(ctx);
  registerCategoryRoutes(ctx);
}
