/**
 * IPC handlers: items, categories.
 */
import { ipcMain } from 'electron';
import {
  itemsFindAll,
  offersEnrichItemsWithOffers,
  itemsFindOne,
  itemsCreate,
  itemsUpdate,
  itemsRemove,
  itemsCopyOptionsFromItem,
  categoriesFindAll,
  categoriesFindOne,
  categoriesCreate,
  categoriesUpdate,
  categoriesRemove,
  categoriesReorder,
} from '../../init/backend-loader';

export function registerCatalogHandlers() {
  ipcMain.handle('items:findAll', async (_, kitchen_id?: number) => {
    const items = await itemsFindAll(kitchen_id);
    return offersEnrichItemsWithOffers(items);
  });
  ipcMain.handle('items:findOne', async (_, id: number) => itemsFindOne(id));
  ipcMain.handle('items:create', async (_, data: any) => itemsCreate(data));
  ipcMain.handle('items:update', async (_, id: number, data: any) =>
    itemsUpdate(id, data),
  );
  ipcMain.handle('items:remove', async (_, id: number) => itemsRemove(id));
  ipcMain.handle('items:copyOptionsFromItem', async (_, targetId: number, sourceId: number) =>
    itemsCopyOptionsFromItem(targetId, sourceId),
  );

  ipcMain.handle('categories:findAll', async () => categoriesFindAll());
  ipcMain.handle('categories:findOne', async (_, id: number) => categoriesFindOne(id));
  ipcMain.handle('categories:create', async (_, data: any) => categoriesCreate(data));
  ipcMain.handle('categories:update', async (_, id: number, data: any) =>
    categoriesUpdate(id, data),
  );
  ipcMain.handle('categories:remove', async (_, id: number) => categoriesRemove(id));
  ipcMain.handle('categories:reorder', async (_, ids: number[]) => {
    await categoriesReorder(ids);
  });
}
