/**
 * Pickup order routes — migrated from electron/http/routes/orders.ts
 */
import {
  pickupOrdersFindActive,
  pickupOrdersFindArchived,
  pickupOrdersFindById,
  pickupOrdersCreate,
  pickupOrdersUpdate,
  pickupOrdersUpdateStatus,
  pickupOrdersRemove,
  pickupOrdersRemoveAllArchived,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { emitOrder, parseId, withOrderCreatorFromRequest, type DineInStatus } from './helpers';

type StatusBody = { status?: DineInStatus };

export function registerPickupOrderRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  const registerPair = (
    basePath: string,
    apiBasePath: string,
  ): void => {
    app.get(basePath + '/active', async (request, reply) => {
      try {
        return await pickupOrdersFindActive();
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.get(apiBasePath + '/active', async (request, reply) => {
      try {
        return await pickupOrdersFindActive();
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.get(basePath + '/archived', async (request, reply) => {
      try {
        return await pickupOrdersFindArchived();
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.get(apiBasePath + '/archived', async (request, reply) => {
      try {
        return await pickupOrdersFindArchived();
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.get<{ Params: { id: string } }>(basePath + '/:id', async (request, reply) => {
      try {
        return await pickupOrdersFindById(parseId(request.params.id));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.get<{ Params: { id: string } }>(apiBasePath + '/:id', async (request, reply) => {
      try {
        return await pickupOrdersFindById(parseId(request.params.id));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.post(basePath, async (request, reply) => {
      try {
        const order = await pickupOrdersCreate(
          withOrderCreatorFromRequest(request.body as Record<string, unknown>, request.headers.authorization),
        );
        emitOrder(ctx, 'created', 'pickup', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.post(apiBasePath, async (request, reply) => {
      try {
        const order = await pickupOrdersCreate(
          withOrderCreatorFromRequest(request.body as Record<string, unknown>, request.headers.authorization),
        );
        emitOrder(ctx, 'created', 'pickup', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.put<{ Params: { id: string } }>(basePath + '/:id', async (request, reply) => {
      try {
        const order = await pickupOrdersUpdate(parseId(request.params.id), request.body);
        emitOrder(ctx, 'updated', 'pickup', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.put<{ Params: { id: string } }>(apiBasePath + '/:id', async (request, reply) => {
      try {
        const order = await pickupOrdersUpdate(parseId(request.params.id), request.body);
        emitOrder(ctx, 'updated', 'pickup', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.patch<{ Params: { id: string }; Body: StatusBody }>(
      basePath + '/:id/status',
      async (request, reply) => {
        try {
          const order = await pickupOrdersUpdateStatus(
            parseId(request.params.id),
            request.body?.status as DineInStatus,
          );
          emitOrder(ctx, 'updated', 'pickup', order);
          return order;
        } catch (error) {
          sendRouteError(reply, error, `${request.method} ${request.url}`);
        }
      },
    );

    app.patch<{ Params: { id: string }; Body: StatusBody }>(
      apiBasePath + '/:id/status',
      async (request, reply) => {
        try {
          const order = await pickupOrdersUpdateStatus(
            parseId(request.params.id),
            request.body?.status as DineInStatus,
          );
          emitOrder(ctx, 'updated', 'pickup', order);
          return order;
        } catch (error) {
          sendRouteError(reply, error, `${request.method} ${request.url}`);
        }
      },
    );

    app.delete<{ Params: { id: string } }>(basePath + '/:id', async (request, reply) => {
      try {
        await pickupOrdersRemove(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.delete<{ Params: { id: string } }>(apiBasePath + '/:id', async (request, reply) => {
      try {
        await pickupOrdersRemove(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.delete(basePath + '/archived', async (request, reply) => {
      try {
        const deletedCount = await pickupOrdersRemoveAllArchived();
        return { deletedCount };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });

    app.delete(apiBasePath + '/archived', async (request, reply) => {
      try {
        const deletedCount = await pickupOrdersRemoveAllArchived();
        return { deletedCount };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    });
  };

  registerPair('/orders/pickup', '/api/orders/pickup');
}
