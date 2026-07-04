/**
 * IPC handlers: orders, tables.
 */
import { ipcMain } from 'electron';
import { getService } from '../../init/backend-loader';
import {
  OrdersService,
  DineInOrdersService,
  PickupOrdersService,
  DeliveryOrdersService,
  DeliveryPlatformsService,
  TablesService,
} from '../../init/backend-loader';
import { emitOrderEvent } from '../../http/server';

export function registerOrdersHandlers() {
  ipcMain.handle('orders:findByTable', async (_, tableId: number) => {
    return await getService(OrdersService).findByTable(tableId);
  });
  ipcMain.handle('orders:findActive', async () => {
    return await getService(OrdersService).findActiveOrders();
  });
  ipcMain.handle('orders:findByHall', async (_, hallId: number) => {
    if (!hallId || typeof hallId !== 'number' || isNaN(hallId) || hallId <= 0) {
      throw new Error(`Invalid hall_id: ${hallId}. hall_id must be a positive number.`);
    }
    const ordersService = getService(OrdersService);
    const tablesService = getService(TablesService);
    const activeOrders = await ordersService.findActiveOrders();
    const tables = await tablesService.findByHall(hallId);
    const tableIds = new Set(tables.map((t: any) => t.id));
    return activeOrders.filter((order: any) => tableIds.has(order.table_id));
  });

  ipcMain.handle('orders:createDineIn', async (_, data: any) => {
    const order = await getService(DineInOrdersService).create(data);
    emitOrderEvent('created', 'dine-in', order);
    return order;
  });
  ipcMain.handle('orders:findActiveDineIn', async () => {
    return await getService(DineInOrdersService).findActive();
  });
  ipcMain.handle('orders:findArchivedDineIn', async () => {
    return await getService(DineInOrdersService).findArchived();
  });
  ipcMain.handle('orders:clearArchivedDineIn', async () => {
    const deletedCount = await getService(DineInOrdersService).removeAllArchived();
    return { deletedCount };
  });
  ipcMain.handle('orders:getById', async (_, id: number) => {
    return await getService(DineInOrdersService).findById(id);
  });
  ipcMain.handle('orders:findDineInByTable', async (_, tableId: number) => {
    return await getService(DineInOrdersService).findByTable(tableId);
  });
  ipcMain.handle('orders:findDineInByHall', async (_, hallId: number) => {
    return await getService(DineInOrdersService).findByHall(hallId);
  });
  ipcMain.handle('orders:moveTable', async (_, sourceTableId: number, targetTableId: number) => {
    const result = await getService(DineInOrdersService).moveTableOrders(sourceTableId, targetTableId);
    if (result.movedCount > 0) {
      emitOrderEvent('updated', 'dine-in', { source_table_id: sourceTableId, target_table_id: targetTableId });
    }
    return result;
  });
  ipcMain.handle('orders:moveOrders', async (_, orderIds: number[], targetTableId: number) => {
    const result = await getService(DineInOrdersService).moveOrders(orderIds, targetTableId);
    if (result.movedCount > 0) {
      emitOrderEvent('updated', 'dine-in', { order_ids: orderIds, target_table_id: targetTableId });
    }
    return result;
  });

  ipcMain.handle('orders:create', async (_, data: any) => {
    return await getService(OrdersService).create(data);
  });
  ipcMain.handle('orders:update', async (_, id: number, data: any) => {
    return await getService(OrdersService).update(id, data);
  });
  ipcMain.handle('orders:updateStatus', async (_, id: number, status: string) => {
    try {
      const order = await getService(DineInOrdersService).updateStatus(id, status as any);
      emitOrderEvent('updated', 'dine-in', order);
      return order;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return await getService(OrdersService).updateStatus(id, status as any);
      }
      throw error;
    }
  });
  ipcMain.handle('orders:updateDineInStatus', async (_, id: number, status: string) => {
    const order = await getService(DineInOrdersService).updateStatus(id, status as any);
    emitOrderEvent('updated', 'dine-in', order);
    return order;
  });
  ipcMain.handle('orders:updateDineIn', async (_, id: number, data: any) => {
    const order = await getService(DineInOrdersService).update(id, data);
    emitOrderEvent('updated', 'dine-in', order);
    return order;
  });
  ipcMain.handle('orders:setTableGlobalDiscount', async (_, tableId: number, globalDiscount: { percent: number; amount: number } | null) => {
    return await getService(DineInOrdersService).setTableGlobalDiscount(tableId, globalDiscount);
  });

  ipcMain.handle('orders:findActivePickup', async () => getService(PickupOrdersService).findActive());
  ipcMain.handle('orders:findArchivedPickup', async () => getService(PickupOrdersService).findArchived());
  ipcMain.handle('orders:findPickupById', async (_, id: number) => getService(PickupOrdersService).findById(id));
  ipcMain.handle('orders:createPickup', async (_, data: any) => {
    const order = await getService(PickupOrdersService).create(data);
    emitOrderEvent('created', 'pickup', order);
    return order;
  });
  ipcMain.handle('orders:updatePickupStatus', async (_, id: number, status: string) => {
    const order = await getService(PickupOrdersService).updateStatus(id, status as any);
    emitOrderEvent('updated', 'pickup', order);
    return order;
  });
  ipcMain.handle('orders:updatePickup', async (_, id: number, data: any) => {
    return await getService(PickupOrdersService).update(id, data);
  });
  ipcMain.handle('orders:removePickup', async (_, id: number) => {
    return await getService(PickupOrdersService).remove(id);
  });
  ipcMain.handle('orders:clearArchivedPickup', async () => {
    const deletedCount = await getService(PickupOrdersService).removeAllArchived();
    return { deletedCount };
  });

  ipcMain.handle('orders:findAllDeliveryPlatforms', async () => getService(DeliveryPlatformsService).findAll());
  ipcMain.handle('orders:createDeliveryPlatform', async (_, data: any) =>
    getService(DeliveryPlatformsService).create(data),
  );
  ipcMain.handle('orders:updateDeliveryPlatform', async (_, id: number, data: any) =>
    getService(DeliveryPlatformsService).update(id, data),
  );
  ipcMain.handle('orders:removeDeliveryPlatform', async (_, id: number) =>
    getService(DeliveryPlatformsService).remove(id),
  );

  ipcMain.handle('orders:findActiveDelivery', async () => getService(DeliveryOrdersService).findActive());
  ipcMain.handle('orders:findArchivedDelivery', async () => getService(DeliveryOrdersService).findArchived());
  ipcMain.handle('orders:findDeliveryById', async (_, id: number) => getService(DeliveryOrdersService).findById(id));
  ipcMain.handle('orders:createDelivery', async (_, data: any) => {
    const order = await getService(DeliveryOrdersService).create(data);
    emitOrderEvent('created', 'delivery', order);
    return order;
  });
  ipcMain.handle('orders:updateDeliveryStatus', async (_, id: number, status: string) => {
    const order = await getService(DeliveryOrdersService).updateStatus(id, status as any);
    emitOrderEvent('updated', 'delivery', order);
    return order;
  });
  ipcMain.handle('orders:updateDelivery', async (_, id: number, data: any) => {
    return await getService(DeliveryOrdersService).update(id, data);
  });
  ipcMain.handle('orders:removeDelivery', async (_, id: number) => {
    return await getService(DeliveryOrdersService).remove(id);
  });
  ipcMain.handle('orders:clearArchivedDelivery', async () => {
    const deletedCount = await getService(DeliveryOrdersService).removeAllArchived();
    return { deletedCount };
  });

  ipcMain.handle('orders:remove', async (_, id: number) => {
    return await getService(OrdersService).remove(id);
  });

  ipcMain.handle('tables:findAll', async () => getService(TablesService).findAll());
  ipcMain.handle('tables:findByHall', async (_, hallId: number) => {
    if (!hallId || typeof hallId !== 'number' || isNaN(hallId) || hallId <= 0) {
      throw new Error(`Invalid hallId: ${hallId}. hallId must be a positive number.`);
    }
    const result = await getService(TablesService).findByHall(hallId);
    return result.map((t: any) => ({
      id: t.id,
      number: t.number,
      name: t.name,
      hall_id: t.hall_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  });
  ipcMain.handle('tables:findOne', async (_, id: number) => getService(TablesService).findOne(id));
  ipcMain.handle('tables:create', async (_, data: any) => {
    const result = await getService(TablesService).create(data);
    return JSON.parse(JSON.stringify(result));
  });
  ipcMain.handle('tables:update', async (_, id: number, data: any) => {
    return await getService(TablesService).update(id, data);
  });
  ipcMain.handle('tables:remove', async (_, id: number) => {
    return await getService(TablesService).remove(id);
  });
}
