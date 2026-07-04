import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import type { PlatformPingResponse } from '../shared/types/platform-devices'

const FILENAME = 'license-platform-grant-cache.json'

export type PlatformGrantCacheV1 = {
  v: 1
  machineId: string
  tier: string
  expiresAtMs: number | null
  nextRequiredSyncBeforeMs: number
  serverTimeMs: number
  savedAtLocalMs: number
}

export function platformGrantCachePath(userData: string): string {
  return path.join(userData, FILENAME)
}

export function readPlatformGrantCache(userData: string): PlatformGrantCacheV1 | null {
  const fp = platformGrantCachePath(userData)
  if (!existsSync(fp)) return null
  try {
    const raw = readFileSync(fp, 'utf8')
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (o.v !== 1) return null
    const machineId = typeof o.machineId === 'string' ? o.machineId.trim() : ''
    const tier = typeof o.tier === 'string' ? o.tier : ''
    if (!machineId || !tier) return null
    const expiresAtMs =
      o.expiresAtMs === null || o.expiresAtMs === undefined
        ? null
        : typeof o.expiresAtMs === 'number' && Number.isFinite(o.expiresAtMs)
          ? o.expiresAtMs
          : null
    const n = o.nextRequiredSyncBeforeMs
    const s = o.serverTimeMs
    const saved = o.savedAtLocalMs
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    if (typeof s !== 'number' || !Number.isFinite(s)) return null
    if (typeof saved !== 'number' || !Number.isFinite(saved)) return null
    return {
      v: 1,
      machineId,
      tier,
      expiresAtMs,
      nextRequiredSyncBeforeMs: n,
      serverTimeMs: s,
      savedAtLocalMs: saved,
    }
  } catch {
    return null
  }
}

export function writePlatformGrantCacheFromPing(userData: string, body: PlatformPingResponse): void {
  if (!body.ok || typeof body.machineId !== 'string' || !body.machineId.trim()) return
  const n = body.nextRequiredSyncBeforeMs
  if (typeof n !== 'number' || !Number.isFinite(n)) return
  if (!body.tier) return

  const fp = platformGrantCachePath(userData)
  const payload: PlatformGrantCacheV1 = {
    v: 1,
    machineId: body.machineId.trim(),
    tier: body.tier,
    expiresAtMs: body.expiresAtMs ?? null,
    nextRequiredSyncBeforeMs: n,
    serverTimeMs: typeof body.serverTimeMs === 'number' && Number.isFinite(body.serverTimeMs) ? body.serverTimeMs : Date.now(),
    savedAtLocalMs: Date.now(),
  }
  mkdirSync(path.dirname(fp), { recursive: true })
  writeFileSync(fp, JSON.stringify(payload), 'utf8')
}

export function clearPlatformGrantCache(userData: string): void {
  const fp = platformGrantCachePath(userData)
  if (!existsSync(fp)) return
  try {
    unlinkSync(fp)
  } catch {
    /* ignore */
  }
}

export function isPlatformGrantCacheStillValid(
  cache: PlatformGrantCacheV1,
  machineId: string,
  nowMs: number = Date.now(),
): boolean {
  if (cache.machineId !== machineId) return false
  if (nowMs > cache.nextRequiredSyncBeforeMs) return false
  if (cache.expiresAtMs != null && Number.isFinite(cache.expiresAtMs) && nowMs > cache.expiresAtMs) return false
  return true
}
