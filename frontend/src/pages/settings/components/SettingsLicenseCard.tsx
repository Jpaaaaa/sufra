import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatLicenseCountdownDisplay, type LicenseCountdownDisplayFormat } from '../../../license/format-license-countdown';
import type { LicenseGetStatusResponse, LicenseTierId } from '../../../license/types';
import { useLicenseMonotonicNow } from '../../../license/useLicenseMonotonicNow';
import { useLicenseCountdownFormat } from '../../../license/useLicenseCountdownFormat';
import { settingsUi } from '../settings-ui';

function formatDateTime(ms: number, locale: string): string {
  try {
    return new Date(ms).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return new Date(ms).toISOString();
  }
}

function tierLabel(t: (k: string) => string, tier: LicenseTierId | undefined): string {
  if (!tier) return '—';
  const key = `settings.licenseTier_${tier}` as const;
  const s = t(key);
  return s === key ? tier : s;
}

function denyReasonMessage(t: (k: string) => string, st: LicenseGetStatusResponse): string {
  if (st.reason === 'platform_denied' && st.platform?.message?.trim()) {
    return st.platform.message.trim();
  }
  const key = `settings.licenseReason_${st.reason}`;
  const s = t(key);
  return s === key ? t('settings.licenseReason_unknown') : s;
}

function MetaBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={settingsUi.metaPanel}>
      <p className={settingsUi.label}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function SettingsLicenseCard() {
  const { t, i18n } = useTranslation();
  const [countdownFormat, setCountdownFormat] = useLicenseCountdownFormat();
  const [lic, setLic] = useState<LicenseGetStatusResponse | null>(null);
  const now = useLicenseMonotonicNow(lic?.effectiveNowMs);

  useEffect(() => {
    const api = window.amaan;
    if (!api?.licenseGetStatus) return;
    void api.licenseGetStatus().then((raw) => setLic(raw as LicenseGetStatusResponse));
  }, []);

  if (!window.amaan?.licenseGetStatus) return null;

  return (
    <section className={settingsUi.surface} aria-label={t('settings.licenseCardTitle')}>
      <div className={`${settingsUi.surfaceHead} ${settingsUi.surfaceHeadLicense}`}>
        <h2 className={settingsUi.surfaceTitle}>{t('settings.licenseCardTitle')}</h2>
        {lic?.ok === true ? (
          <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-emerald-900">
            {t('settings.licenseBadgeOk')}
          </span>
        ) : null}
      </div>
      <div className={settingsUi.surfacePad}>
        {!lic ? (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div className="h-14 rounded-soft-lg bg-cloud-soft-white" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-24 rounded-soft-lg bg-cloud-soft-white" />
              <div className="h-24 rounded-soft-lg bg-cloud-soft-white" />
            </div>
          </div>
        ) : !lic.enforced ? (
          <p className="text-[15px] font-medium text-obsidian/75">{t('settings.licenseNotEnforced')}</p>
        ) : !lic.ok ? (
          <div className="space-y-4">
            <div className="rounded-soft-lg border border-rose-200/80 bg-rose-50/80 px-4 py-3">
              <p className="text-[15px] font-semibold text-rose-900">{denyReasonMessage(t, lic)}</p>
            </div>
            {lic.platform?.enabled && lic.platform.reachable === false ? (
              <div className="rounded-soft-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                <p className="text-[14px] font-medium text-amber-950">{t('settings.licensePlatformOffline')}</p>
              </div>
            ) : null}
            <MetaBox label={t('settings.licenseMachineId')}>
              <p dir="ltr" className="break-all font-mono text-[14px] font-semibold text-obsidian">
                {lic.machineId}
              </p>
            </MetaBox>
            <NavLink to="/license" className={settingsUi.ctaPrimary}>
              {t('settings.licenseOpenActivation')}
            </NavLink>
          </div>
        ) : (
          <div className="space-y-6">
            {lic.platform?.enabled && lic.platform.reachable === false ? (
              <div className="rounded-soft-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                <p className="text-[14px] font-medium text-amber-950">{t('settings.licensePlatformOffline')}</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <MetaBox label={t('settings.licenseMachineId')}>
                <p dir="ltr" className="break-all font-mono text-[14px] font-semibold text-obsidian">
                  {lic.machineId}
                </p>
              </MetaBox>
              <MetaBox label={t('settings.licensePlan')}>
                <p className="text-[18px] font-semibold text-obsidian">{tierLabel(t, lic.tier)}</p>
                {lic.expiresAtMs == null ? (
                  <p className="mt-2 text-[14px] font-medium text-emerald-800">{t('settings.licenseLifetime')}</p>
                ) : (
                  <p className="mt-2 text-[14px] font-medium text-obsidian/70">
                    {t('settings.licenseExpiresLabel')}{' '}
                    <span dir="ltr" className="font-mono text-obsidian">
                      {formatDateTime(lic.expiresAtMs, i18n.language)}
                    </span>
                  </p>
                )}
              </MetaBox>
            </div>

            <label className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-obsidian/80">
              <span className="shrink-0">{t('settings.licenseCountdownFormatLabel')}</span>
              <select
                className="min-w-[12rem] rounded-full border border-black/10 bg-white px-3 py-2 text-[14px] font-semibold text-obsidian"
                value={countdownFormat}
                onChange={(e) => setCountdownFormat(e.target.value as LicenseCountdownDisplayFormat)}
                aria-label={t('settings.licenseCountdownFormatLabel')}
              >
                <option value="days_minutes">{t('settings.licenseCountdownFormatDaysMinutes')}</option>
                <option value="stopwatch">{t('settings.licenseCountdownFormatStopwatch')}</option>
              </select>
            </label>

            {(() => {
              const exp = lic.expiresAtMs;
              const showLicenseTick = exp != null && Number.isFinite(exp);
              const syncBefore = lic.platform?.nextRequiredSyncBeforeMs;
              const showSyncTick =
                lic.platform?.reachable === false &&
                syncBefore != null &&
                Number.isFinite(syncBefore);
              const grid2 = showSyncTick && (showLicenseTick || exp == null);

              return (
                <div className={grid2 ? 'grid gap-4 sm:grid-cols-2' : 'flex max-w-xl flex-col gap-4'}>
                  {showLicenseTick ? (
                    <div className="relative overflow-hidden rounded-soft-xl border border-cyber-aqua/25 bg-gradient-to-br from-cyber-aqua/10 via-white to-cloud-soft-white p-5 shadow-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-obsidian/55">
                        {t('settings.licenseCountdownExpires')}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-3 font-mono text-3xl font-bold tabular-nums tracking-tight text-obsidian sm:text-4xl"
                        aria-live="polite"
                      >
                        {formatLicenseCountdownDisplay(exp - now, countdownFormat)}
                      </p>
                      <p className="mt-4 border-t border-black/5 pt-3 text-[12px] font-medium text-obsidian/65">
                        {t('settings.licenseExpiresLabel')}{' '}
                        <span dir="ltr" className="font-mono text-obsidian">
                          {formatDateTime(exp, i18n.language)}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`rounded-soft-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-soft ${
                        showSyncTick ? '' : 'max-w-xl'
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/90">
                        {t('settings.licensePlan')}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-emerald-900">{t('settings.licenseLifetime')}</p>
                    </div>
                  )}

                  {showSyncTick ? (
                    <div className="relative overflow-hidden rounded-soft-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-5 shadow-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                        {t('settings.licenseCountdownSync')}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-3 font-mono text-2xl font-bold tabular-nums text-amber-950 sm:text-3xl"
                        aria-live="polite"
                      >
                        {formatLicenseCountdownDisplay(syncBefore - now, countdownFormat)}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div className="border-t border-black/5 pt-5">
              <NavLink to="/license" className={settingsUi.ctaSecondary}>
                {t('settings.licenseOpenActivation')}
              </NavLink>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
