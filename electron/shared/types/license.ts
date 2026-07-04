/** Offline license tiers (machine-bound, signed file). */
export type LicenseTierId = '5d' | '15d' | '1m' | '2m' | 'lifetime' | 'custom'

export type LicensePayloadV1 = {
  v: 1
  machineId: string
  tier: LicenseTierId
  issuedAtMs: number
  /** `null` when tier is lifetime */
  expiresAtMs: number | null
}

export type SignedLicenseFileV1 = {
  fileVersion: 1
  payload: LicensePayloadV1
  signatureBase64: string
}

export type LicenseDenyReason =
  | 'valid'
  | 'not_enforced'
  | 'no_file'
  | 'invalid_file'
  | 'bad_signature'
  | 'wrong_machine'
  | 'expired'
  | 'rolling_deadline_passed'
  | 'platform_denied'

export type LicensePlatformSnapshot = {
  enabled: boolean
  reachable: boolean
  ok?: boolean
  status?: string
  message?: string
  tier?: LicenseTierId | string | null
  expiresAtMs?: number | null
  daysUntilExpiry?: number | null
  nextRequiredSyncBeforeMs?: number | null
  networkError?: string
}

export type LicensePlatformUrlSettings = {
  envActive: boolean
  fileUrl: string | null
  resolvedUrl: string | null
}

export type LicenseGetStatusResponse = {
  enforced: boolean
  ok: boolean
  machineId: string
  reason: LicenseDenyReason
  tier?: LicenseTierId
  expiresAtMs?: number | null
  platform?: LicensePlatformSnapshot
  /** Main-process “now” for countdowns: server-anchored + monotonic when possible, else wall clock. */
  effectiveNowMs?: number
}
