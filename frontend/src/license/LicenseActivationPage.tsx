import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LICENSE_POLL_MS_MAX,
  LICENSE_POLL_MS_MIN,
  LICENSE_POLL_PRESET_MS,
  clampLicensePollMs,
  isPresetPollMs,
} from './license-poll'
import { formatLicenseCountdownDisplay, type LicenseCountdownDisplayFormat } from './format-license-countdown'
import type { LicenseDenyReason, LicenseGetStatusResponse } from './types'
import { useLicenseMonotonicNow } from './useLicenseMonotonicNow'
import { useLicenseCountdownFormat } from './useLicenseCountdownFormat'

const LICENSE_POLL_STORAGE_KEY = 'amaan-license-poll-interval-ms'
const DEFAULT_LICENSE_POLL_MS = 8_000
/** Default LM origin when none is saved (local dev; set your hosted HTTPS origin in production). */
const DEFAULT_LICENSE_PLATFORM_URL = 'http://127.0.0.1:3850'

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

function importErrorMessage(code: string): string {
  const m: Record<string, string> = {
    EMPTY: 'Paste the license JSON first.',
    CLIPBOARD_EMPTY: 'Clipboard is empty.',
    CLIPBOARD_DENIED: 'Clipboard access denied.',
    NO_WINDOW: 'Could not open file dialog.',
    CANCELLED: 'Cancelled.',
    NOT_FOUND: 'File not found.',
    READ_FAILED: 'Could not read file.',
    WRITE_FAILED: 'Could not save license file.',
    no_file: 'No license file yet.',
    invalid_file: 'Invalid license file.',
    bad_signature: 'Invalid license signature.',
    wrong_machine: 'This license is for another machine.',
    expired: 'This license has expired.',
  }
  return m[code] ?? 'Invalid license.'
}

function gateDenyReasonMessage(reason: LicenseDenyReason): string {
  const m: Partial<Record<LicenseDenyReason, string>> = {
    platform_denied: 'The license server denied access.',
    no_file: 'No license file yet.',
    invalid_file: 'Invalid license file.',
    bad_signature: 'Invalid license signature.',
    wrong_machine: 'This license is for another machine.',
    expired: 'This license has expired.',
    rolling_deadline_passed: 'Offline period ended — connect and sync with the license server.',
  }
  return m[reason] ?? 'License check failed.'
}

