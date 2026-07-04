/** Mirrors `electron/shared/types/app-update.ts` for renderer typing. */
export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled'

export type AppUpdateDownloadProgress = {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type AppUpdateState = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string | null
  releaseDate?: string | null
  progress?: AppUpdateDownloadProgress | null
  errorMessage?: string | null
  lastCheckedAtMs?: number | null
  feedUrl?: string | null
}

export type AppUpdateActionResult = { ok: true } | { ok: false; error: string }
