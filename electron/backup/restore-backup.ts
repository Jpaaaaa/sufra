import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { shutdownBackend } from '../init/backend-loader';
import { setBackendApp, getBackendApp } from '../state';
import type { BackupRestoreResult } from '../shared/types/backup';
import {
  BACKUP_ASSETS,
  backupFolderPath,
  getLiveAssetPath,
  isProtectedUserDataEntry,
} from './backup-paths';
import { assertAdminAccessToken } from './validate-admin-token';

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function renameLiveToPreRestore(livePath: string, suffix: string): void {
  if (!fs.existsSync(livePath)) return;
  const parent = path.dirname(livePath);
  const base = path.basename(livePath);
  const dest = path.join(parent, `.pre-restore-${suffix}-${base}`);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.renameSync(livePath, dest);
}

function copyFromBackup(asset: (typeof BACKUP_ASSETS)[number], backupRoot: string): void {
  const src = path.join(backupRoot, asset);
  if (!fs.existsSync(src)) return;
  const dest = getLiveAssetPath(asset);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function validateBackupFolder(backupRoot: string): void {
  const manifestPath = path.join(backupRoot, 'manifest.json');
  const dbPath = path.join(backupRoot, 'sufra.sqlite');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(dbPath)) {
    throw new Error('INVALID_BACKUP');
  }
  for (const name of fs.readdirSync(backupRoot)) {
    if (isProtectedUserDataEntry(name)) {
      throw new Error('BACKUP_CONTAINS_PROTECTED_FILES');
    }
  }
}

export async function restoreBackup(backupId: string, accessToken: string): Promise<BackupRestoreResult> {
  await assertAdminAccessToken(accessToken);

  const backupRoot = backupFolderPath(backupId);
  if (!fs.existsSync(backupRoot)) {
    return { ok: false, error: 'BACKUP_NOT_FOUND' };
  }

  try {
    validateBackupFolder(backupRoot);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const suffix = stamp();

  try {
    if (getBackendApp()) {
      await shutdownBackend();
      setBackendApp(null);
    }

    for (const asset of BACKUP_ASSETS) {
      renameLiveToPreRestore(getLiveAssetPath(asset), suffix);
    }

    for (const asset of BACKUP_ASSETS) {
      copyFromBackup(asset, backupRoot);
    }

    if (!fs.existsSync(getLiveAssetPath('sufra.sqlite'))) {
      throw new Error('RESTORE_DB_MISSING');
    }

    console.log('[BACKUP] ✓ Restore complete, relaunching…');
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[BACKUP] ✗ Restore failed:', message);
    return { ok: false, error: message };
  }
}
