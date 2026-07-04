/**
 * IPC handlers: shifts.
 */
import { ipcMain } from 'electron';
import { getService, ShiftsService } from '../../init/backend-loader';

export function registerShiftsHandlers() {
  ipcMain.handle('shifts:findAll', async (_, limit?: number) => getService(ShiftsService).getAllShifts(limit));
  ipcMain.handle('shifts:findOne', async (_, id: number) => getService(ShiftsService).getShiftById(id));
  ipcMain.handle('shifts:getCurrent', async () => getService(ShiftsService).getActiveShift());
  ipcMain.handle('shifts:start', async (_, data: any) => {
    const userId = data?.userId || data?.user_id || data;
    if (typeof userId !== 'number') throw new Error('shifts:start requires userId (number)');
    return await getService(ShiftsService).startShift(userId);
  });
  ipcMain.handle('shifts:end', async (_, data: any) => {
    const userId = data?.userId || data?.user_id || data;
    if (typeof userId !== 'number') throw new Error('shifts:end requires userId (number)');
    return await getService(ShiftsService).finishShift(userId);
  });
}
