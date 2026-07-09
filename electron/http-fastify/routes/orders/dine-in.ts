/**
 * Dine-in and legacy /api/orders routes — migrated from electron/http/routes/orders.ts
 */
import {
  ordersFindByTable,
  ordersFindActiveOrders,
  ordersCreate,
  ordersUpdate,
  ordersUpdateStatus,
  ordersRemove,
  dineInOrdersCreate,
  dineInOrdersFindActive,
  dineInOrdersFindArchived,
  dineInOrdersFindById,
  dineInOrdersFindByTable,
  dineInOrdersFindByHall,
  dineInOrdersUpdate,
  dineInOrdersUpdateStatus,
  dineInOrdersMoveTableOrders,
  dineInOrdersMoveOrders,
  dineInOrdersSetTableGlobalDiscount,
  dineInOrdersRemoveAllArchived,
  tablesFindByHall,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { emitOrder, parseId, type DineInStatus } from './helpers';

type StatusBody = { status?: DineInStatus };
type MoveTableBody = { source_table_id?: number; target_table_id?: number };
type MoveOrdersBody = { order_ids?: number[]; target_table_id?: number };
type GlobalDiscountBody = { globalDiscount?: unknown };

export function registerDineInOrderRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  // Static paths before :id (parity with Express registration order)
  app.get('/api/orders/active', async (request, reply) => {
    try {
      return await ordersFindActiveOrders();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { tableId: string } }>(
    '/api/orders/by-table/:tableId',
    async (request, reply) => {
      try {
        return await ordersFindByTable(parseId(request.params.tableId));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<{ Params: { hallId: string } }>(
    '/api/orders/by-hall/:hallId',
    async (request, reply) => {
      try {
        const hallId = parseId(request.params.hallId);
        if (!hallId || isNaN(hallId) || hallId <= 0) {
          return reply.status(400).send({ error: 'Invalid hall_id' });
        }
        const activeOrders = await ordersFindActiveOrders();
        const tables = await tablesFindByHall(hallId);
        const tableIds = new Set(tables.map((t: { id: number }) => t.id));
        return activeOrders.filter((order: { table_id: number }) =>
          tableIds.has(order.table_id),
        );
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/orders/dine-in/active', async (request, reply) => {
    try {
      return await dineInOrdersFindActive();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/api/orders/dine-in/archived', async (request, reply) => {
    try {
      return await dineInOrdersFindArchived();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/orders/dine-in/active', async (request, reply) => {
    try {
      return await dineInOrdersFindActive();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { tableId: string } }>(
    '/orders/dine-in/table/:tableId',
    async (request, reply) => {
      try {
        return await dineInOrdersFindByTable(parseId(request.params.tableId));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<{ Params: { hallId: string } }>(
    '/orders/dine-in/hall/:hallId',
    async (request, reply) => {
      try {
        return await dineInOrdersFindByHall(parseId(request.params.hallId));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post('/orders/dine-in', async (request, reply) => {
    try {
      const order = await dineInOrdersCreate(request.body);
      emitOrder(ctx, 'created', 'dine-in', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/orders/dine-in', async (request, reply) => {
    try {
      const order = await dineInOrdersCreate(request.body);
      emitOrder(ctx, 'created', 'dine-in', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: MoveTableBody }>('/orders/dine-in/move-table', async (request, reply) => {
    try {
      const { source_table_id, target_table_id } = request.body ?? {};
      return await dineInOrdersMoveTableOrders(source_table_id!, target_table_id!);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: MoveOrdersBody }>('/orders/dine-in/move-orders', async (request, reply) => {
    try {
      const { order_ids, target_table_id } = request.body ?? {};
      return await dineInOrdersMoveOrders(order_ids ?? [], target_table_id!);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { tableId: string }; Body: GlobalDiscountBody }>(
    '/orders/table/:tableId/global-discount',
    async (request, reply) => {
      try {
        await dineInOrdersSetTableGlobalDiscount(
          parseId(request.params.tableId),
          request.body?.globalDiscount ?? null,
        );
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete('/api/orders/dine-in/archived', async (request, reply) => {
    try {
      const deletedCount = await dineInOrdersRemoveAllArchived();
      return { deletedCount };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    try {
      return await dineInOrdersFindById(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/orders', async (request, reply) => {
    try {
      return await ordersCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    try {
      return await ordersUpdate(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    '/api/orders/:id/status',
    async (request, reply) => {
      try {
        return await ordersUpdateStatus(
          parseId(request.params.id),
          request.body?.status as DineInStatus,
        );
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    try {
      await ordersRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    '/api/orders/dine-in/:id/status',
    async (request, reply) => {
      try {
        const order = await dineInOrdersUpdateStatus(
          parseId(request.params.id),
          request.body?.status as DineInStatus,
        );
        emitOrder(ctx, 'updated', 'dine-in', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: StatusBody }>(
    '/orders/dine-in/:id/status',
    async (request, reply) => {
      try {
        const order = await dineInOrdersUpdateStatus(
          parseId(request.params.id),
          request.body?.status as DineInStatus,
        );
        emitOrder(ctx, 'updated', 'dine-in', order);
        return order;
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.patch<{ Params: { id: string } }>('/orders/dine-in/:id', async (request, reply) => {
    try {
      const order = await dineInOrdersUpdate(parseId(request.params.id), request.body);
      emitOrder(ctx, 'updated', 'dine-in', order);
      return order;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
