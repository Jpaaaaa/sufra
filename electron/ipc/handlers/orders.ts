/**
 * IPC handlers: orders, tables.
 */
import { ipcMain } from 'electron';
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
  pickupOrdersFindActive,
  pickupOrdersFindArchived,
  pickupOrdersFindById,
  pickupOrdersCreate,
  pickupOrdersUpdate,
  pickupOrdersUpdateStatus,
  pickupOrdersRemove,
  pickupOrdersRemoveAllArchived,
  deliveryPlatformsFindAll,
  deliveryPlatformsCreate,
  deliveryPlatformsUpdate,
  deliveryPlatformsRemove,
  deliveryOrdersFindActive,
  deliveryOrdersFindArchived,
  deliveryOrdersFindById,
  deliveryOrdersCreate,
  deliveryOrdersUpdate,
  deliveryOrdersUpdateStatus,
  deliveryOrdersRemove,
  deliveryOrdersRemoveAllArchived,
  tablesFindAll,
  tablesFindByHall,
  tablesFindOne,
  tablesCreate,
  tablesUpdate,
  tablesRemove,
} from '../../init/backend-loader';
import { emitOrderEvent } from '../../http-shared/socket-io';

export function registerOrdersHandlers() {
  ipcMain.handle('orders:findByTable', async (_, tableId: number) => ordersFindByTable(tableId));
  ipcMain.handle('orders:findActive', async () => ordersFindActiveOrders());
  ipcMain.handle('orders:findByHall', async (_, hallId: number) => {
    if (!hallId || typeof hallId !== 'number' || isNaN(hallId) || hallId <= 0) {
      throw new Error(`Invalid hall_id: ${hallId}. hall_id must be a positive number.`);
    }
    const activeOrders = await ordersFindActiveOrders();
    const tables = await tablesFindByHall(hallId);
    const tableIds = new Set(tables.map((t: any) => t.id));
    return activeOrders.filter((order: any) => tableIds.has(order.table_id));
  });

  ipcMain.handle('orders:createDineIn', async (_, data: any) => {
    const order = await dineInOrdersCreate(data);
    emitOrderEvent('created', 'dine-in', order);
    return order;
  });
  ipcMain.handle('orders:findActiveDineIn', async () => dineInOrdersFindActive());
  ipcMain.handle('orders:findArchivedDineIn', async () => dineInOrdersFindArchived());
  ipcMain.handle('orders:clearArchivedDineIn', async () => {
    const deletedCount = await dineInOrdersRemoveAllArchived();
    return { deletedCount };
  });
  ipcMain.handle('orders:getById', async (_, id: number) => dineInOrdersFindById(id));
  ipcMain.handle('orders:findDineInByTable', async (_, tableId: number) =>
    dineInOrdersFindByTable(tableId),
  );
  ipcMain.handle('orders:findDineInByHall', async (_, hallId: number) =>
    dineInOrdersFindByHall(hallId),
  );
  ipcMain.handle('orders:moveTable', async (_, sourceTableId: number, targetTableId: number) => {
    const result = await dineInOrdersMoveTableOrders(sourceTableId, targetTableId);
    if (result.movedCount > 0) {
      emitOrderEvent('updated', 'dine-in', {
        source_table_id: sourceTableId,
        target_table_id: targetTableId,
      });
    }
    return result;
  });
  ipcMain.handle('orders:moveOrders', async (_, orderIds: number[], targetTableId: number) => {
    const result = await dineInOrdersMoveOrders(orderIds, targetTableId);
    if (result.movedCount > 0) {
      emitOrderEvent('updated', 'dine-in', { order_ids: orderIds, target_table_id: targetTableId });
    }
    return result;
  });

  ipcMain.handle('orders:create', async (_, data: any) => ordersCreate(data));
  ipcMain.handle('orders:update', async (_, id: number, data: any) => ordersUpdate(id, data));
  ipcMain.handle('orders:updateStatus', async (_, id: number, status: string) => {
    try {
      const order = await dineInOrdersUpdateStatus(id, status as any);
      emitOrderEvent('updated', 'dine-in', order);
      return order;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return ordersUpdateStatus(id, status as any);
      }
      throw error;
    }
  });
  ipcMain.handle('orders:updateDineInStatus', async (_, id: number, status: string) => {
    const order = await dineInOrdersUpdateStatus(id, status as any);
    emitOrderEvent('updated', 'dine-in', order);
    return order;
  });
  ipcMain.handle('orders:updateDineIn', async (_, id: number, data: any) => {
    const order = await dineInOrdersUpdate(id, data);
    emitOrderEvent('updated', 'dine-in', order);
    return order;
  });
  ipcMain.handle(
    'orders:setTableGlobalDiscount',
    async (_, tableId: number, globalDiscount: { percent: number; amount: number } | null) =>
      dineInOrdersSetTableGlobalDiscount(tableId, globalDiscount),
  );

  ipcMain.handle('orders:findActivePickup', async () => pickupOrdersFindActive());
  ipcMain.handle('orders:findArchivedPickup', async () => pickupOrdersFindArchived());
  ipcMain.handle('orders:findPickupById', async (_, id: number) => pickupOrdersFindById(id));
  ipcMain.handle('orders:createPickup', async (_, data: any) => {
    const order = await pickupOrdersCreate(data);
    emitOrderEvent('created', 'pickup', order);
    return order;
  });
  ipcMain.handle('orders:updatePickupStatus', async (_, id: number, status: string) => {
    const order = await pickupOrdersUpdateStatus(id, status as any);
    emitOrderEvent('updated', 'pickup', order);
    return order;
  });
  ipcMain.handle('orders:updatePickup', async (_, id: number, data: any) =>
    pickupOrdersUpdate(id, data),
  );
  ipcMain.handle('orders:removePickup', async (_, id: number) => pickupOrdersRemove(id));
  ipcMain.handle('orders:clearArchivedPickup', async () => {
    const deletedCount = await pickupOrdersRemoveAllArchived();
    return { deletedCount };
  });

  ipcMain.handle('orders:findAllDeliveryPlatforms', async () => deliveryPlatformsFindAll());
  ipcMain.handle('orders:createDeliveryPlatform', async (_, data: any) =>
    deliveryPlatformsCreate(data),
  );
  ipcMain.handle('orders:updateDeliveryPlatform', async (_, id: number, data: any) =>
    deliveryPlatformsUpdate(id, data),
  );
  ipcMain.handle('orders:removeDeliveryPlatform', async (_, id: number) =>
    deliveryPlatformsRemove(id),
  );

  ipcMain.handle('orders:findActiveDelivery', async () => deliveryOrdersFindActive());
  ipcMain.handle('orders:findArchivedDelivery', async () => deliveryOrdersFindArchived());
  ipcMain.handle('orders:findDeliveryById', async (_, id: number) => deliveryOrdersFindById(id));
  ipcMain.handle('orders:createDelivery', async (_, data: any) => {
    const order = await deliveryOrdersCreate(data);
    emitOrderEvent('created', 'delivery', order);
    return order;
  });
  ipcMain.handle('orders:updateDeliveryStatus', async (_, id: number, status: string) => {
    const order = await deliveryOrdersUpdateStatus(id, status as any);
    emitOrderEvent('updated', 'delivery', order);
    return order;
  });
  ipcMain.handle('orders:updateDelivery', async (_, id: number, data: any) =>
    deliveryOrdersUpdate(id, data),
  );
  ipcMain.handle('orders:removeDelivery', async (_, id: number) => deliveryOrdersRemove(id));
  ipcMain.handle('orders:clearArchivedDelivery', async () => {
    const deletedCount = await deliveryOrdersRemoveAllArchived();
    return { deletedCount };
  });

  ipcMain.handle('orders:remove', async (_, id: number) => ordersRemove(id));

  ipcMain.handle('tables:findAll', async () => tablesFindAll());
  ipcMain.handle('tables:findByHall', async (_, hallId: number) => {
    if (!hallId || typeof hallId !== 'number' || isNaN(hallId) || hallId <= 0) {
      throw new Error(`Invalid hallId: ${hallId}. hallId must be a positive number.`);
    }
    const result = await tablesFindByHall(hallId);
    return result.map((t: any) => ({
      id: t.id,
      number: t.number,
      name: t.name,
      hall_id: t.hall_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  });
  ipcMain.handle('tables:findOne', async (_, id: number) => tablesFindOne(id));
  ipcMain.handle('tables:create', async (_, data: any) => {
    const result = await tablesCreate(data);
    return JSON.parse(JSON.stringify(result));
  });
  ipcMain.handle('tables:update', async (_, id: number, data: any) => tablesUpdate(id, data));
  ipcMain.handle('tables:remove', async (_, id: number) => tablesRemove(id));
}
