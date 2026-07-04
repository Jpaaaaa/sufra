export const LICENSE_POLL_MS_MIN = 3_000
export const LICENSE_POLL_MS_MAX = 600_000

export const LICENSE_POLL_PRESET_MS = [
  3_000, 5_000, 8_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000,
] as const

export type LicensePollPresetMs = (typeof LICENSE_POLL_PRESET_MS)[number]

export function isPresetPollMs(ms: number): boolean {
  return (LICENSE_POLL_PRESET_MS as readonly number[]).includes(ms)
}

export function clampLicensePollMs(n: number): number {
  return Math.min(LICENSE_POLL_MS_MAX, Math.max(LICENSE_POLL_MS_MIN, Math.round(n)))
}

export function nearestLicensePollPresetMs(ms: number): LicensePollPresetMs {
  const c = clampLicensePollMs(ms)
  let best: LicensePollPresetMs = LICENSE_POLL_PRESET_MS[0]
  let bestDiff = Math.abs(c - best)
  for (const p of LICENSE_POLL_PRESET_MS) {
    const d = Math.abs(c - p)
    if (d < bestDiff) {
      best = p
      bestDiff = d
    }
  }
  return best
}

export function parseLicensePollMsFromEnv(raw: string | undefined): number | null {
  const t = raw?.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return clampLicensePollMs(n)
}
