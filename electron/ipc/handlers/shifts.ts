/**
 * IPC handlers for shifts.
 */
import { ipcMain } from 'electron';
import {
  shiftsGetAllShifts,
  shiftsGetActiveShift,
  shiftsGetShiftById,
  shiftsStartShift,
  shiftsFinishShift,
} from '../../init/backend-loader';

export function registerShiftsHandlers() {
  ipcMain.handle('shifts:findAll', async (_, limit?: number) => shiftsGetAllShifts(limit));
  ipcMain.handle('shifts:findOne', async (_, id: number) => shiftsGetShiftById(id));
  ipcMain.handle('shifts:getCurrent', async () => shiftsGetActiveShift());
  ipcMain.handle('shifts:start', async (_, userId: number) => {
    if (typeof userId !== 'number') {
      throw new Error('userId (number) required');
    }
    return await shiftsStartShift(userId);
  });
  ipcMain.handle('shifts:end', async (_, userId: number) => {
    if (typeof userId !== 'number') {
      throw new Error('userId (number) required');
    }
    return await shiftsFinishShift(userId);
  });
}
