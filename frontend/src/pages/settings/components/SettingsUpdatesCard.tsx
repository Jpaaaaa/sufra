import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../components/ui/ConfirmDialog';
import type { AppUpdateActionResult, AppUpdateState } from '../../../types/app-update';
import { settingsUi } from '../settings-ui';
import { humanizeUpdateErrorMessage } from './settings-update-error';

function formatMbPerSec(bytesPerSecond: number): string {
  const mb = bytesPerSecond / (1024 * 1024);
  return mb >= 10 ? mb.toFixed(0) : mb.toFixed(1);
}

function formatDateTime(ms: number, locale: string): string {
  try {
    return new Date(ms).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return new Date(ms).toISOString();
  }
}

function MetaBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={settingsUi.metaPanel}>
      <p className={settingsUi.label}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function SettingsUpdatesCard() {
  const { t, i18n } = useTranslation();
  const [upd, setUpd] = useState<AppUpdateState | null>(null);
  const [busy, setBusy] = useState<null | 'check' | 'download' | 'install'>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const api = window.amaan;
    if (!api?.updateGetState) return;
    void api.updateGetState().then((raw) => setUpd(raw as AppUpdateState));
    const unsub = api.updateOnStateChange?.((s) => setUpd(s as AppUpdateState));
    return () => {
      unsub?.();
    };
  }, []);

  if (!window.amaan?.updateGetState) return null;

  async function onCheck() {
    const api = window.amaan;
    if (!api?.updateCheckNow) return;
    setBusy('check');
    setToast(null);
    const r = (await api.updateCheckNow()) as AppUpdateActionResult;
    setBusy(null);
    if (!r.ok && r.error !== 'DEV_MODE' && r.error !== 'NO_FEED') {
      setToast(t('settings.updatesErrCheck'));
    }
  }

  async function onDownload() {
    const api = window.amaan;
    if (!api?.updateDownload) return;
    setBusy('download');
    setToast(null);
    const r = (await api.updateDownload()) as AppUpdateActionResult;
    setBusy(null);
    if (!r.ok) setToast(t('settings.updatesErrDownload'));
  }

  async function onInstall() {
    const api = window.amaan;
    if (!api?.updateInstallNow) return;
    setBusy('install');
    setToast(null);
    const r = (await api.updateInstallNow()) as AppUpdateActionResult;
    setBusy(null);
    if (!r.ok) setToast(t('settings.updatesErrInstall'));
  }

  const status = upd?.status ?? 'idle';
  const showDownloadBtn = status === 'available' || (status === 'error' && upd?.availableVersion);
  const showInstallBtn = status === 'downloaded';
  const disabled = status === 'disabled';

  function statusText(): string {
    switch (status) {
      case 'idle':
        return t('settings.updatesStatusIdle');
      case 'checking':
        return t('settings.updatesStatusChecking');
      case 'up-to-date':
        return t('settings.updatesStatusUpToDate');
      case 'available':
        return t('settings.updatesStatusAvailable', { version: upd?.availableVersion ?? '—' });
      case 'downloading': {
        const percent = Math.round(upd?.progress?.percent ?? 0);
        return t('settings.updatesStatusDownloading', { percent: String(percent) });
      }
      case 'downloaded':
        return t('settings.updatesStatusDownloaded', { version: upd?.availableVersion ?? '—' });
      case 'error':
        return t('settings.updatesStatusError');
      case 'disabled':
        return t('settings.updatesStatusDisabled');
      default:
        return '';
    }
  }

  const statusTone: 'neutral' | 'ok' | 'warn' | 'err' | 'info' =
    status === 'up-to-date'
      ? 'ok'
      : status === 'available' || status === 'downloaded'
        ? 'warn'
        : status === 'error'
          ? 'err'
          : status === 'checking' || status === 'downloading'
            ? 'info'
            : 'neutral';

  const statusBoxClass =
    statusTone === 'ok'
      ? 'border-emerald-200/80 bg-emerald-50/70'
      : statusTone === 'warn'
        ? 'border-amber-200/80 bg-amber-50/70'
        : statusTone === 'err'
          ? 'border-rose-200/80 bg-rose-50/70'
          : statusTone === 'info'
            ? 'border-cyber-aqua/30 bg-cyber-aqua/10'
            : 'border-black/5 bg-cloud-soft-white';

  const statusTextClass =
    statusTone === 'ok'
      ? 'text-emerald-900'
      : statusTone === 'warn'
        ? 'text-amber-950'
        : statusTone === 'err'
          ? 'text-rose-900'
          : statusTone === 'info'
            ? 'text-obsidian'
            : 'text-obsidian/80';

  const errRaw = status === 'error' ? (upd?.errorMessage ?? '') : '';
  const errFriendly = status === 'error' ? humanizeUpdateErrorMessage(errRaw, t) : null;

  return (
    <section className={settingsUi.surface} aria-label={t('settings.updatesCardTitle')}>
      <div className={`${settingsUi.surfaceHead} ${settingsUi.surfaceHeadUpdates}`}>
        <div className="min-w-0 flex-1">
          <h2 className={settingsUi.surfaceTitle}>{t('settings.updatesCardTitle')}</h2>
          <p className={settingsUi.surfaceLede}>{t('settings.updatesCardLede')}</p>
        </div>
      </div>
      <div className={settingsUi.surfacePad}>
        {!upd ? (
          <div className="h-24 animate-pulse rounded-soft-lg bg-cloud-soft-white" aria-busy="true" />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <MetaBox label={t('settings.updatesCurrentVersion')}>
                <p dir="ltr" className="font-mono text-xl font-bold text-obsidian">
                  {upd.currentVersion ?? '—'}
                </p>
              </MetaBox>
              <MetaBox label={t('settings.updatesLastCheck')}>
                <p className="text-[14px] font-semibold text-obsidian/85">
                  {upd.lastCheckedAtMs
                    ? formatDateTime(upd.lastCheckedAtMs, i18n.language)
                    : t('settings.updatesNeverChecked')}
                </p>
              </MetaBox>
            </div>

            <div className={`rounded-soft-lg border px-5 py-4 shadow-soft ${statusBoxClass}`} role="status" aria-live="polite">
              <p className={`text-[14px] font-semibold leading-relaxed ${statusTextClass}`}>{statusText()}</p>
              {status === 'downloading' && upd.progress ? (
                <div className="mt-3 space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full bg-cyber-aqua transition-[width] duration-300"
                      style={{ width: `${Math.round(upd.progress.percent)}%` }}
                    />
                  </div>
                  {upd.progress.bytesPerSecond > 0 ? (
                    <p className="text-[12px] font-medium text-obsidian/80" dir="ltr">
                      {t('settings.updatesProgressSpeed', { mb: formatMbPerSec(upd.progress.bytesPerSecond) })}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {status === 'error' && errRaw ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[14px] font-medium leading-relaxed text-rose-900">
                    {errFriendly ?? errRaw}
                  </p>
                  {errFriendly && errFriendly !== errRaw ? (
                    <details className="rounded-soft-lg border border-black/5 bg-white/60 px-3 py-2">
                      <summary className="cursor-pointer text-[12px] font-semibold text-obsidian/70">
                        {t('settings.updatesTechnicalDetails')}
                      </summary>
                      <p className="mt-2 break-words font-mono text-[11px] font-medium text-rose-800/90" dir="ltr">
                        {errRaw}
                      </p>
                    </details>
                  ) : !errFriendly ? (
                    <p className="break-words font-mono text-[12px] font-medium text-rose-800" dir="ltr">
                      {errRaw}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {status === 'disabled' && upd.errorMessage ? (
                <p className="mt-2 text-[12px] font-medium text-obsidian/70">{upd.errorMessage}</p>
              ) : null}
            </div>

            {upd.feedUrl ? (
              <MetaBox label={t('settings.updatesFeedUrl')}>
                <p dir="ltr" className="break-all font-mono text-[12px] font-medium text-obsidian">
                  {upd.feedUrl}
                </p>
              </MetaBox>
            ) : disabled ? (
              <div className="rounded-soft-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                <p className="text-[14px] font-medium text-amber-950">{t('settings.updatesFeedMissing')}</p>
              </div>
            ) : null}

            {toast ? (
              <div className="rounded-soft-lg border border-rose-200/80 bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-900">
                {toast}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-black/5 pt-5">
              <button
                type="button"
                onClick={() => void onCheck()}
                disabled={disabled || busy !== null || status === 'checking' || status === 'downloading'}
                className={settingsUi.ctaSecondary}
              >
                {busy === 'check' || status === 'checking' ? '…' : t('settings.updatesCheckNow')}
              </button>
              {showDownloadBtn ? (
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  disabled={busy !== null}
                  className={settingsUi.ctaPrimary}
                >
                  {busy === 'download' ? '…' : t('settings.updatesDownload')}
                </button>
              ) : null}
              {showInstallBtn ? (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const ok = await showConfirm({
                        title: t('settings.updatesConfirmInstallTitle'),
                        message: t('settings.updatesConfirmInstallBody'),
                        confirmText: t('settings.updatesConfirmInstallConfirm'),
                        cancelText: t('settings.updatesConfirmInstallCancel'),
                        confirmColor: 'primary',
                      });
                      if (ok) void onInstall();
                    })();
                  }}
                  disabled={busy !== null}
                  className={settingsUi.ctaPrimary}
                >
                  {busy === 'install' ? '…' : t('settings.updatesInstall')}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
