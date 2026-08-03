import path from 'path';
import { app } from 'electron';
import type { BackupAssetKey } from '../shared/types/backup';

export const BACKUPS_DIR_NAME = 'sufra-lite';
export const BACKUPS_SUBDIR = 'backups';
export const BACKUP_FOLDER_PREFIX = 'backup-';

/**
 * Files that must NEVER be copied into backups or overwritten by restore.
 * Keeps license validation, platform sync, and electron-updater state intact.
 */
export const PROTECTED_USER_DATA_FILES: readonly string[] = [
  'license.json',
  'license-rolling-sync-cache.json',
  'license-platform-grant-cache.json',
  'platform-license-url.txt',
  'backup-settings.json',
];

/** Directories under userData that must never be touched by backup/restore. */
export const PROTECTED_USER_DATA_DIRS: readonly string[] = [
  'backups',
  'logs',
  'pending',
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
];

export const BACKUP_ASSETS: readonly BackupAssetKey[] = [
  'sufra.sqlite',
  'recipe-print-branding.json',
  'uploads',
];

export function getUserDataPath(): string {
  return app.getPath('userData');
}

export function getBackupsRoot(): string {
  return path.join(getUserDataPath(), BACKUPS_DIR_NAME, BACKUPS_SUBDIR);
}

export function getBackupSettingsPath(): string {
  return path.join(getUserDataPath(), 'backup-settings.json');
}

export function getLiveAssetPath(asset: BackupAssetKey): string {
  return path.join(getUserDataPath(), asset);
}

export function isProtectedUserDataEntry(name: string): boolean {
  if (PROTECTED_USER_DATA_FILES.includes(name)) return true;
  if (PROTECTED_USER_DATA_DIRS.includes(name)) return true;
  if (name.startsWith('pending-update')) return true;
  if (name.startsWith('.pre-restore-')) return true;
  return false;
}

export function formatBackupId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FOLDER_PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function backupFolderPath(backupId: string): string {
  return path.join(getBackupsRoot(), backupId);
}
