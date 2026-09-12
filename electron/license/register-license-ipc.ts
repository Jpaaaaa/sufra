import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron'
import type {
  LicenseGetStatusResponse,
  LicensePlatformSnapshot,
  LicensePlatformUrlSettings,
  LicenseTierId,
} from '../shared/types/license'
import { pingLicensePlatform, type PlatformPingOutcome } from './platform-ping'
import {
  normalizePlatformLicenseBaseUrl,
  platformLicenseUrlFilePath,
  readStoredPlatformLicenseUrl,
  resolvePlatformUrl,
} from './platform-url-resolve'
import { parseLicensePollMsFromEnv } from '../shared/license-poll'
import {
  clearPlatformGrantCache,
  isPlatformGrantCacheStillValid,
  readPlatformGrantCache,
  writePlatformGrantCacheFromPing,
} from './platform-grant-cache'
import { readRollingSyncCache, getEffectiveNowMs, seedRollingCacheAfterLicenseImport, writeRollingSyncCache } from './rolling-sync-cache'
import { licenseFilePath, verifyLicenseAtPath, verifyLicenseFileContents } from './verify-license'
import { getMachineId } from './machine-id'
import { submitActivationRequest } from './platform-activation'
import type { RestaurantProfileSaveBody } from '../shared/types/restaurant-profile'
import { getBackendApp } from '../state'
import { restaurantProfileGet, restaurantProfileUpsert } from '../init/backend-loader'

function shouldEnforceLicense(): boolean {
  if (!app.isPackaged) return false
  if (process.env.AMAAN_SKIP_LICENSE === '1') return false
  return true
}

function gateEnforced(): boolean {
  if (process.env.AMAAN_SKIP_LICENSE === '1') return false
  if (shouldEnforceLicense()) return true
  if (!app.isPackaged && process.env.AMAAN_PLATFORM_ENFORCE_UNPACKAGED === '1') return true
  return false
}

function isLicenseTier(x: unknown): x is LicenseTierId {
  return (
    x === '5d' ||
    x === '15d' ||
    x === '1m' ||
    x === '2m' ||
    x === 'lifetime' ||
    x === 'custom'
  )
}

const LICENSE_OFFLINE_GRACE_MS: number | null = null

/** Local wall-clock anchor when monotonic server timeline is unavailable (legacy). */
function lastReachableAnchorLocalMs(userData: string, machineId: string, atMs: number): number | null {
  const r = readRollingSyncCache(userData)
  const last = r?.lastReachablePingAtLocalMs
  if (typeof last === 'number' && Number.isFinite(last)) return last
  const g = readPlatformGrantCache(userData)
  if (
    g &&
    isPlatformGrantCacheStillValid(g, machineId, atMs) &&
    typeof g.savedAtLocalMs === 'number' &&
    Number.isFinite(g.savedAtLocalMs)
  ) {
    return g.savedAtLocalMs
  }
  return null
}

/** Server-time + monotonic elapsed since last successful ping (immune to system clock rollback). */
function monotonicServerTimelineMs(userData: string): { anchorServerMs: number; effectiveNowMs: number } | null {
  const r = readRollingSyncCache(userData)
  if (
    !r ||
    typeof r.serverTimeMs !== 'number' ||
    !Number.isFinite(r.serverTimeMs) ||
    typeof r.lastPingPerfMs !== 'number' ||
    !Number.isFinite(r.lastPingPerfMs)
  ) {
    return null
  }
  return {
    anchorServerMs: r.serverTimeMs,
    effectiveNowMs: getEffectiveNowMs(userData),
  }
}

function isOfflineGraceExceeded(
  platformUrl: string | undefined,
  userData: string,
  machineId: string,
  graceMs: number | null,
): boolean {
  if (!platformUrl || graceMs == null) return false
  const mono = monotonicServerTimelineMs(userData)
  if (mono != null) {
    return mono.effectiveNowMs > mono.anchorServerMs + graceMs
  }
  const atMs = getEffectiveNowMs(userData)
  const anchor = lastReachableAnchorLocalMs(userData, machineId, atMs)
  if (anchor == null) return false
  return atMs > anchor + graceMs
}

