/**
 * Delivery order and platform routes — migrated from electron/http/routes/orders.ts
 */
import {
  deliveryOrdersFindActive,
  deliveryOrdersFindArchived,
  deliveryOrdersFindById,
  deliveryOrdersCreate,
  deliveryOrdersUpdate,
  deliveryOrdersUpdateStatus,
  deliveryOrdersRemove,
  deliveryOrdersRemoveAllArchived,
  deliveryPlatformsFindAll,
  deliveryPlatformsCreate,
  deliveryPlatformsUpdate,
  deliveryPlatformsRemove,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { emitOrder, parseId, withOrderCreatorFromRequest, type DeliveryStatus } from './helpers';

type StatusBody = { status?: DeliveryStatus };

function registerPlatformRoutes(ctx: FastifyRouteContext, prefix: string): void {
  const { app } = ctx;

  app.get(prefix + '/platforms', async (request, reply) => {
    try {
      return await deliveryPlatformsFindAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post(prefix + '/platforms', async (request, reply) => {
    try {
      return await deliveryPlatformsCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { id: string } }>(prefix + '/platforms/:id', async (request, reply) => {
    try {
      return await deliveryPlatformsUpdate(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(prefix + '/platforms/:id', async (request, reply) => {
    try {
      await deliveryPlatformsRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}

function registerDeliveryOrderRoutes(ctx: FastifyRouteContext, prefix: string): void {
  const { app } = ctx;

  app.get(prefix + '/active', async (request, reply) => {
    try {
      return await deliveryOrdersFindActive();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get(prefix + '/archived', async (request, reply) => {
    try {
      return await deliveryOrdersFindArchived();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>(prefix + '/:id', async (request, reply) => {
    try {
      return await deliveryOrdersFindById(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post(prefix, async (request, reply) => {
    try {
      const order = await deliveryOrdersCreate(
        withOrderCreatorFromRequest(request.body as Record<string, unknown>, request.headers.authorization),
      );
      emitOrder(ctx, 'created', 'delivery', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(prefix + '/:id', async (request, reply) => {
    try {
      const order = await deliveryOrdersUpdate(parseId(request.params.id), request.body);
      emitOrder(ctx, 'updated', 'delivery', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { id: string } }>(prefix + '/:id', async (request, reply) => {
    try {
      const order = await deliveryOrdersUpdate(parseId(request.params.id), request.body);
      emitOrder(ctx, 'updated', 'delivery', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    prefix + '/:id/status',
    async (request, reply) => {
      try {
        const order = await deliveryOrdersUpdateStatus(
          parseId(request.params.id),
          request.body?.status as DeliveryStatus,
        );
        emitOrder(ctx, 'updated', 'delivery', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(prefix + '/:id', async (request, reply) => {
    try {
      await deliveryOrdersRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete(prefix + '/archived', async (request, reply) => {
    try {
      const deletedCount = await deliveryOrdersRemoveAllArchived();
      return { deletedCount };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}

export function registerDeliveryRoutes(ctx: FastifyRouteContext): void {
  registerPlatformRoutes(ctx, '/orders/delivery');
  registerDeliveryOrderRoutes(ctx, '/orders/delivery');
  registerPlatformRoutes(ctx, '/api/orders/delivery');
  registerDeliveryOrderRoutes(ctx, '/api/orders/delivery');
}
