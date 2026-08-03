import type { BackupSettings } from '../shared/types/backup';
import { readBackupSettings, patchBackupSettings } from './backup-settings-store';
import { runBackup } from './run-backup';
import { isBackupLockHeld, withBackupLockAsync } from './with-backup-lock';

let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

function computeNextRunMs(settings: BackupSettings, from = Date.now()): number {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(settings.scheduleHour, settings.scheduleMinute, 0, 0);
  if (next.getTime() <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

function clearScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

async function runScheduledBackup(): Promise<void> {
  if (isBackupLockHeld()) return;
  await withBackupLockAsync(async () => {
    await runBackup();
  });
}

function scheduleNext(settings: BackupSettings): void {
  clearScheduler();
  if (!settings.enabled) {
    patchBackupSettings({ nextRunAt: null });
    return;
  }

  const nextMs = computeNextRunMs(settings);
  patchBackupSettings({ nextRunAt: new Date(nextMs).toISOString() });

  const delay = Math.max(0, nextMs - Date.now());
  timer = setTimeout(() => {
    void runScheduledBackup().then(() => {
      interval = setInterval(() => {
        void runScheduledBackup();
      }, 24 * 60 * 60 * 1000);
    });
  }, delay);
}

export function refreshBackupScheduler(): void {
  scheduleNext(readBackupSettings());
}

export function startBackupScheduler(): void {
  refreshBackupScheduler();
}

export function stopBackupScheduler(): void {
  clearScheduler();
}
