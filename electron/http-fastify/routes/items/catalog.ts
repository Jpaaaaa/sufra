/**
 * Items CRUD routes — migrated from electron/http/routes/items.ts
 */
import {
  itemsFindOne,
  itemsCreate,
  itemsUpdate,
  itemsRemove,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { listItemsWithOffers, parseId } from './helpers';

type ItemsQuery = { kitchen_id?: string };

function registerItemsAtPrefix(ctx: FastifyRouteContext, prefix: string): void {
  const { app } = ctx;
  const listPath = prefix;
  const byIdPath = `${prefix}/:id`;

  app.get<{ Querystring: ItemsQuery }>(listPath, async (request, reply) => {
    try {
      const kitchen_id = request.query.kitchen_id
        ? parseId(request.query.kitchen_id)
        : undefined;
      return await listItemsWithOffers(kitchen_id);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>(byIdPath, async (request, reply) => {
    try {
      return await itemsFindOne(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post(listPath, async (request, reply) => {
    try {
      return await itemsCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(byIdPath, async (request, reply) => {
    try {
      return await itemsUpdate(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(byIdPath, async (request, reply) => {
    try {
      await itemsRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}

export function registerItemCatalogRoutes(ctx: FastifyRouteContext): void {
  registerItemsAtPrefix(ctx, '/items');
  registerItemsAtPrefix(ctx, '/api/items');
}
