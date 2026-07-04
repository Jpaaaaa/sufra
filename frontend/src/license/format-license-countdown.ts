export type LicenseCountdownDisplayFormat = 'stopwatch' | 'days_minutes'

export function formatLicenseRemainMs(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '00:00:00'
  const totalSec = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}d ${p(hours)}:${p(minutes)}:${p(seconds)}`
  return `${p(hours)}:${p(minutes)}:${p(seconds)}`
}

export function formatLicenseRemainDaysMinutes(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '0d 0m'
  const totalSec = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const remSec = totalSec % 86400
  const minutes = Math.floor(remSec / 60)
  return `${days}d ${minutes}m`
}

export function formatLicenseCountdownDisplay(
  remainingMs: number,
  format: LicenseCountdownDisplayFormat,
): string {
  return format === 'days_minutes'
    ? formatLicenseRemainDaysMinutes(remainingMs)
    : formatLicenseRemainMs(remainingMs)
}