function offlineSyncDeadlineMs(
  userData: string,
  machineId: string,
  platformUrl: string | undefined,
): number | null {
  const atMs = getEffectiveNowMs(userData)
  let d: number | null = null
  const g = readPlatformGrantCache(userData)
  if (g && isPlatformGrantCacheStillValid(g, machineId, atMs)) d = g.nextRequiredSyncBeforeMs
  else {
    const r = readRollingSyncCache(userData)
    const n = r?.nextRequiredSyncBeforeMs
    if (typeof n === 'number' && Number.isFinite(n)) d = n
  }
  const graceMs = LICENSE_OFFLINE_GRACE_MS
  if (!platformUrl || graceMs == null) return d
  const mono = monotonicServerTimelineMs(userData)
  if (mono != null) {
    const cap = mono.anchorServerMs + graceMs
    if (d == null) return cap
    return Math.min(d, cap)
  }
  const anchor = lastReachableAnchorLocalMs(userData, machineId, atMs)
  if (anchor == null) return d
  const cap = anchor + graceMs
  if (d == null) return cap
  return Math.min(d, cap)
}

function snapshotUnreachableWithDeadline(
  platformUrl: string | undefined,
  userData: string,
  machineId: string,
  unreachablePing?: { networkError?: string },
): LicensePlatformSnapshot | undefined {
  const deadline = offlineSyncDeadlineMs(userData, machineId, platformUrl)
  const err = unreachablePing?.networkError
  if (!platformUrl && deadline == null && !err) return undefined
  return {
    enabled: Boolean(platformUrl || deadline != null),
    reachable: false,
    ...(err ? { networkError: err } : {}),
    ...(deadline != null ? { nextRequiredSyncBeforeMs: deadline } : {}),
  }
}

function logLicenseStatusPing(pingOutcome: PlatformPingOutcome, platform: LicensePlatformSnapshot | undefined): void {
  console.warn('[license-status]', {
    reachable: pingOutcome.reachable,
    error: pingOutcome.reachable === false ? pingOutcome.error : undefined,
    platformOk: platform?.ok,
    grantCleared: pingOutcome.reachable === true && pingOutcome.body.ok === false,
  })
}

function snapshotFromPing(outcome: PlatformPingOutcome): LicensePlatformSnapshot {
  if (!outcome.reachable) {
    return { enabled: true, reachable: false, networkError: outcome.error }
  }
  const b = outcome.body
  return {
    enabled: true,
    reachable: true,
    ok: b.ok,
    status: b.status,
    message: b.message,
    tier: b.tier ?? undefined,
    expiresAtMs: b.expiresAtMs,
    daysUntilExpiry: b.daysUntilExpiry,
    nextRequiredSyncBeforeMs: b.nextRequiredSyncBeforeMs,
    activationStatus: b.activationStatus,
  }
}

function parseRestaurantProfileSaveBody(raw: unknown): RestaurantProfileSaveBody | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.restaurantName !== 'string') return null
  return {
    restaurantName: o.restaurantName,
    phone: typeof o.phone === 'string' ? o.phone : o.phone === null ? null : undefined,
    addressLine:
      typeof o.addressLine === 'string' ? o.addressLine : o.addressLine === null ? null : undefined,
    city: typeof o.city === 'string' ? o.city : o.city === null ? null : undefined,
    ownerContactName:
      typeof o.ownerContactName === 'string'
        ? o.ownerContactName
        : o.ownerContactName === null
          ? null
          : undefined,
  }
}

async function tryGetRestaurantProfile() {
  if (!getBackendApp()) return null
  try {
    return await restaurantProfileGet()
  } catch {
    return null
  }
}

async function tryUpsertRestaurantProfile(body: RestaurantProfileSaveBody) {
  if (!getBackendApp()) return { ok: false as const, error: 'BACKEND_NOT_READY' }
  try {
    const profile = await restaurantProfileUpsert(body)
    return { ok: true as const, profile }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('RESTAURANT_NAME_REQUIRED')) {
      return { ok: false as const, error: 'NO_STORE_NAME' }
    }
    return { ok: false as const, error: 'SAVE_FAILED' }
  }
}

