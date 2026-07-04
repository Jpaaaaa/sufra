/**
 * IPC handlers: halls, floors, kitchens.
 */
import { ipcMain } from 'electron';
import { getService, HallsService, FloorsService, KitchensService } from '../../init/backend-loader';

export function registerVenueHandlers() {
  ipcMain.handle('halls:findAll', async () => getService(HallsService).findAll());
  ipcMain.handle('halls:findOne', async (_, id: number) => getService(HallsService).findOne(id));
  ipcMain.handle('halls:create', async (_, data: any) => getService(HallsService).create(data));
  ipcMain.handle('halls:update', async (_, id: number, data: any) => getService(HallsService).update(id, data));
  ipcMain.handle('halls:remove', async (_, id: number) => getService(HallsService).remove(id));

  ipcMain.handle('floors:findAll', async () => getService(FloorsService).findAll());
  ipcMain.handle('floors:findOne', async (_, id: number) => getService(FloorsService).findOne(id));
  ipcMain.handle('floors:create', async (_, data: any) => getService(FloorsService).create(data));
  ipcMain.handle('floors:update', async (_, id: number, data: any) => getService(FloorsService).update(id, data));
  ipcMain.handle('floors:remove', async (_, id: number) => getService(FloorsService).remove(id));

  ipcMain.handle('kitchens:findAll', async () => getService(KitchensService).findAll());
  ipcMain.handle('kitchens:findOne', async (_, id: number) => getService(KitchensService).findOne(id));
  ipcMain.handle('kitchens:create', async (_, data: any) => getService(KitchensService).create(data));
  ipcMain.handle('kitchens:update', async (_, id: number, data: any) => getService(KitchensService).update(id, data));
  ipcMain.handle('kitchens:remove', async (_, id: number) => getService(KitchensService).remove(id));
}
