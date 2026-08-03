import path from 'path';
import fs from 'fs';
import type { BackupSettings } from '../shared/types/backup';
import { getBackupSettingsPath } from './backup-paths';

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  scheduleHour: 2,
  scheduleMinute: 0,
  retentionCount: 7,
  lastRunAt: null,
  lastRunSizeBytes: null,
  lastBackupId: null,
  lastError: null,
  nextRunAt: null,
};

function clampRetention(n: number): number {
  return Math.min(30, Math.max(1, Math.round(n)));
}

function clampHour(n: number): number {
  return Math.min(23, Math.max(0, Math.round(n)));
}

function clampMinute(n: number): number {
  return Math.min(59, Math.max(0, Math.round(n)));
}

export function readBackupSettings(): BackupSettings {
  const fp = getBackupSettingsPath();
  if (!fs.existsSync(fp)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as Partial<BackupSettings>;
    return {
      enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
      scheduleHour: clampHour(raw.scheduleHour ?? DEFAULT_SETTINGS.scheduleHour),
      scheduleMinute: clampMinute(raw.scheduleMinute ?? DEFAULT_SETTINGS.scheduleMinute),
      retentionCount: clampRetention(raw.retentionCount ?? DEFAULT_SETTINGS.retentionCount),
      lastRunAt: raw.lastRunAt ?? null,
      lastRunSizeBytes: raw.lastRunSizeBytes ?? null,
      lastBackupId: raw.lastBackupId ?? null,
      lastError: raw.lastError ?? null,
      nextRunAt: raw.nextRunAt ?? null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeBackupSettings(settings: BackupSettings): void {
  const fp = getBackupSettingsPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(settings, null, 2), 'utf8');
}

export function patchBackupSettings(patch: Partial<BackupSettings>): BackupSettings {
  const next = { ...readBackupSettings(), ...patch };
  next.scheduleHour = clampHour(next.scheduleHour);
  next.scheduleMinute = clampMinute(next.scheduleMinute);
  next.retentionCount = clampRetention(next.retentionCount);
  writeBackupSettings(next);
  return next;
}

export function getDefaultBackupSettings(): BackupSettings {
  return { ...DEFAULT_SETTINGS };
}