type OfflineOk = { ok: true; tier: LicenseTierId; expiresAtMs: number | null }
type OfflineFail = { ok: false; reason: 'no_file' | 'invalid_file' | 'bad_signature' | 'wrong_machine' | 'expired' }

function evaluateOfflineLicense(machineId: string, userData: string): OfflineOk | OfflineFail {
  const dest = licenseFilePath(userData)
  if (!existsSync(dest)) {
    return { ok: false, reason: 'no_file' }
  }
  const v = verifyLicenseAtPath(dest, machineId, getEffectiveNowMs(userData))
  if (!v.ok) {
    return { ok: false, reason: v.reason }
  }
  return {
    ok: true,
    tier: v.payload.tier,
    expiresAtMs: v.payload.expiresAtMs,
  }
}

export function importLicenseJsonString(raw: string): { ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'EMPTY' }
  const machineId = getMachineId()
  const v = verifyLicenseFileContents(trimmed, machineId, getEffectiveNowMs(app.getPath('userData')))
  if (!v.ok) return { ok: false, error: v.reason }
  const dest = licenseFilePath(app.getPath('userData'))
  try {
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, trimmed, 'utf8')
    seedRollingCacheAfterLicenseImport(app.getPath('userData'))
  } catch {
    return { ok: false, error: 'WRITE_FAILED' }
  }
  return { ok: true }
}

