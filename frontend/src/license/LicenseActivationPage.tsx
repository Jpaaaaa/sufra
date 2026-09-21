import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/i18n/LanguageSwitcher'
import {
  LICENSE_POLL_MS_MAX,
  LICENSE_POLL_MS_MIN,
  LICENSE_POLL_PRESET_MS,
  clampLicensePollMs,
  isPresetPollMs,
} from './license-poll'
import { formatLicenseCountdownDisplay, type LicenseCountdownDisplayFormat } from './format-license-countdown'
import type {
  LicenseDenyReason,
  LicenseGetStatusResponse,
  RestaurantProfileDto,
  RestaurantProfileSaveBody,
} from './types'
import { useLicenseMonotonicNow } from './useLicenseMonotonicNow'
import { useLicenseCountdownFormat } from './useLicenseCountdownFormat'

const LICENSE_POLL_STORAGE_KEY = 'amaan-license-poll-interval-ms'
const DEFAULT_LICENSE_POLL_MS = 8_000
/** Default LM origin (API ping is on origin; /updates/ is the LM web UI). */
const DEFAULT_LICENSE_PLATFORM_URL = 'https://bazarone.amaantechnology.com'

function readStoredLicensePollMs(): number | null {
  try {
    const v = localStorage.getItem(LICENSE_POLL_STORAGE_KEY)
    if (v == null) return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return clampLicensePollMs(n)
  } catch {
    return null
  }
}

function importErrorMessage(t: (key: string) => string, code: string): string {
  const key = `licenseActivation.importErr_${code}`
  const s = t(key)
  return s === key ? t('licenseActivation.importErr_default') : s
}

function activationErrorMessage(t: (key: string) => string, code: string): string {
  if (code === 'RATE_LIMITED') return t('licenseActivation.errRateLimited')
  if (code === 'NO_STORE_NAME') return t('licenseActivation.errStoreNameRequired')
  if (code === 'NO_PLATFORM_URL') return t('licenseActivation.errNoUrl')
  if (code === 'BACKEND_NOT_READY') return t('licenseActivation.errBackendNotReady')
  return t('licenseActivation.errFailed')
}

function denyReasonMessage(
  t: (key: string) => string,
  reason: LicenseDenyReason,
  platformMessage?: string | null,
): string {
  if (reason === 'platform_denied' && platformMessage?.trim()) {
    return platformMessage.trim()
  }
  const key = `settings.licenseReason_${reason}`
  const s = t(key)
  return s === key ? t('settings.licenseReason_unknown') : s
}

type ActivationUiState = 'idle' | 'submitting' | 'pending' | 'declined' | 'approved'

function LicensePageShell({
  dir,
  children,
  className = 'bg-gradient-to-br from-cloud-soft-white via-white to-cyber-aqua/10',
}: {
  dir: string
  children: ReactNode
  className?: string
}) {
  return (
    <div dir={dir} className={`relative h-full min-h-0 overflow-y-auto overscroll-contain ${className}`}>
      <div className="pointer-events-none absolute end-4 top-4 z-10 rounded-xl border border-black/5 bg-white p-2 shadow-soft">
        <div className="pointer-events-auto">
          <LanguageSwitcher />
        </div>
      </div>
      <div className="flex min-h-full flex-col items-center justify-start px-6 pb-8 pt-16">{children}</div>
    </div>
  )
}

