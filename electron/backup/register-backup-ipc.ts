import { ipcMain } from 'electron';
import type { BackupSettings, BackupStatus } from '../shared/types/backup';
import { patchBackupSettings, readBackupSettings } from './backup-settings-store';
import { listBackups, runBackup } from './run-backup';
import { restoreBackup } from './restore-backup';
import { refreshBackupScheduler } from './backup-scheduler';
import { isBackupLockHeld, withBackupLockAsync } from './with-backup-lock';

let registered = false;

export function registerBackupIpc(): void {
  if (registered) return;
  registered = true;

  ipcMain.removeHandler('backup:getSettings');
  ipcMain.removeHandler('backup:updateSettings');
  ipcMain.removeHandler('backup:runNow');
  ipcMain.removeHandler('backup:list');
  ipcMain.removeHandler('backup:getStatus');
  ipcMain.removeHandler('backup:restore');

  ipcMain.handle('backup:getSettings', (): BackupSettings => readBackupSettings());

  ipcMain.handle('backup:updateSettings', (_e, patch: Partial<BackupSettings>): BackupSettings => {
    const next = patchBackupSettings(patch);
    refreshBackupScheduler();
    return next;
  });

  ipcMain.handle('backup:runNow', async () => {
    if (isBackupLockHeld()) {
      return { ok: false as const, error: 'BACKUP_IN_PROGRESS' };
    }
    return withBackupLockAsync(() => runBackup());
  });

  ipcMain.handle('backup:list', () => listBackups());

  ipcMain.handle('backup:getStatus', (): BackupStatus => ({
    settings: readBackupSettings(),
    inProgress: isBackupLockHeld(),
    backups: listBackups(),
  }));

  ipcMain.handle('backup:restore', async (_e, backupId: string, accessToken: string) => {
    if (isBackupLockHeld()) {
      return { ok: false as const, error: 'BACKUP_IN_PROGRESS' };
    }
    return withBackupLockAsync(() => restoreBackup(backupId, accessToken));
  });

  console.log('[BACKUP] ✓ IPC handlers registered');
}
