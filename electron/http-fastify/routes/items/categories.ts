/**
 * Categories CRUD routes — migrated from electron/http/routes/items.ts
 */
import {
  categoriesFindAll,
  categoriesFindOne,
  categoriesCreate,
  categoriesUpdate,
  categoriesRemove,
  categoriesReorder,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { parseId } from './helpers';

type ReorderBody = { ids?: number[] };

function registerCategoriesAtPrefix(ctx: FastifyRouteContext, prefix: string): void {
  const { app } = ctx;

  app.get(prefix, async (request, reply) => {
    try {
      return await categoriesFindAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Body: ReorderBody }>(`${prefix}/reorder`, async (request, reply) => {
    try {
      await categoriesReorder(request.body?.ids ?? []);
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>(`${prefix}/:id`, async (request, reply) => {
    try {
      return await categoriesFindOne(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post(prefix, async (request, reply) => {
    try {
      return await categoriesCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(`${prefix}/:id`, async (request, reply) => {
    try {
      return await categoriesUpdate(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(`${prefix}/:id`, async (request, reply) => {
    try {
      await categoriesRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}

export function registerCategoryRoutes(ctx: FastifyRouteContext): void {
  registerCategoriesAtPrefix(ctx, '/categories');
  registerCategoriesAtPrefix(ctx, '/api/categories');
}
