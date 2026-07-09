/**
 * IPC handlers: shelves.
 */
import { ipcMain } from 'electron';
import {
  shelvesFindAll,
  shelvesFindOneById,
  shelvesFindOneByBarcode,
  shelvesCreate,
  shelvesUpdate,
  shelvesRemove,
  shelvesSell,
} from '../../init/backend-loader';

export function registerShelvesHandlers() {
  ipcMain.handle('shelves:findAll', async () => shelvesFindAll());
  ipcMain.handle('shelves:findOne', async (_, id: number) => shelvesFindOneById(id));
  ipcMain.handle('shelves:findByBarcode', async (_, barcode: string) =>
    shelvesFindOneByBarcode(barcode),
  );
  ipcMain.handle('shelves:create', async (_, data: any) => shelvesCreate(data));
  ipcMain.handle('shelves:update', async (_, id: number, data: any) => shelvesUpdate(id, data));
  ipcMain.handle('shelves:remove', async (_, id: number) => shelvesRemove(id));
  ipcMain.handle('shelves:sell', async (_, data: any) => {
    const { barcode, quantity } = data;
    return await shelvesSell(barcode, quantity || 1);
  });
}
