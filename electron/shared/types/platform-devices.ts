/** Admin / licensing platform (hosted separately from POS). */
export type PlatformLicenseTier = '5d' | '15d' | '1m' | '2m' | 'lifetime' | 'custom'

export type PlatformDeviceRow = {
  machineId: string
  label: string | null
  tier: PlatformLicenseTier
  expiresAtMs: number | null
  revoked: boolean
  lastSyncAtMs: number | null
  createdAtMs: number
  updatedAtMs: number
  notes: string | null
  rollingMaxMs: number | null
}

export type PlatformDevicePublicStatus =
  | 'active'
  | 'revoked'
  | 'expired'
  | 'sync_required'
  | 'unknown_device'

export type PlatformPingResponse = {
  ok: boolean
  status: PlatformDevicePublicStatus
  machineId: string
  tier: PlatformLicenseTier | null
  expiresAtMs: number | null
  daysUntilExpiry: number | null
  nextRequiredSyncBeforeMs: number | null
  serverTimeMs: number
  message?: string
}