export function LicenseActivationPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const pageDir = i18n.dir()
  const [status, setStatus] = useState<'load' | 'ready' | 'dev'>('load')
  const [machineId, setMachineId] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [infoBanner, setInfoBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [platformUrlInput, setPlatformUrlInput] = useState(DEFAULT_LICENSE_PLATFORM_URL)
  const [platformUrlEnvActive, setPlatformUrlEnvActive] = useState(false)
  const [pollIntervalMs, setPollIntervalMs] = useState(DEFAULT_LICENSE_POLL_MS)
  const [pollSelectValue, setPollSelectValue] = useState(String(DEFAULT_LICENSE_POLL_MS))
  const [customPollSeconds, setCustomPollSeconds] = useState('8')
  const [gateSnapshot, setGateSnapshot] = useState<LicenseGetStatusResponse | null>(null)
  const nowTick = useLicenseMonotonicNow(gateSnapshot?.effectiveNowMs)
  const [countdownFormat, setCountdownFormat] = useLicenseCountdownFormat()
  const [restaurantName, setRestaurantName] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [ownerContactName, setOwnerContactName] = useState('')
  const [activationSubmitting, setActivationSubmitting] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const activationStatus = gateSnapshot?.platform?.activationStatus ?? 'none'
  const activationUi: ActivationUiState = useMemo(() => {
    if (activationSubmitting) return 'submitting'
    if (gateSnapshot?.platform?.ok === true && gateSnapshot.platform.status === 'active') {
      return 'approved'
    }
    if (activationStatus === 'pending') return 'pending'
    if (activationStatus === 'declined') return 'declined'
    return 'idle'
  }, [activationSubmitting, gateSnapshot, activationStatus])

  const profilePayload = useCallback((): RestaurantProfileSaveBody => {
    const trimOrNull = (v: string) => {
      const x = v.trim()
      return x ? x : null
    }
    return {
      restaurantName: restaurantName.trim(),
      phone: trimOrNull(phone),
      addressLine: trimOrNull(addressLine),
      city: trimOrNull(city),
      ownerContactName: trimOrNull(ownerContactName),
    }
  }, [restaurantName, phone, addressLine, city, ownerContactName])

  const refresh = useCallback(
    (opts?: { silent?: boolean }) => {
      const api = window.amaan
      if (!api?.licenseGetStatus) {
        setStatus('dev')
        return
      }
      void api.licenseGetStatus().then((raw) => {
        const r = raw as LicenseGetStatusResponse
        setMachineId(r.machineId)
        if (r.enforced) setGateSnapshot(r)
        if (!opts?.silent) setErrorBanner(null)
        if (!r.enforced) {
          setGateSnapshot(null)
          setStatus('dev')
          return
        }
        if (r.ok) {
          void navigate('/', { replace: true })
          return
        }
        const msg = denyReasonMessage(t, r.reason, r.platform?.message)
        setErrorBanner(msg)
        setStatus('ready')
      })
    },
    [navigate, t],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = readStoredLicensePollMs()
      let fromEnv: number | null = null
      if (window.amaan?.licenseGetPollIntervalMs) {
        const raw = await window.amaan.licenseGetPollIntervalMs()
        if (raw != null) fromEnv = clampLicensePollMs(raw)
      }
      const initial = clampLicensePollMs(stored ?? fromEnv ?? DEFAULT_LICENSE_POLL_MS)
      if (!cancelled) {
        setPollIntervalMs(initial)
        setPollSelectValue(isPresetPollMs(initial) ? String(initial) : 'custom')
        setCustomPollSeconds(String(Math.round(initial / 1000)))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready') return
    const id = window.setInterval(() => {
      refresh({ silent: true })
    }, pollIntervalMs)
    return () => window.clearInterval(id)
  }, [status, refresh, pollIntervalMs])

  function applyPollMs(ms: number) {
    const v = clampLicensePollMs(ms)
    setPollIntervalMs(v)
    setPollSelectValue(isPresetPollMs(v) ? String(v) : 'custom')
    setCustomPollSeconds(String(Math.round(v / 1000)))
    try {
      localStorage.setItem(LICENSE_POLL_STORAGE_KEY, String(v))
    } catch {
      /* ignore */
    }
  }

  function onPollPresetSelectChange(value: string) {
    if (value === 'custom') {
      setPollSelectValue('custom')
      const sec = Number(String(customPollSeconds).trim().replace(',', '.'))
      if (Number.isFinite(sec)) {
        applyPollMs(sec * 1000)
      } else {
        applyPollMs(pollIntervalMs)
      }
    } else {
      applyPollMs(Number(value))
    }
  }

  function commitCustomPollSeconds() {
    const sec = Number(String(customPollSeconds).trim().replace(',', '.'))
    if (!Number.isFinite(sec)) {
      setCustomPollSeconds(String(Math.round(pollIntervalMs / 1000)))
      return
    }
    applyPollMs(sec * 1000)
  }

  useEffect(() => {
    if (status !== 'ready' || profileLoaded) return
    let cancelled = false

    void (async () => {
      const api = window.amaan
      let profile: RestaurantProfileDto | null = null
      if (api?.licenseGetRestaurantProfile) {
        profile = (await api.licenseGetRestaurantProfile()) as RestaurantProfileDto | null
      }

      if (cancelled) return

      if (profile?.restaurantName?.trim()) {
        setRestaurantName(profile.restaurantName)
        setPhone(profile.phone ?? '')
        setAddressLine(profile.addressLine ?? '')
        setCity(profile.city ?? '')
        setOwnerContactName(profile.ownerContactName ?? '')
        setProfileLoaded(true)
        return
      }

      if (window.sufra?.recipePrint?.getSettings) {
        try {
          const branding = await window.sufra.recipePrint.getSettings()
          if (cancelled) return
          if (branding.restaurantName?.trim()) setRestaurantName(branding.restaurantName.trim())
          if (branding.mobileNumber?.trim()) setPhone(branding.mobileNumber.trim())
        } catch {
          /* optional pre-fill */
        }
      }

      if (!cancelled) setProfileLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [status, profileLoaded])

  useEffect(() => {
    if (status !== 'ready') return
    const api = window.amaan
    if (!api?.licenseGetPlatformUrlSettings) return
    void api.licenseGetPlatformUrlSettings().then((raw) => {
      const s = raw as { envActive?: boolean; fileUrl?: string | null; resolvedUrl?: string | null }
      setPlatformUrlEnvActive(Boolean(s.envActive))
      setPlatformUrlInput(s.fileUrl ?? s.resolvedUrl ?? DEFAULT_LICENSE_PLATFORM_URL)
    })
  }, [status])

  async function savePlatformUrl() {
    const api = window.amaan
    if (!api?.licenseSetPlatformUrl) return
    setBusy(true)
    setErrorBanner(null)
    setInfoBanner(null)
    try {
      const r = await api.licenseSetPlatformUrl(platformUrlInput)
      if (r.ok) {
        setInfoBanner(t('licenseActivation.urlSaved'))
        refresh()
      } else if (r.error === 'ENV_OVERRIDES') {
        setErrorBanner(t('licenseActivation.envOverrides'))
      } else if (r.error === 'INVALID_URL') {
        setErrorBanner(t('licenseActivation.invalidUrl'))
      } else {
        setErrorBanner(t('licenseActivation.urlSaveFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  const tryImportText = async (text: string) => {
    const api = window.amaan
    if (!api?.licenseImportJson) return
    setBusy(true)
    setErrorBanner(null)
    setInfoBanner(null)
    try {
      const r = await api.licenseImportJson(text)
      if (r.ok) {
        refresh()
      } else {
        setErrorBanner(importErrorMessage(t, r.error))
      }
    } finally {
      setBusy(false)
    }
  }

  const applyPaste = async () => {
    await tryImportText(pasteText)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text?.trim()) {
        setErrorBanner(importErrorMessage(t, 'CLIPBOARD_EMPTY'))
        return
      }
      setPasteText(text.trim())
      await tryImportText(text.trim())
    } catch {
      setErrorBanner(importErrorMessage(t, 'CLIPBOARD_DENIED'))
    }
  }

  const pickFile = async () => {
    const api = window.amaan
    if (!api?.licensePickAndImport) return
    setBusy(true)
    setErrorBanner(null)
    setInfoBanner(null)
    try {
      const r = await api.licensePickAndImport()
      if (r.ok) {
        refresh()
      } else {
        setErrorBanner(importErrorMessage(t, r.error))
      }
    } finally {
      setBusy(false)
    }
  }

  const submitActivation = async () => {
    const api = window.amaan
    if (!api?.licenseSubmitActivation) return
    const payload = profilePayload()
    if (!payload.restaurantName) {
      setErrorBanner(t('licenseActivation.errStoreNameRequired'))
      return
    }
    setActivationSubmitting(true)
    setErrorBanner(null)
    setInfoBanner(null)
    try {
      const r = await api.licenseSubmitActivation(payload)
      if (r.ok) {
        setInfoBanner(t('licenseActivation.sent'))
        refresh({ silent: true })
      } else {
        setErrorBanner(activationErrorMessage(t, r.error))
      }
    } finally {
      setActivationSubmitting(false)
    }
  }

  const copyId = async () => {
    const api = window.amaan
    if (api?.licenseCopyMachineId) {
      await api.licenseCopyMachineId()
    } else if (machineId) {
      await navigator.clipboard.writeText(machineId)
    }
    setInfoBanner(t('licenseActivation.machineIdCopied'))
    window.setTimeout(() => setInfoBanner(null), 2500)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      void tryImportText(text)
    }
    reader.readAsText(file)
  }

  if (status === 'load') {
    return (
      <LicensePageShell dir={pageDir} className="bg-cloud-soft-white">
        <div className="flex flex-1 items-center justify-center py-16 text-obsidian">
          <p className="text-lg font-semibold text-cyber-aqua">{t('licenseActivation.checking')}</p>
        </div>
      </LicensePageShell>
    )
  }

  if (status === 'dev') {
    return (
      <LicensePageShell dir={pageDir} className="bg-cloud-soft-white">
        <div className="flex w-full max-w-md flex-col items-center gap-4 py-8 text-center text-graphite">
          <p className="font-medium text-obsidian">{t('settings.licenseNotEnforced')}</p>
          <button
            type="button"
            className="rounded-xl bg-cyber-aqua px-8 py-3 text-sm font-semibold text-charcoal-graphite shadow-soft hover:opacity-90"
            onClick={() => void navigate('/', { replace: true })}
          >
            {t('licenseActivation.devContinue')}
          </button>
        </div>
      </LicensePageShell>
    )
  }

  return (
    <LicensePageShell dir={pageDir}>
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-8 shadow-soft ring-1 ring-black/5">
        <h1 className="text-start text-2xl font-bold tracking-tight text-obsidian">{t('licenseActivation.pageTitle')}</h1>
        <p className="mt-3 text-start text-sm leading-relaxed text-graphite">{t('licenseActivation.pageIntro')}</p>

        <div className="mt-6 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
          <p className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
            {t('licenseActivation.serverUrlLabel')}
          </p>
          <p className="mt-2 text-start text-xs text-graphite">
            {t('licenseActivation.serverUrlHelp', {
              defaultUrl: DEFAULT_LICENSE_PLATFORM_URL,
              productName: 'sufra pos',
            })}
          </p>
          {platformUrlEnvActive ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-start text-xs text-amber-900 ring-1 ring-amber-200">
              {t('licenseActivation.envOverrides')}
            </p>
          ) : null}
          <input
            type="url"
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            disabled={busy || platformUrlEnvActive}
            placeholder={DEFAULT_LICENSE_PLATFORM_URL}
            value={platformUrlInput}
            onChange={(e) => setPlatformUrlInput(e.target.value)}
            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={busy || platformUrlEnvActive}
            className="mt-3 w-full rounded-lg bg-obsidian px-5 py-3 text-sm font-semibold text-white hover:bg-obsidian/90 disabled:opacity-60"
            onClick={() => void savePlatformUrl()}
          >
            {busy ? t('licenseActivation.savingUrl') : t('licenseActivation.saveUrl')}
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
          <p className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
            {t('settings.licenseMachineId')}
          </p>
          <p dir="ltr" className="mt-2 break-all font-mono text-lg font-semibold tracking-tight text-cyber-aqua">
            {machineId}
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cyber-aqua shadow-soft hover:bg-cloud-soft-white"
            onClick={() => void copyId()}
          >
            {t('licenseActivation.copyMachineId')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-black/10 bg-white py-2 text-xs font-semibold text-obsidian hover:bg-cloud-soft-white disabled:opacity-60"
            onClick={() => refresh()}
          >
            {t('licenseActivation.checkAgain')}
          </button>
          <label className="mt-4 block">
            <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
              {t('licenseActivation.autoCheckInterval')}
            </span>
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none"
              value={pollSelectValue}
              disabled={busy}
              onChange={(e) => onPollPresetSelectChange(e.target.value)}
            >
              {LICENSE_POLL_PRESET_MS.map((opt) => (
                <option key={opt} value={String(opt)}>
                  {t('licenseActivation.pollSeconds', { seconds: opt / 1000 })}
                </option>
              ))}
              <option value="custom">{t('licenseActivation.pollCustomOption')}</option>
            </select>
            {pollSelectValue === 'custom' ? (
              <input
                type="number"
                dir="ltr"
                min={LICENSE_POLL_MS_MIN / 1000}
                max={LICENSE_POLL_MS_MAX / 1000}
                step={1}
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-obsidian"
                value={customPollSeconds}
                onChange={(e) => setCustomPollSeconds(e.target.value)}
                onBlur={() => commitCustomPollSeconds()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            ) : null}
          </label>
          <label className="mt-4 block">
            <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
              {t('settings.licenseCountdownFormatLabel')}
            </span>
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian"
              value={countdownFormat}
              onChange={(e) => setCountdownFormat(e.target.value as LicenseCountdownDisplayFormat)}
            >
              <option value="days_minutes">{t('settings.licenseCountdownFormatDaysMinutes')}</option>
              <option value="stopwatch">{t('settings.licenseCountdownFormatStopwatch')}</option>
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-xl border border-cyber-aqua/30 bg-cyber-aqua/5 p-5">
          <p className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
            {t('licenseActivation.title')}
          </p>
          <p className="mt-2 text-start text-sm leading-relaxed text-graphite">{t('licenseActivation.body')}</p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                {t('licenseActivation.restaurantName')} *
              </span>
              <input
                type="text"
                dir="auto"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                disabled={busy || activationSubmitting || activationUi === 'pending'}
                maxLength={120}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                {t('licenseActivation.phone')}
              </span>
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy || activationSubmitting || activationUi === 'pending'}
                maxLength={40}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                {t('licenseActivation.address')}
              </span>
              <input
                type="text"
                dir="auto"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                disabled={busy || activationSubmitting || activationUi === 'pending'}
                maxLength={200}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                {t('licenseActivation.city')}
              </span>
              <input
                type="text"
                dir="auto"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={busy || activationSubmitting || activationUi === 'pending'}
                maxLength={80}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                {t('licenseActivation.ownerName')}
              </span>
              <input
                type="text"
                dir="auto"
                value={ownerContactName}
                onChange={(e) => setOwnerContactName(e.target.value)}
                disabled={busy || activationSubmitting || activationUi === 'pending'}
                maxLength={120}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30 disabled:opacity-60"
              />
            </label>
          </div>

          {activationUi === 'pending' ? (
            <p className="mt-3 text-start text-sm font-semibold text-indigo-800" role="status">
              {t('licenseActivation.pending')}
            </p>
          ) : null}
          {activationUi === 'declined' ? (
            <p className="mt-3 text-start text-sm font-semibold text-rose-800" role="status">
              {t('licenseActivation.declined')}
            </p>
          ) : null}
          {activationUi === 'approved' ? (
            <p className="mt-3 text-start text-sm font-semibold text-emerald-800" role="status">
              {t('licenseActivation.approved')}
            </p>
          ) : null}

          <button
            type="button"
            disabled={
              busy ||
              activationSubmitting ||
              !restaurantName.trim() ||
              activationUi === 'pending' ||
              activationUi === 'approved'
            }
            onClick={() => void submitActivation()}
            className="mt-4 w-full rounded-lg bg-cyber-aqua px-5 py-3 text-sm font-semibold text-charcoal-graphite hover:opacity-90 disabled:opacity-60"
          >
            {activationUi === 'submitting'
              ? t('licenseActivation.submitting')
              : activationUi === 'pending'
                ? t('licenseActivation.pending')
                : t('licenseActivation.send')}
          </button>
        </div>

        {gateSnapshot ? (
          <div className="mt-6 space-y-4 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
            {gateSnapshot.expiresAtMs != null && Number.isFinite(gateSnapshot.expiresAtMs) ? (
              <div className="space-y-1">
                <p className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                  {t('settings.licenseCountdownExpires')}
                </p>
                <p dir="ltr" className="font-mono text-2xl font-bold tabular-nums text-obsidian" aria-live="polite">
                  {formatLicenseCountdownDisplay(gateSnapshot.expiresAtMs - nowTick, countdownFormat)}
                </p>
              </div>
            ) : null}
            {gateSnapshot.platform?.reachable === false &&
            gateSnapshot.platform.nextRequiredSyncBeforeMs != null &&
            Number.isFinite(gateSnapshot.platform.nextRequiredSyncBeforeMs) ? (
              <div
                className={
                  gateSnapshot.expiresAtMs != null && Number.isFinite(gateSnapshot.expiresAtMs)
                    ? 'space-y-1 border-t border-black/10 pt-4'
                    : 'space-y-1'
                }
              >
                <p className="text-start text-xs font-semibold uppercase tracking-wider text-obsidian/55">
                  {t('settings.licenseCountdownSync')}
                </p>
                <p dir="ltr" className="font-mono text-xl font-bold tabular-nums text-amber-700" aria-live="polite">
                  {formatLicenseCountdownDisplay(
                    gateSnapshot.platform.nextRequiredSyncBeforeMs - nowTick,
                    countdownFormat,
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <p className="text-start text-sm font-semibold uppercase tracking-wider text-obsidian/55">
            {t('licenseActivation.pasteJsonLabel')}
          </p>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-lg border border-gray-300 bg-white p-4 font-mono text-xs leading-relaxed text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30"
            dir="ltr"
            spellCheck={false}
            placeholder={t('licenseActivation.jsonPlaceholder')}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="inline-flex min-w-[140px] flex-1 items-center justify-center rounded-lg bg-cyber-aqua px-5 py-3 text-sm font-semibold text-charcoal-graphite hover:opacity-90 disabled:opacity-60 sm:flex-none"
              onClick={() => void applyPaste()}
            >
              {busy ? t('licenseActivation.importing') : t('licenseActivation.applyPasted')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-5 py-3 text-xs font-semibold text-obsidian hover:bg-cloud-soft-white disabled:opacity-60"
              onClick={() => void pasteFromClipboard()}
            >
              {t('licenseActivation.pasteFromClipboard')}
            </button>
          </div>
        </div>

        <div
          className={`mt-8 flex min-h-[100px] cursor-default flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver ? 'border-cyber-aqua bg-cyber-aqua/10' : 'border-black/15 bg-cloud-soft-white'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="text-sm font-semibold text-graphite">{t('licenseActivation.dropZone')}</p>
        </div>

        <button
          type="button"
          disabled={busy}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg border border-black/10 bg-white px-6 text-sm font-semibold text-obsidian hover:border-cyber-aqua hover:bg-cloud-soft-white disabled:opacity-60"
          onClick={() => void pickFile()}
        >
          {busy ? t('licenseActivation.importing') : t('licenseActivation.chooseFile')}
        </button>

        {errorBanner ? (
          <p
            className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-start text-sm font-medium text-rose-800 ring-1 ring-rose-200"
            role="alert"
          >
            {errorBanner}
          </p>
        ) : null}
        {infoBanner ? (
          <p
            className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-start text-sm font-medium text-emerald-900 ring-1 ring-emerald-200"
            role="status"
          >
            {infoBanner}
          </p>
        ) : null}

        <p className="mt-6 text-start text-xs leading-relaxed text-obsidian/55">{t('licenseActivation.footerNote')}</p>
      </div>
    </LicensePageShell>
  )
}

export default LicenseActivationPage
