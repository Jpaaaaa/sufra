export const BACKUP_FORMAT_VERSION = 1;

/** Assets included in each snapshot (POS data only). */
export type BackupAssetKey = 'sufra.sqlite' | 'recipe-print-branding.json' | 'uploads';

export type BackupManifest = {
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  machineId: string;
  storeName: string;
  files: BackupAssetKey[];
  /** Document which userData files are intentionally excluded to preserve license + updates. */
  protectedFilesExcluded: string[];
};

export type BackupSettings = {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  retentionCount: number;
  lastRunAt: string | null;
  lastRunSizeBytes: number | null;
  lastBackupId: string | null;
  lastError: string | null;
  nextRunAt: string | null;
};

export type BackupListItem = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  storeName: string;
};

export type BackupRunResult =
  | { ok: true; backupId: string; sizeBytes: number }
  | { ok: false; error: string };

export type BackupRestoreResult = { ok: true } | { ok: false; error: string };

export type BackupStatus = {
  settings: BackupSettings;
  inProgress: boolean;
  backups: BackupListItem[];
};
