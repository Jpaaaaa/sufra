import { createPublicKey, verify } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { canonicalLicensePayloadString } from '../shared/license/canonical'
import type {
  LicenseDenyReason,
  LicensePayloadV1,
  LicenseTierId,
  SignedLicenseFileV1,
} from '../shared/types/license'
import { AMAAN_LICENSE_PUBLIC_KEY_PEM } from './public-key-pem'

export type LicenseVerifyOk = {
  ok: true
  reason: 'valid'
  payload: LicensePayloadV1
}

export type LicenseVerifyFail = {
  ok: false
  reason: Exclude<
    LicenseDenyReason,
    'valid' | 'not_enforced' | 'platform_denied' | 'rolling_deadline_passed'
  >
}

function isTier(x: unknown): x is LicenseTierId {
  return (
    x === '5d' ||
    x === '15d' ||
    x === '1m' ||
    x === '2m' ||
    x === 'lifetime' ||
    x === 'custom'
  )
}

function parseSignedFile(raw: string): SignedLicenseFileV1 | null {
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (o.fileVersion !== 1) return null
    const payload = o.payload as Record<string, unknown> | undefined
    const sig = o.signatureBase64
    if (!payload || typeof sig !== 'string') return null
    if (payload.v !== 1 || typeof payload.machineId !== 'string') return null
    if (!isTier(payload.tier)) return null
    if (typeof payload.issuedAtMs !== 'number') return null
    const exp = payload.expiresAtMs
    if (exp !== null && typeof exp !== 'number') return null
    const typed: LicensePayloadV1 = {
      v: 1,
      machineId: payload.machineId,
      tier: payload.tier,
      issuedAtMs: payload.issuedAtMs,
      expiresAtMs: exp === null || exp === undefined ? null : exp,
    }
    return { fileVersion: 1, payload: typed, signatureBase64: sig }
  } catch {
    return null
  }
}

export function verifyPayloadSignature(payload: LicensePayloadV1, signatureBase64: string): boolean {
  try {
    const msg = canonicalLicensePayloadString(payload)
    const key = createPublicKey(AMAAN_LICENSE_PUBLIC_KEY_PEM)
    const sig = Buffer.from(signatureBase64, 'base64')
    return verify(null, Buffer.from(msg, 'utf8'), key, sig)
  } catch {
    return false
  }
}

export function verifyLicenseFileContents(
  raw: string,
  currentMachineId: string,
  atMs: number = Date.now(),
): LicenseVerifyOk | LicenseVerifyFail {
  const parsed = parseSignedFile(raw)
  if (!parsed) return { ok: false, reason: 'invalid_file' }

  const { payload, signatureBase64 } = parsed
  if (!verifyPayloadSignature(payload, signatureBase64)) {
    return { ok: false, reason: 'bad_signature' }
  }

  if (payload.machineId !== currentMachineId) {
    return { ok: false, reason: 'wrong_machine' }
  }

  const tier = payload.tier
  const exp = payload.expiresAtMs
  if (tier === 'lifetime') {
    if (exp !== null) return { ok: false, reason: 'invalid_file' }
  } else if (exp === null || typeof exp !== 'number') {
    return { ok: false, reason: 'invalid_file' }
  }

  if (tier !== 'lifetime' && exp !== null && atMs > exp) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, reason: 'valid', payload }
}

export function verifyLicenseAtPath(
  filePath: string,
  currentMachineId: string,
  atMs: number = Date.now(),
): LicenseVerifyOk | LicenseVerifyFail {
  try {
    const raw = readFileSync(filePath, 'utf8')
    return verifyLicenseFileContents(raw, currentMachineId, atMs)
  } catch {
    return { ok: false, reason: 'no_file' }
  }
}

export function licenseFilePath(userData: string): string {
  return path.join(userData, 'license.json')
}