export function LicenseActivationPage() {
  const navigate = useNavigate()
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
        const msg =
          r.reason === 'platform_denied' && r.platform?.message?.trim()
            ? r.platform.message.trim()
            : gateDenyReasonMessage(r.reason)
        setErrorBanner(msg)
        setStatus('ready')
      })
    },
    [navigate],
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
        setInfoBanner('License server URL saved.')
        refresh()
      } else if (r.error === 'ENV_OVERRIDES') {
        setErrorBanner('AMAAN_PLATFORM_URL is set in the environment — change it there instead.')
      } else if (r.error === 'INVALID_URL') {
        setErrorBanner('Enter a valid http(s) URL.')
      } else {
        setErrorBanner('Could not save URL.')
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
        setErrorBanner(importErrorMessage(r.error))
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
        setErrorBanner(importErrorMessage('CLIPBOARD_EMPTY'))
        return
      }
      setPasteText(text.trim())
      await tryImportText(text.trim())
    } catch {
      setErrorBanner(importErrorMessage('CLIPBOARD_DENIED'))
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
        setErrorBanner(importErrorMessage(r.error))
      }
    } finally {
      setBusy(false)
    }
  }

  const copyId = async () => {
    const api = window.amaan
    if (api?.licenseCopyMachineId) {
      await api.licenseCopyMachineId()
    } else if (machineId) {
      await navigator.clipboard.writeText(machineId)
    }
    setInfoBanner('Machine ID copied.')
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
      <div className="flex min-h-screen items-center justify-center bg-cloud-soft-white text-obsidian">
        <p className="text-lg font-semibold text-cyber-aqua">Checking license…</p>
      </div>
    )
  }

  if (status === 'dev') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cloud-soft-white p-6 text-center text-graphite">
        <p className="max-w-md font-medium text-obsidian">License is not enforced in this build (dev / web).</p>
        <button
          type="button"
          className="rounded-xl bg-cyber-aqua px-8 py-3 text-sm font-semibold text-charcoal-graphite shadow-soft hover:opacity-90"
          onClick={() => void navigate('/', { replace: true })}
        >
          Continue to app
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-cloud-soft-white via-white to-cyber-aqua/10 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-8 shadow-soft ring-1 ring-black/5">
        <h1 className="text-2xl font-bold tracking-tight text-obsidian">Activate Sufra Lite</h1>
        <p className="mt-3 text-sm leading-relaxed text-graphite">
          Connect to your license server (LM), then activate this machine ID on the server or import a license file.
        </p>

        <div className="mt-6 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">License server URL</p>
          <p className="mt-2 text-xs text-graphite">
            Example local LM: {DEFAULT_LICENSE_PLATFORM_URL}. In production, use your hosted license manager HTTPS origin
            (activate this device under <span className="font-mono text-obsidian/70">Sufra</span> in LM).
          </p>
          {platformUrlEnvActive ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
              AMAAN_PLATFORM_URL is set in the environment — change it there instead.
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
            {busy ? 'Saving…' : 'Save & check license'}
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">Machine ID</p>
          <p dir="ltr" className="mt-2 break-all font-mono text-lg font-semibold tracking-tight text-cyber-aqua">
            {machineId}
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cyber-aqua shadow-soft hover:bg-cloud-soft-white"
            onClick={() => void copyId()}
          >
            Copy machine ID
          </button>
          <button
            type="button"
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-black/10 bg-white py-2 text-xs font-semibold text-obsidian hover:bg-cloud-soft-white disabled:opacity-60"
            onClick={() => refresh()}
          >
            Check license again
          </button>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">Auto-check interval</span>
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian focus:border-cyber-aqua focus:outline-none"
              value={pollSelectValue}
              disabled={busy}
              onChange={(e) => onPollPresetSelectChange(e.target.value)}
            >
              {LICENSE_POLL_PRESET_MS.map((opt) => (
                <option key={opt} value={String(opt)}>
                  {opt / 1000}s
                </option>
              ))}
              <option value="custom">Custom (seconds)</option>
            </select>
            {pollSelectValue === 'custom' ? (
              <>
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
              </>
            ) : null}
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">Countdown display</span>
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-obsidian"
              value={countdownFormat}
              onChange={(e) => setCountdownFormat(e.target.value as LicenseCountdownDisplayFormat)}
            >
              <option value="days_minutes">Days + minutes</option>
              <option value="stopwatch">Stopwatch</option>
            </select>
          </label>
        </div>

        {gateSnapshot ? (
          <div className="mt-6 space-y-4 rounded-xl border border-black/10 bg-cloud-soft-white p-5">
            {gateSnapshot.expiresAtMs != null && Number.isFinite(gateSnapshot.expiresAtMs) ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">Time until license expiry</p>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-obsidian/55">Next sync required by</p>
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
          <p className="text-sm font-semibold uppercase tracking-wider text-obsidian/55">Paste license JSON</p>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-lg border border-gray-300 bg-white p-4 font-mono text-xs leading-relaxed text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30"
            dir="ltr"
            spellCheck={false}
            placeholder="{ ... }"
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
              {busy ? 'Importing…' : 'Apply pasted license'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-5 py-3 text-xs font-semibold text-obsidian hover:bg-cloud-soft-white disabled:opacity-60"
              onClick={() => void pasteFromClipboard()}
            >
              Paste from clipboard
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
          <p className="text-sm font-semibold text-graphite">Drop license.json here</p>
        </div>

        <button
          type="button"
          disabled={busy}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg border border-black/10 bg-white px-6 text-sm font-semibold text-obsidian hover:border-cyber-aqua hover:bg-cloud-soft-white disabled:opacity-60"
          onClick={() => void pickFile()}
        >
          {busy ? 'Importing…' : 'Choose license file…'}
        </button>

        {errorBanner ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200" role="alert">
            {errorBanner}
          </p>
        ) : null}
        {infoBanner ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200" role="status">
            {infoBanner}
          </p>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-obsidian/55">
          Sufra Lite talks to <span className="font-mono text-obsidian/70">amaan-platform</span> for licenses (product{' '}
          <span className="font-mono text-obsidian/70">sufra_lite</span>) and loads updates from{' '}
          <span className="font-mono text-obsidian/70">…/updates/sufra_lite/</span> on that host. Set{' '}
          <span className="font-mono text-obsidian/70">AMAAN_PLATFORM_URL</span> or embed URLs in the Electron build for production.
        </p>
      </div>
    </div>
  )
}

export default LicenseActivationPage
