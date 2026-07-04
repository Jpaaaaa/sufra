/**
 * IPC handlers: items, categories.
 */
import { ipcMain } from 'electron';
import { getService, ItemsService, OffersService, CategoriesService } from '../../init/backend-loader';

export function registerCatalogHandlers() {
  ipcMain.handle('items:findAll', async (_, kitchen_id?: number) => {
    const itemsService = getService(ItemsService);
    const offersService = getService(OffersService);
    const items = await itemsService.findAll(kitchen_id);
    return await offersService.enrichItemsWithOffers(items);
  });
  ipcMain.handle('items:findOne', async (_, id: number) => {
    return await getService(ItemsService).findOne(id);
  });
  ipcMain.handle('items:create', async (_, data: any) => {
    return await getService(ItemsService).create(data);
  });
  ipcMain.handle('items:update', async (_, id: number, data: any) => {
    return await getService(ItemsService).update(id, data);
  });
  ipcMain.handle('items:remove', async (_, id: number) => {
    return await getService(ItemsService).remove(id);
  });

  ipcMain.handle('categories:findAll', async () => {
    return await getService(CategoriesService).findAll();
  });
  ipcMain.handle('categories:findOne', async (_, id: number) => {
    return await getService(CategoriesService).findOne(id);
  });
  ipcMain.handle('categories:create', async (_, data: any) => {
    return await getService(CategoriesService).create(data);
  });
  ipcMain.handle('categories:update', async (_, id: number, data: any) => {
    return await getService(CategoriesService).update(id, data);
  });
  ipcMain.handle('categories:remove', async (_, id: number) => {
    return await getService(CategoriesService).remove(id);
  });
  ipcMain.handle('categories:reorder', async (_, ids: number[]) => {
    await getService(CategoriesService).reorder(ids);
  });
}
