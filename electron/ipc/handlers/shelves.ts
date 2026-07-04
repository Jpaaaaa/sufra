/**
 * IPC handlers: shelves.
 */
import { ipcMain } from 'electron';
import { getService, ShelvesService } from '../../init/backend-loader';

export function registerShelvesHandlers() {
  ipcMain.handle('shelves:findAll', async () => getService(ShelvesService).findAll());
  ipcMain.handle('shelves:findOne', async (_, id: number) => getService(ShelvesService).findOneById(id));
  ipcMain.handle('shelves:findByBarcode', async (_, barcode: string) => getService(ShelvesService).findOneByBarcode(barcode));
  ipcMain.handle('shelves:create', async (_, data: any) => getService(ShelvesService).create(data));
  ipcMain.handle('shelves:update', async (_, id: number, data: any) => getService(ShelvesService).update(id, data));
  ipcMain.handle('shelves:remove', async (_, id: number) => getService(ShelvesService).remove(id));
  ipcMain.handle('shelves:sell', async (_, data: any) => {
    const { barcode, quantity } = data;
    return await getService(ShelvesService).sell(barcode, quantity || 1);
  });
}
