export type LicenseTierId = '5d' | '15d' | '1m' | '2m' | 'lifetime' | 'custom'

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
