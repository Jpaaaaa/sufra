/**
 * Shelves routes
 */
import {
  shelvesFindAll,
  shelvesFindOneById,
  shelvesFindOneByBarcode,
  shelvesCreate,
  shelvesUpdate,
  shelvesRemove,
  shelvesSell,
} from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

function parseId(value: string): number {
  return parseInt(value, 10);
}

function registerShelvesAtPrefix(ctx: FastifyRouteContext, prefix: string): void {
  const { app } = ctx;

  app.get(prefix, async (request, reply) => {
    try {
      return await shelvesFindAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { barcode: string } }>(
    `${prefix}/barcode/:barcode`,
    async (request, reply) => {
      try {
        return await shelvesFindOneByBarcode(request.params.barcode);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post(prefix, async (request, reply) => {
    try {
      return await shelvesCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: { barcode?: string; quantity?: number } }>(
    `${prefix}/sell`,
    async (request, reply) => {
      try {
        const { barcode, quantity } = request.body ?? {};
        return await shelvesSell(barcode!, quantity || 1);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    `${prefix}/:id`,
    async (request, reply) => {
      try {
        return await shelvesFindOneById(parseId(request.params.id));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    `${prefix}/:id`,
    async (request, reply) => {
      try {
        return await shelvesUpdate(parseId(request.params.id), request.body);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    `${prefix}/:id`,
    async (request, reply) => {
      try {
        await shelvesRemove(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );
}

export function registerShelvesRoutes(ctx: FastifyRouteContext): void {
  registerShelvesAtPrefix(ctx, '/shelves');
  registerShelvesAtPrefix(ctx, '/api/shelves');
}
