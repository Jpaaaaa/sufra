/**
 * IPC handlers: halls, floors, kitchens.
 */
import { ipcMain } from 'electron';
import {
  hallsFindAll,
  hallsFindOne,
  hallsCreate,
  hallsUpdate,
  hallsRemove,
  floorsFindAll,
  floorsFindOne,
  floorsCreate,
  floorsUpdate,
  floorsRemove,
  kitchensFindAll,
  kitchensFindOne,
  kitchensCreate,
  kitchensUpdate,
  kitchensRemove,
} from '../../init/backend-loader';

export function registerVenueHandlers() {
  ipcMain.handle('halls:findAll', async () => hallsFindAll());
  ipcMain.handle('halls:findOne', async (_, id: number) => hallsFindOne(id));
  ipcMain.handle('halls:create', async (_, data: any) => hallsCreate(data));
  ipcMain.handle('halls:update', async (_, id: number, data: any) => hallsUpdate(id, data));
  ipcMain.handle('halls:remove', async (_, id: number) => hallsRemove(id));

  ipcMain.handle('floors:findAll', async () => floorsFindAll());
  ipcMain.handle('floors:findOne', async (_, id: number) => floorsFindOne(id));
  ipcMain.handle('floors:create', async (_, data: any) => floorsCreate(data));
  ipcMain.handle('floors:update', async (_, id: number, data: any) => floorsUpdate(id, data));
  ipcMain.handle('floors:remove', async (_, id: number) => floorsRemove(id));

  ipcMain.handle('kitchens:findAll', async () => kitchensFindAll());
  ipcMain.handle('kitchens:findOne', async (_, id: number) => kitchensFindOne(id));
  ipcMain.handle('kitchens:create', async (_, data: any) => kitchensCreate(data));
  ipcMain.handle('kitchens:update', async (_, id: number, data: any) =>
    kitchensUpdate(id, data),
  );
  ipcMain.handle('kitchens:remove', async (_, id: number) => kitchensRemove(id));
}
