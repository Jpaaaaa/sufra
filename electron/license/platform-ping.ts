import type { PlatformPingResponse } from '../shared/types/platform-devices'

export type PlatformPingOutcome =
  | { reachable: false; error: string }
  | { reachable: true; body: PlatformPingResponse }

function parsePingTimeoutMs(): number {
  const raw = process.env.AMAAN_LICENSE_PING_TIMEOUT_MS?.trim()
  if (!raw) return 5000
  const n = Number(raw)
  if (!Number.isFinite(n)) return 5000
  return Math.min(60_000, Math.max(2000, Math.round(n)))
}

/** POST /api/platform/v1/ping */
export async function pingLicensePlatform(
  baseUrl: string,
  machineId: string,
): Promise<PlatformPingOutcome> {
  const root = baseUrl.trim().replace(/\/$/, '')
  const url = `${root}/api/platform/v1/ping`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), parsePingTimeoutMs())
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, product: 'sufra_lite' }),
      signal: ac.signal,
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return {
        reachable: false,
        error: !res.ok ? `HTTP ${res.status}` : 'Invalid JSON from license server',
      }
    }
    const body = parsed as Partial<PlatformPingResponse>
    if (typeof body.ok !== 'boolean' || typeof body.machineId !== 'string') {
      return {
        reachable: false,
        error: !res.ok ? `HTTP ${res.status}` : 'Unexpected license server response',
      }
    }
    const dateHdr = res.headers.get('date')
    const fromDateHeader = dateHdr ? Date.parse(dateHdr) : NaN
    const serverTimeMs =
      typeof body.serverTimeMs === 'number' && Number.isFinite(body.serverTimeMs)
        ? body.serverTimeMs
        : Number.isFinite(fromDateHeader)
          ? fromDateHeader
          : Date.now()
    const normalized: PlatformPingResponse = {
      ...(body as PlatformPingResponse),
      serverTimeMs,
    }
    return { reachable: true, body: normalized }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { reachable: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
