import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'

const FILENAME = 'license-rolling-sync-cache.json'

export type RollingSyncCacheV3 = {
  v: 3
  nextRequiredSyncBeforeMs: number | null
  serverTimeMs: number | null
  lastReachablePingAtLocalMs: number | null
  /** `performance.now()` captured when `serverTimeMs` was recorded (monotonic clock anchor). */
  lastPingPerfMs: number | null
}

function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (raw.v !== 1) return null
  const n = raw.nextRequiredSyncBeforeMs
  const s = raw.serverTimeMs
  if (n !== null && (typeof n !== 'number' || !Number.isFinite(n))) return null
  if (s !== null && s !== undefined && (typeof s !== 'number' || !Number.isFinite(s))) return null
  return {
    v: 2,
    nextRequiredSyncBeforeMs: n === null || n === undefined ? null : n,
    serverTimeMs: s === null || s === undefined ? null : s,
    lastReachablePingAtLocalMs: null,
  }
}

function migrateV2RecordToV3(o: Record<string, unknown>): RollingSyncCacheV3 | null {
  const n = o.nextRequiredSyncBeforeMs
  const s = o.serverTimeMs
  const l = o.lastReachablePingAtLocalMs
  if (n !== null && (typeof n !== 'number' || !Number.isFinite(n))) return null
  if (s !== null && s !== undefined && (typeof s !== 'number' || !Number.isFinite(s))) return null
  if (l !== null && l !== undefined && (typeof l !== 'number' || !Number.isFinite(l))) return null
  return {
    v: 3,
    nextRequiredSyncBeforeMs: n === null || n === undefined ? null : n,
    serverTimeMs: s === null || s === undefined ? null : s,
    lastReachablePingAtLocalMs: l === null || l === undefined ? null : l,
    lastPingPerfMs: null,
  }
}

export function rollingSyncCachePath(userData: string): string {
  return path.join(userData, FILENAME)
}

export function readRollingSyncCache(userData: string): RollingSyncCacheV3 | null {
  const fp = rollingSyncCachePath(userData)
  if (!existsSync(fp)) return null
  try {
    const raw = readFileSync(fp, 'utf8')
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    let o = j as Record<string, unknown>

    if (o.v === 1) {
      const m = migrateV1ToV2(o)
      if (m == null) return null
      o = m
    }

    if (o.v === 2) {
      const m3 = migrateV2RecordToV3(o)
      if (m3 == null) return null
      return m3
    }

    if (o.v !== 3) return null
    const n = o.nextRequiredSyncBeforeMs
    const s = o.serverTimeMs
    const l = o.lastReachablePingAtLocalMs
    const p = o.lastPingPerfMs
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n))) return null
    if (s !== null && s !== undefined && (typeof s !== 'number' || !Number.isFinite(s))) return null
    if (l !== null && l !== undefined && (typeof l !== 'number' || !Number.isFinite(l))) return null
    if (p !== null && p !== undefined && (typeof p !== 'number' || !Number.isFinite(p))) return null
    return {
      v: 3,
      nextRequiredSyncBeforeMs: n === null || n === undefined ? null : n,
      serverTimeMs: s === null || s === undefined ? null : s,
      lastReachablePingAtLocalMs: l === null || l === undefined ? null : l,
      lastPingPerfMs: p === null || p === undefined ? null : p,
    }
  } catch {
    return null
  }
}

/**
 * Current instant for license comparisons: server time + monotonic elapsed since last ping when anchored,
 * otherwise local wall clock.
 */
export function getEffectiveNowMs(userData: string): number {
  const r = readRollingSyncCache(userData)
  if (
    r &&
    typeof r.serverTimeMs === 'number' &&
    Number.isFinite(r.serverTimeMs) &&
    typeof r.lastPingPerfMs === 'number' &&
    Number.isFinite(r.lastPingPerfMs)
  ) {
    return r.serverTimeMs + (performance.now() - r.lastPingPerfMs)
  }
  return Date.now()
}

export function writeRollingSyncCache(
  userData: string,
  data: {
    nextRequiredSyncBeforeMs: number | null
    serverTimeMs: number | null
    lastReachablePingAtLocalMs: number
    lastPingPerfMs: number | null
  },
): void {
  const fp = rollingSyncCachePath(userData)
  const payload: RollingSyncCacheV3 = {
    v: 3,
    nextRequiredSyncBeforeMs: data.nextRequiredSyncBeforeMs,
    serverTimeMs: data.serverTimeMs,
    lastReachablePingAtLocalMs: data.lastReachablePingAtLocalMs,
    lastPingPerfMs: data.lastPingPerfMs,
  }
  mkdirSync(path.dirname(fp), { recursive: true })
  writeFileSync(fp, JSON.stringify(payload), 'utf8')
}

export function clearRollingSyncCache(userData: string): void {
  const fp = rollingSyncCachePath(userData)
  if (!existsSync(fp)) return
  try {
    unlinkSync(fp)
  } catch {
    /* ignore */
  }
}

export function seedRollingCacheAfterLicenseImport(userData: string, nowMs: number = Date.now()): void {
  writeRollingSyncCache(userData, {
    nextRequiredSyncBeforeMs: null,
    serverTimeMs: null,
    lastReachablePingAtLocalMs: nowMs,
    lastPingPerfMs: null,
  })
}
