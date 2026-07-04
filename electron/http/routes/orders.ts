/**
 * Orders HTTP routes (dine-in, pickup, delivery).
 */
import { getService } from '../../init/backend-loader';
import {
  OrdersService,
  DineInOrdersService,
  PickupOrdersService,
  DeliveryOrdersService,
  DeliveryPlatformsService,
  TablesService,
} from '../../init/backend-loader';
import type { RouteContext } from '../types';

function emit(ctx: RouteContext, eventType: 'created' | 'updated' | 'deleted', orderType: 'dine-in' | 'pickup' | 'delivery', order: any) {
  ctx.emitOrderEvent?.(eventType, orderType, order);
}

export function registerOrdersRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/orders/active', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    const orders = await ordersService.findActiveOrders();
    res.json(orders);
  }));

  app.get('/api/orders/by-table/:tableId', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    const orders = await ordersService.findByTable(parseInt(req.params.tableId));
    res.json(orders);
  }));

  app.get('/api/orders/by-hall/:hallId', asyncHandler(async (req, res) => {
    const hallId = parseInt(req.params.hallId);
    if (!hallId || isNaN(hallId) || hallId <= 0) {
      return res.status(400).json({ error: 'Invalid hall_id' });
    }
    const ordersService = getService(OrdersService);
    const tablesService = getService(TablesService);
    const activeOrders = await ordersService.findActiveOrders();
    const tables = await tablesService.findByHall(hallId);
    const tableIds = new Set(tables.map((t: any) => t.id));
    const filteredOrders = activeOrders.filter((order: any) => tableIds.has(order.table_id));
    res.json(filteredOrders);
  }));

  app.get('/api/orders/:id', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.findById(parseInt(req.params.id));
    res.json(order);
  }));

  app.post('/api/orders', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    const order = await ordersService.create(req.body);
    res.json(order);
  }));

  app.put('/api/orders/:id', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    const order = await ordersService.update(parseInt(req.params.id), req.body);
    res.json(order);
  }));

  app.patch('/api/orders/:id/status', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    const order = await ordersService.updateStatus(
      parseInt(req.params.id),
      req.body.status as 'pending' | 'printed' | 'completed' | 'cancelled'
    );
    res.json(order);
  }));

  app.delete('/api/orders/:id', asyncHandler(async (req, res) => {
    const ordersService = getService(OrdersService);
    await ordersService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/orders/dine-in/table/:tableId', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const orders = await dineInOrdersService.findByTable(parseInt(req.params.tableId));
    res.json(orders);
  }));

  app.get('/orders/dine-in/hall/:hallId', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const orders = await dineInOrdersService.findByHall(parseInt(req.params.hallId));
    res.json(orders);
  }));

  app.get('/orders/dine-in/active', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const orders = await dineInOrdersService.findActive();
    res.json(orders);
  }));

  app.post('/orders/dine-in', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.create(req.body);
    emit(ctx, 'created', 'dine-in', order);
    res.json(order);
  }));

  app.post('/orders/dine-in/move-table', asyncHandler(async (req, res) => {
    const { source_table_id, target_table_id } = req.body;
    const dineInOrdersService = getService(DineInOrdersService);
    const result = await dineInOrdersService.moveTableOrders(source_table_id, target_table_id);
    res.json(result);
  }));

  app.post('/orders/dine-in/move-orders', asyncHandler(async (req, res) => {
    const { order_ids, target_table_id } = req.body;
    const dineInOrdersService = getService(DineInOrdersService);
    const result = await dineInOrdersService.moveOrders(order_ids ?? [], target_table_id);
    res.json(result);
  }));

  app.patch('/orders/table/:tableId/global-discount', asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.tableId);
    const { globalDiscount } = req.body;
    const dineInOrdersService = getService(DineInOrdersService);
    await dineInOrdersService.setTableGlobalDiscount(tableId, globalDiscount ?? null);
    res.json({ success: true });
  }));

  app.get('/api/orders/dine-in/active', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const orders = await dineInOrdersService.findActive();
    res.json(orders);
  }));

  app.get('/api/orders/dine-in/archived', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const orders = await dineInOrdersService.findArchived();
    res.json(orders);
  }));

  app.post('/api/orders/dine-in', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.create(req.body);
    emit(ctx, 'created', 'dine-in', order);
    res.json(order);
  }));

  app.patch('/api/orders/dine-in/:id/status', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.updateStatus(
      parseInt(req.params.id),
      req.body.status as 'pending' | 'printed' | 'completed' | 'cancelled'
    );
    emit(ctx, 'updated', 'dine-in', order);
    res.json(order);
  }));

  app.patch('/orders/dine-in/:id/status', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.updateStatus(
      parseInt(req.params.id),
      req.body.status as 'pending' | 'printed' | 'completed' | 'cancelled'
    );
    emit(ctx, 'updated', 'dine-in', order);
    res.json(order);
  }));

  app.patch('/orders/dine-in/:id', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const order = await dineInOrdersService.update(parseInt(req.params.id), req.body);
    emit(ctx, 'updated', 'dine-in', order);
    res.json(order);
  }));

  app.delete('/api/orders/dine-in/archived', asyncHandler(async (req, res) => {
    const dineInOrdersService = getService(DineInOrdersService);
    const deletedCount = await dineInOrdersService.removeAllArchived();
    res.json({ deletedCount });
  }));

  registerPickupRoutes(ctx);
  registerDeliveryRoutes(ctx);
}

function registerPickupRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  const routes = [
    { method: 'get' as const, path: '/orders/pickup/active', fn: (s: any) => s.findActive() },
    { method: 'get' as const, path: '/orders/pickup/archived', fn: (s: any) => s.findArchived() },
    { method: 'get' as const, path: '/orders/pickup/:id', fn: (s: any, id: number) => s.findById(id) },
    { method: 'post' as const, path: '/orders/pickup', fn: (s: any, _: any, body: any) => s.create(body), emit: 'created' as const },
    { method: 'put' as const, path: '/orders/pickup/:id', fn: (s: any, id: number, body: any) => s.update(id, body), emit: 'updated' as const },
    { method: 'patch' as const, path: '/orders/pickup/:id/status', fn: (s: any, id: number, body: any) => s.updateStatus(id, body.status), emit: 'updated' as const },
    { method: 'delete' as const, path: '/orders/pickup/:id', fn: (s: any, id: number) => s.remove(id) },
    { method: 'delete' as const, path: '/orders/pickup/archived', fn: (s: any) => s.removeAllArchived(), retKey: 'deletedCount' },
  ];

  for (const route of routes) {
    const r = route;
    if (r.method === 'get' && r.path.includes(':id')) {
      app.get(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        const result = await r.fn(s, parseInt(req.params.id));
        res.json(result);
      }));
    } else if (r.method === 'get' && !r.path.includes(':id')) {
      app.get(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        const result = await (r.fn as (s: any) => Promise<any>)(s);
        res.json(result);
      }));
    } else if (r.method === 'post' && r.emit) {
      app.post(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        const order = await s.create(req.body);
        ctx.emitOrderEvent?.(r.emit, 'pickup', order);
        res.json(order);
      }));
    } else if (r.method === 'put' && r.emit) {
      app.put(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        const order = await s.update(parseInt(req.params.id), req.body);
        ctx.emitOrderEvent?.(r.emit, 'pickup', order);
        res.json(order);
      }));
    } else if (r.method === 'patch' && r.emit) {
      app.patch(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        const order = await s.updateStatus(parseInt(req.params.id), req.body.status as any);
        ctx.emitOrderEvent?.(r.emit, 'pickup', order);
        res.json(order);
      }));
    } else if (r.method === 'delete') {
      app.delete(r.path, asyncHandler(async (req, res) => {
        const s = getService(PickupOrdersService);
        if (r.path.includes(':id')) {
          await s.remove(parseInt(req.params.id));
          res.json({ success: true });
        } else {
          const deletedCount = await s.removeAllArchived();
          res.json({ deletedCount });
        }
      }));
    }
  }

  app.get('/api/orders/pickup/active', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    res.json(await s.findActive());
  }));
  app.get('/api/orders/pickup/archived', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    res.json(await s.findArchived());
  }));
  app.get('/api/orders/pickup/:id', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    res.json(await s.findById(parseInt(req.params.id)));
  }));
  app.post('/api/orders/pickup', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    const order = await s.create(req.body);
    ctx.emitOrderEvent?.('created', 'pickup', order);
    res.json(order);
  }));
  app.put('/api/orders/pickup/:id', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    const order = await s.update(parseInt(req.params.id), req.body);
    ctx.emitOrderEvent?.('updated', 'pickup', order);
    res.json(order);
  }));
  app.patch('/api/orders/pickup/:id/status', asyncHandler(async (req, res) => {
    const s = getService(PickupOrdersService);
    const order = await s.updateStatus(parseInt(req.params.id), req.body.status as any);
    ctx.emitOrderEvent?.('updated', 'pickup', order);
    res.json(order);
  }));
  app.delete('/api/orders/pickup/:id', asyncHandler(async (req, res) => {
    await getService(PickupOrdersService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.delete('/api/orders/pickup/archived', asyncHandler(async (req, res) => {
    const deletedCount = await getService(PickupOrdersService).removeAllArchived();
    res.json({ deletedCount });
  }));
}

function registerDeliveryRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/orders/delivery/platforms', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).findAll());
  }));
  app.post('/orders/delivery/platforms', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).create(req.body));
  }));
  app.patch('/orders/delivery/platforms/:id', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).update(parseInt(req.params.id, 10), req.body));
  }));
  app.delete('/orders/delivery/platforms/:id', asyncHandler(async (req, res) => {
    await getService(DeliveryPlatformsService).remove(parseInt(req.params.id, 10));
    res.json({ success: true });
  }));

  app.get('/orders/delivery/active', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findActive());
  }));
  app.get('/orders/delivery/archived', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findArchived());
  }));
  app.get('/orders/delivery/:id', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findById(parseInt(req.params.id)));
  }));
  app.post('/orders/delivery', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).create(req.body);
    ctx.emitOrderEvent?.('created', 'delivery', order);
    res.json(order);
  }));
  app.put('/orders/delivery/:id', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).update(parseInt(req.params.id), req.body);
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.patch('/orders/delivery/:id', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).update(parseInt(req.params.id), req.body);
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.patch('/orders/delivery/:id/status', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).updateStatus(
      parseInt(req.params.id),
      req.body.status as 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'
    );
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.delete('/orders/delivery/:id', asyncHandler(async (req, res) => {
    await getService(DeliveryOrdersService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.delete('/orders/delivery/archived', asyncHandler(async (req, res) => {
    const deletedCount = await getService(DeliveryOrdersService).removeAllArchived();
    res.json({ deletedCount });
  }));

  app.get('/api/orders/delivery/platforms', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).findAll());
  }));
  app.post('/api/orders/delivery/platforms', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).create(req.body));
  }));
  app.patch('/api/orders/delivery/platforms/:id', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryPlatformsService).update(parseInt(req.params.id, 10), req.body));
  }));
  app.delete('/api/orders/delivery/platforms/:id', asyncHandler(async (req, res) => {
    await getService(DeliveryPlatformsService).remove(parseInt(req.params.id, 10));
    res.json({ success: true });
  }));

  app.get('/api/orders/delivery/active', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findActive());
  }));
  app.get('/api/orders/delivery/archived', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findArchived());
  }));
  app.get('/api/orders/delivery/:id', asyncHandler(async (req, res) => {
    res.json(await getService(DeliveryOrdersService).findById(parseInt(req.params.id)));
  }));
  app.post('/api/orders/delivery', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).create(req.body);
    ctx.emitOrderEvent?.('created', 'delivery', order);
    res.json(order);
  }));
  app.put('/api/orders/delivery/:id', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).update(parseInt(req.params.id), req.body);
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.patch('/api/orders/delivery/:id', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).update(parseInt(req.params.id), req.body);
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.patch('/api/orders/delivery/:id/status', asyncHandler(async (req, res) => {
    const order = await getService(DeliveryOrdersService).updateStatus(
      parseInt(req.params.id),
      req.body.status as 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived'
    );
    ctx.emitOrderEvent?.('updated', 'delivery', order);
    res.json(order);
  }));
  app.delete('/api/orders/delivery/:id', asyncHandler(async (req, res) => {
    await getService(DeliveryOrdersService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.delete('/api/orders/delivery/archived', asyncHandler(async (req, res) => {
    const deletedCount = await getService(DeliveryOrdersService).removeAllArchived();
    res.json({ deletedCount });
  }));
}
