import type { LicensePayloadV1 } from '../types/license'

/** Stable UTF-8 string used for Ed25519 signing (must match issuing scripts). */
export function canonicalLicensePayloadString(payload: LicensePayloadV1): string {
  const ordered = {
    expiresAtMs: payload.expiresAtMs,
    issuedAtMs: payload.issuedAtMs,
    machineId: payload.machineId,
    tier: payload.tier,
    v: payload.v,
  }
  return JSON.stringify(ordered)
}