function importLicenseFromAbsolutePath(
  sourcePath: string,
): { ok: true } | { ok: false; error: string } {
  const resolved = path.resolve(sourcePath.trim())
  if (!existsSync(resolved)) {
    return { ok: false, error: 'NOT_FOUND' }
  }
  let raw: string
  try {
    raw = readFileSync(resolved, 'utf8')
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
  return importLicenseJsonString(raw)
}

export function registerLicenseIpc(): void {
  ipcMain.removeHandler('license-get-status')
  ipcMain.removeHandler('license-import-path')
  ipcMain.removeHandler('license-pick-and-import')
  ipcMain.removeHandler('license-copy-machine-id')
  ipcMain.removeHandler('license-import-json')
  ipcMain.removeHandler('license-get-platform-url-settings')
  ipcMain.removeHandler('license-set-platform-url')
  ipcMain.removeHandler('license-get-poll-interval-ms')
  ipcMain.removeHandler('license-get-restaurant-profile')
  ipcMain.removeHandler('license-save-restaurant-profile')
  ipcMain.removeHandler('license-submit-activation')

  ipcMain.handle(
    'license-import-json',
    (_e, jsonText: unknown): { ok: true } | { ok: false; error: string } => {
      if (typeof jsonText !== 'string') return { ok: false, error: 'EMPTY' }
      return importLicenseJsonString(jsonText)
    },
  )

  ipcMain.handle('license-get-poll-interval-ms', (): number | null => {
    return parseLicensePollMsFromEnv(process.env.AMAAN_LICENSE_POLL_MS)
  })

  ipcMain.handle('license-get-platform-url-settings', (): LicensePlatformUrlSettings => {
    const envActive = Boolean(process.env.AMAAN_PLATFORM_URL?.trim())
    return {
      envActive,
      fileUrl: readStoredPlatformLicenseUrl(app),
      resolvedUrl: resolvePlatformUrl(app) ?? null,
    }
  })

  ipcMain.handle(
    'license-set-platform-url',
    (_e, url: unknown): { ok: true } | { ok: false; error: string } => {
      if (typeof url !== 'string') return { ok: false, error: 'INVALID' }
      if (process.env.AMAAN_PLATFORM_URL?.trim()) {
        return { ok: false, error: 'ENV_OVERRIDES' }
      }
      const trimmed = url.trim()
      const fp = platformLicenseUrlFilePath(app)
      if (!trimmed) {
        try {
          if (existsSync(fp)) unlinkSync(fp)
        } catch {
          return { ok: false, error: 'WRITE_FAILED' }
        }
        return { ok: true }
      }
      const norm = normalizePlatformLicenseBaseUrl(trimmed)
      if (!norm) return { ok: false, error: 'INVALID_URL' }
      try {
        mkdirSync(path.dirname(fp), { recursive: true })
        writeFileSync(fp, `${norm}\n`, 'utf8')
      } catch {
        return { ok: false, error: 'WRITE_FAILED' }
      }
      return { ok: true }
    },
  )

  ipcMain.handle('license-get-restaurant-profile', async () => tryGetRestaurantProfile())

  ipcMain.handle(
    'license-save-restaurant-profile',
    async (_e, raw: unknown): Promise<{ ok: true; profile: unknown } | { ok: false; error: string }> => {
      const body = parseRestaurantProfileSaveBody(raw)
      if (!body?.restaurantName.trim()) {
        return { ok: false, error: 'NO_STORE_NAME' }
      }
      return tryUpsertRestaurantProfile(body)
    },
  )

  ipcMain.handle(
    'license-submit-activation',
    async (_e, raw: unknown): Promise<
      { ok: true; status: 'pending' } | { ok: false; error: string }
    > => {
      const body = parseRestaurantProfileSaveBody(raw)
      if (!body?.restaurantName.trim()) {
        return { ok: false, error: 'NO_STORE_NAME' }
      }
      const saved = await tryUpsertRestaurantProfile(body)
      if (!saved.ok) return saved
      return submitActivationRequest(body)
    },
  )

  ipcMain.handle('license-get-status', async (): Promise<LicenseGetStatusResponse> => {
    const machineId = getMachineId()
    const userData = app.getPath('userData')
    const platformUrl = resolvePlatformUrl(app)
    const enforced = gateEnforced()
    const effectiveNowMs = getEffectiveNowMs(userData)

    if (!enforced) {
      let platform: LicensePlatformSnapshot | undefined
      if (platformUrl) {
        const po = await pingLicensePlatform(platformUrl, machineId)
        platform = snapshotFromPing(po)
      }
      return {
        enforced: false,
        ok: true,
        machineId,
        reason: 'not_enforced',
        platform,
        effectiveNowMs,
      }
    }

    const graceMs = LICENSE_OFFLINE_GRACE_MS

    const off = evaluateOfflineLicense(machineId, userData)
    if (off.ok) {
      const graceBlocksFile = isOfflineGraceExceeded(platformUrl, userData, machineId, graceMs)
      if (!graceBlocksFile) {
        let platform = snapshotUnreachableWithDeadline(platformUrl, userData, machineId)
        if (platformUrl) {
          const pingOutcome = await pingLicensePlatform(platformUrl, machineId)
          platform = snapshotFromPing(pingOutcome)
          logLicenseStatusPing(pingOutcome, platform)
          if (pingOutcome.reachable) {
            const b = pingOutcome.body
            writeRollingSyncCache(userData, {
              nextRequiredSyncBeforeMs: b.nextRequiredSyncBeforeMs ?? null,
              serverTimeMs:
                typeof b.serverTimeMs === 'number' && Number.isFinite(b.serverTimeMs) ? b.serverTimeMs : null,
              lastReachablePingAtLocalMs: Date.now(),
              lastPingPerfMs: performance.now(),
            })
            if (b.ok) writePlatformGrantCacheFromPing(userData, b)
            else clearPlatformGrantCache(userData)
          }
        }
        return {
          enforced: true,
          ok: true,
          machineId,
          reason: 'valid',
          tier: off.tier,
          expiresAtMs: off.expiresAtMs,
          platform,
          effectiveNowMs,
        }
      }
    }

    let platform: LicensePlatformSnapshot | undefined
    let pingOutcome: PlatformPingOutcome | undefined
    if (platformUrl) {
      pingOutcome = await pingLicensePlatform(platformUrl, machineId)
      platform = snapshotFromPing(pingOutcome)
      logLicenseStatusPing(pingOutcome, platform)
      if (platformUrl && platform?.reachable && pingOutcome?.reachable) {
        const b = pingOutcome.body
        writeRollingSyncCache(userData, {
          nextRequiredSyncBeforeMs: b.nextRequiredSyncBeforeMs ?? null,
          serverTimeMs:
            typeof b.serverTimeMs === 'number' && Number.isFinite(b.serverTimeMs) ? b.serverTimeMs : null,
          lastReachablePingAtLocalMs: Date.now(),
          lastPingPerfMs: performance.now(),
        })
        if (b.ok) writePlatformGrantCacheFromPing(userData, b)
        else clearPlatformGrantCache(userData)
      }
    }

    if (platformUrl && platform?.reachable) {
      if (platform.ok) {
        const tier =
          platform.tier !== undefined && platform.tier !== null && isLicenseTier(platform.tier)
            ? platform.tier
            : undefined
        return {
          enforced: true,
          ok: true,
          machineId,
          reason: 'valid',
          tier,
          expiresAtMs: platform.expiresAtMs ?? null,
          platform,
          effectiveNowMs,
        }
      }
      return {
        enforced: true,
        ok: false,
        machineId,
        reason: 'platform_denied',
        platform,
        effectiveNowMs,
      }
    }

    const grant = readPlatformGrantCache(userData)
    if (grant && isPlatformGrantCacheStillValid(grant, machineId, getEffectiveNowMs(userData))) {
      const pingErr = platform?.reachable === false ? platform.networkError : undefined
      const effDeadline = offlineSyncDeadlineMs(userData, machineId, platformUrl)
      if (isOfflineGraceExceeded(platformUrl, userData, machineId, graceMs)) {
        return {
          enforced: true,
          ok: false,
          machineId,
          reason: 'rolling_deadline_passed',
          platform: {
            enabled: Boolean(platformUrl),
            reachable: false,
            ...(effDeadline != null ? { nextRequiredSyncBeforeMs: effDeadline } : {}),
            ...(pingErr ? { networkError: pingErr } : {}),
          },
          effectiveNowMs,
        }
      }
      const tier = isLicenseTier(grant.tier) ? grant.tier : undefined
      return {
        enforced: true,
        ok: true,
        machineId,
        reason: 'valid',
        tier,
        expiresAtMs: grant.expiresAtMs,
        platform: {
          enabled: Boolean(platformUrl),
          reachable: false,
          nextRequiredSyncBeforeMs: effDeadline ?? grant.nextRequiredSyncBeforeMs,
          ...(pingErr ? { networkError: pingErr } : {}),
        },
        effectiveNowMs,
      }
    }

    if (off.ok && isOfflineGraceExceeded(platformUrl, userData, machineId, graceMs)) {
      const eff = offlineSyncDeadlineMs(userData, machineId, platformUrl)
      return {
        enforced: true,
        ok: false,
        machineId,
        reason: 'rolling_deadline_passed',
        platform: {
          enabled: Boolean(platformUrl),
          reachable: false,
          ...(eff != null ? { nextRequiredSyncBeforeMs: eff } : {}),
          ...(platform?.reachable === false && platform.networkError ? { networkError: platform.networkError } : {}),
        },
        effectiveNowMs,
      }
    }

    return {
      enforced: true,
      ok: false,
      machineId,
      reason: !off.ok ? off.reason : 'rolling_deadline_passed',
      platform,
      effectiveNowMs,
    }
  })

  ipcMain.handle(
    'license-import-path',
    (_e, sourcePath: unknown): { ok: true } | { ok: false; error: string } => {
      if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
        return { ok: false, error: 'INVALID_PATH' }
      }
      return importLicenseFromAbsolutePath(sourcePath)
    },
  )

  ipcMain.handle(
    'license-pick-and-import',
    async (): Promise<{ ok: true } | { ok: false; error: string }> => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win) return { ok: false, error: 'NO_WINDOW' }
      const r = await dialog.showOpenDialog(win, {
        title: 'license.json',
        filters: [{ name: 'License', extensions: ['json'] }],
        properties: ['openFile'],
      })
      if (r.canceled || !r.filePaths[0]) return { ok: false, error: 'CANCELLED' }
      return importLicenseFromAbsolutePath(r.filePaths[0])
    },
  )

  ipcMain.handle('license-copy-machine-id', () => {
    const id = getMachineId()
    clipboard.writeText(id)
    return id
  })
}
