import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getCurrentMachineId } from '../services/machineIdService';
import { getBackendApp } from '../state';
import type { BackupListItem, BackupRunResult } from '../shared/types/backup';
import { BACKUP_FORMAT_VERSION } from '../shared/types/backup';
import {
  BACKUP_ASSETS,
  PROTECTED_USER_DATA_FILES,
  backupFolderPath,
  formatBackupId,
  getBackupsRoot,
  getLiveAssetPath,
} from './backup-paths';
import { patchBackupSettings, readBackupSettings } from './backup-settings-store';
import { pruneOldBackups } from './prune-old-backups';
import { readRecipePrintBranding } from '../recipe-print-branding-store';

function dirSizeBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function folderSizeBytes(folder: string): number {
  if (!fs.existsSync(folder)) return 0;
  return dirSizeBytes(folder);
}

function checkpointDatabase(): void {
  const handle = getBackendApp();
  const db = handle?.db as { checkpointWal?: () => void } | undefined;
  if (db?.checkpointWal) {
    db.checkpointWal();
    return;
  }
  const conn = handle?.db as { getConnection?: () => { pragma: (s: string) => unknown } } | undefined;
  if (conn?.getConnection) {
    try {
      conn.getConnection().pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
      console.warn('[BACKUP] WAL checkpoint failed:', err);
    }
  }
}

function copyAssetToBackup(asset: (typeof BACKUP_ASSETS)[number], destRoot: string): boolean {
  const src = getLiveAssetPath(asset);
  if (!fs.existsSync(src)) return false;
  const dest = path.join(destRoot, asset);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
  return true;
}

async function resolveStoreName(): Promise<string> {
  try {
    const branding = await readRecipePrintBranding();
    if (branding.restaurantName?.trim()) return branding.restaurantName.trim();
  } catch {
    // ignore
  }
  return 'sufra pos';
}

export async function runBackup(): Promise<BackupRunResult> {
  const settings = readBackupSettings();
  const backupsRoot = getBackupsRoot();
  fs.mkdirSync(backupsRoot, { recursive: true });

  const backupId = formatBackupId(new Date());
  const destRoot = backupFolderPath(backupId);

  try {
    checkpointDatabase();
    fs.mkdirSync(destRoot, { recursive: true });

    const copied: string[] = [];
    for (const asset of BACKUP_ASSETS) {
      if (copyAssetToBackup(asset, destRoot)) copied.push(asset);
    }

    if (!copied.includes('sufra.sqlite')) {
      throw new Error('DATABASE_NOT_FOUND');
    }

    const machineId = await getCurrentMachineId();
    const storeName = await resolveStoreName();
    const manifest = {
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: app.getVersion(),
      createdAt: new Date().toISOString(),
      machineId,
      storeName,
      files: copied,
      protectedFilesExcluded: [...PROTECTED_USER_DATA_FILES],
    };
    fs.writeFileSync(path.join(destRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const sizeBytes = folderSizeBytes(destRoot);
    pruneOldBackups(settings.retentionCount);

    const now = new Date().toISOString();
    patchBackupSettings({
      lastRunAt: now,
      lastRunSizeBytes: sizeBytes,
      lastBackupId: backupId,
      lastError: null,
    });

    console.log('[BACKUP] ✓ Completed:', backupId, sizeBytes, 'bytes');
    return { ok: true, backupId, sizeBytes };
  } catch (err) {
    if (fs.existsSync(destRoot)) {
      fs.rmSync(destRoot, { recursive: true, force: true });
    }
    const message = err instanceof Error ? err.message : String(err);
    patchBackupSettings({ lastError: message });
    console.error('[BACKUP] ✗ Failed:', message);
    return { ok: false, error: message };
  }
}

export function listBackups(): BackupListItem[] {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return [];

  const items: BackupListItem[] = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.startsWith('backup-')) continue;
    const folder = path.join(root, name);
    if (!fs.statSync(folder).isDirectory()) continue;
    let createdAt = name.replace(/^backup-/, '').replace('_', 'T') + ':00.000Z';
    let storeName = 'sufra pos';
    const manifestPath = path.join(folder, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.createdAt) createdAt = m.createdAt;
        if (m.storeName) storeName = m.storeName;
      } catch {
        // ignore
      }
    }
    items.push({
      id: name,
      createdAt,
      sizeBytes: folderSizeBytes(folder),
      storeName,
    });
  }

  return items.sort((a, b) => b.id.localeCompare(a.id));
}
