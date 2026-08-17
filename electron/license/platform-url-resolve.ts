import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { App } from 'electron'
import { AMAAN_PLATFORM_URL_EMBEDDED } from './embedded-urls'

export function platformLicenseUrlFilePath(app: App): string {
  return path.join(app.getPath('userData'), 'platform-license-url.txt')
}

export function readStoredPlatformLicenseUrl(app: App): string | null {
  try {
    const fp = platformLicenseUrlFilePath(app)
    if (!existsSync(fp)) return null
    const line = readFileSync(fp, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#'))
    return line ?? null
  } catch {
    return null
  }
}

export function normalizePlatformLicenseBaseUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withProto = /^https?:\/\//i.test(t) ? t : `http://${t}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

export function resolvePlatformUrl(app: App): string | undefined {
  const env = process.env.AMAAN_PLATFORM_URL?.trim()
  if (env) return normalizePlatformLicenseBaseUrl(env) ?? env

  const fromFile = readStoredPlatformLicenseUrl(app)
  if (fromFile) return normalizePlatformLicenseBaseUrl(fromFile) ?? fromFile

  const embedded = AMAAN_PLATFORM_URL_EMBEDDED.trim()
  if (embedded) return normalizePlatformLicenseBaseUrl(embedded) ?? embedded

  return undefined
}
