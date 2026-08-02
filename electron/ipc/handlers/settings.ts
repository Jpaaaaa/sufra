/**
 * IPC handlers: app settings (shift mode, definitions).
 */
import { ipcMain } from 'electron';
import {
  settingsGetShiftHours,
  settingsUpdateShiftHours,
  settingsGetShiftDefinitions,
  settingsCreateShiftDefinition,
  settingsUpdateShiftDefinition,
  settingsRemoveShiftDefinition,
  settingsReplaceShiftDefinitions,
} from '../../init/backend-loader';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getShiftHours', async () => settingsGetShiftHours());
  ipcMain.handle('settings:updateShiftHours', async (_, data: Record<string, unknown>) =>
    settingsUpdateShiftHours(data),
  );
  ipcMain.handle('settings:getShiftDefinitions', async () => settingsGetShiftDefinitions());
  ipcMain.handle('settings:createShiftDefinition', async (_, data: Record<string, unknown>) =>
    settingsCreateShiftDefinition(data),
  );
  ipcMain.handle('settings:updateShiftDefinition', async (_, id: number, data: Record<string, unknown>) =>
    settingsUpdateShiftDefinition(id, data),
  );
  ipcMain.handle('settings:removeShiftDefinition', async (_, id: number) =>
    settingsRemoveShiftDefinition(id),
  );
  ipcMain.handle('settings:replaceShiftDefinitions', async (_, shifts: Record<string, unknown>[]) =>
    settingsReplaceShiftDefinitions(shifts),
  );
}
