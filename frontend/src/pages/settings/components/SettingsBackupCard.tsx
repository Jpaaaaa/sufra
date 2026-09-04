import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { showConfirm } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/Toast';
import { settingsUi } from '../settings-ui';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function SettingsBackupCard() {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuth();
  const api = window.sufra?.backup;

  const [enabled, setEnabled] = useState(true);
  const [scheduleHour, setScheduleHour] = useState(2);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunSizeBytes, setLastRunSizeBytes] = useState<number | null>(null);
  const [nextRunAt, setNextRunAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [backups, setBackups] = useState<
    Array<{ id: string; createdAt: string; sizeBytes: number; storeName: string }>
  >([]);
  const [inProgress, setInProgress] = useState(false);
  const [busy, setBusy] = useState<'save' | 'run' | 'restore' | null>(null);

  const loadStatus = useCallback(async () => {
    if (!api?.getStatus) return;
    const status = await api.getStatus();
    setEnabled(status.settings.enabled);
    setScheduleHour(status.settings.scheduleHour);
    setScheduleMinute(status.settings.scheduleMinute);
    setLastRunAt(status.settings.lastRunAt);
    setLastRunSizeBytes(status.settings.lastRunSizeBytes);
    setNextRunAt(status.settings.nextRunAt);
    setLastError(status.settings.lastError);
    setBackups(status.backups);
    setInProgress(status.inProgress);
  }, [api]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const saveSchedule = async () => {
    if (!api?.updateSettings) return;
    setBusy('save');
    try {
      await api.updateSettings({ enabled, scheduleHour, scheduleMinute });
      await loadStatus();
      showToast(t('settings.backupSaved'), 'success');
    } catch {
      showToast(t('settings.backupSaveFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    if (!api?.runNow) return;
    setBusy('run');
    try {
      const result = await api.runNow();
      if (result.ok) {
        showToast(t('settings.backupRunSuccess'), 'success');
      } else {
        showToast(t(`settings.backupError_${result.error}`, { defaultValue: result.error }), 'error');
      }
      await loadStatus();
    } finally {
      setBusy(null);
    }
  };

  const restore = async (backupId: string) => {
    if (!api?.restore || !token) return;
    const confirmed = await showConfirm({
      title: t('settings.backupRestoreConfirmTitle'),
      message: t('settings.backupRestoreConfirmMessage'),
      confirmText: t('settings.backupRestoreConfirmAction'),
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setBusy('restore');
    try {
      const result = await api.restore(backupId, token);
      if (!result.ok) {
        showToast(t(`settings.backupError_${result.error}`, { defaultValue: result.error }), 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  if (!api) {
    return (
      <div className={settingsUi.surface}>
        <div className={`${settingsUi.surfaceHead} ${settingsUi.surfaceHeadUpdates}`}>
          <div>
            <h2 className={settingsUi.surfaceTitle}>{t('settings.backupCardTitle')}</h2>
            <p className={settingsUi.surfaceLede}>{t('settings.backupCardLede')}</p>
          </div>
        </div>
        <div className={settingsUi.surfacePad}>
          <p className="rounded-soft-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[15px] font-medium text-amber-950">
            {t('settings.backupDesktopOnly')}
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className={settingsUi.surface}>
      <div className={`${settingsUi.surfaceHead} ${settingsUi.surfaceHeadUpdates}`}>
        <div>
          <h2 className={settingsUi.surfaceTitle}>{t('settings.backupCardTitle')}</h2>
          <p className={settingsUi.surfaceLede}>{t('settings.backupCardLede')}</p>
        </div>
        <button
          type="button"
          className={settingsUi.ctaPrimary}
          onClick={() => void runNow()}
          disabled={busy !== null || inProgress}
        >
          {busy === 'run' ? t('settings.backupRunning') : t('settings.backupRunNow')}
        </button>
      </div>

      <div className={`${settingsUi.surfacePad} space-y-6`}>
        <p className="rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/5 px-4 py-3 text-[14px] font-medium text-obsidian/80">
          {t('settings.backupProtectedNote')}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 px-4 py-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 text-cyber-aqua"
            />
            <span className="text-[15px] font-medium text-obsidian">{t('settings.backupEnableScheduled')}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2 rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 px-4 py-3">
            <span className="text-[14px] font-medium text-obsidian/70">{t('settings.backupScheduleTime')}</span>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleHour}
              onChange={(e) => setScheduleHour(Number(e.target.value))}
              className="w-14 rounded-soft border border-black/10 px-2 py-1 text-center text-[15px]"
            />
            <span>:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={scheduleMinute}
              onChange={(e) => setScheduleMinute(Number(e.target.value))}
              className="w-14 rounded-soft border border-black/10 px-2 py-1 text-center text-[15px]"
            />
            <button
              type="button"
              className={settingsUi.ctaSecondary}
              onClick={() => void saveSchedule()}
              disabled={busy !== null}
            >
              {busy === 'save' ? '…' : t('settings.backupSaveSchedule')}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className={settingsUi.metaPanel}>
            <p className={settingsUi.label}>{t('settings.backupLastRun')}</p>
            <p className="mt-2 text-[15px] font-semibold text-obsidian">
              {formatDateTime(lastRunAt, i18n.language)}
            </p>
            <p className="mt-1 text-[13px] text-obsidian/60">{formatBytes(lastRunSizeBytes)}</p>
          </div>
          <div className={settingsUi.metaPanel}>
            <p className={settingsUi.label}>{t('settings.backupNextRun')}</p>
            <p className="mt-2 text-[15px] font-semibold text-obsidian">
              {enabled ? formatDateTime(nextRunAt, i18n.language) : t('settings.backupDisabled')}
            </p>
          </div>
          <div className={settingsUi.metaPanel}>
            <p className={settingsUi.label}>{t('settings.backupLastError')}</p>
            <p className="mt-2 text-[15px] font-medium text-obsidian/80">
              {lastError ? t(`settings.backupError_${lastError}`, { defaultValue: lastError }) : '—'}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[16px] font-semibold text-obsidian">{t('settings.backupListTitle')}</h3>
          {backups.length === 0 ? (
            <p className="text-[14px] text-obsidian/60">{t('settings.backupListEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {backups.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-soft-lg border border-black/5 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-[15px] font-semibold text-obsidian">{b.storeName}</p>
                    <p className="text-[13px] text-obsidian/60">
                      {formatDateTime(b.createdAt, i18n.language)} · {formatBytes(b.sizeBytes)}
                    </p>
                    <p className="text-[12px] font-mono text-obsidian/45">{b.id}</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={settingsUi.ctaSecondary}
                      onClick={() => void restore(b.id)}
                      disabled={busy !== null || inProgress}
                    >
                      {t('settings.backupRestore')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
