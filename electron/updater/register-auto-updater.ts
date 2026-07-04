import { app, BrowserWindow, ipcMain } from 'electron'
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from 'electron-updater'
import type {
  AppUpdateActionResult,
  AppUpdateDownloadProgress,
  AppUpdateState,
  AppUpdateStatus,
} from '../shared/types/app-update'
import { resolveUpdateFeedUrl } from './resolve-update-feed-url'

const INITIAL_CHECK_DELAY_MS = 15_000
const PERIODIC_CHECK_INTERVAL_MS = 60 * 60 * 1000

let registered = false
let state: AppUpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseDate: null,
  progress: null,
  errorMessage: null,
  lastCheckedAtMs: null,
  feedUrl: null,
}

function broadcastState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('amaan-update-state', { state })
    }
  }
}

function setStatus(next: AppUpdateStatus, patch: Partial<AppUpdateState> = {}): void {
  state = { ...state, status: next, ...patch }
  broadcastState()
}

function progressFromEvent(p: {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}): AppUpdateDownloadProgress {
  return {
    percent: Number.isFinite(p.percent) ? Math.max(0, Math.min(100, p.percent)) : 0,
    bytesPerSecond: p.bytesPerSecond ?? 0,
    transferred: p.transferred ?? 0,
    total: p.total ?? 0,
  }
}

function wireUpdaterEvents(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    setStatus('checking', { errorMessage: null })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setStatus('available', {
      availableVersion: info.version,
      releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : null,
      errorMessage: null,
      progress: null,
      lastCheckedAtMs: Date.now(),
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setStatus('up-to-date', {
      availableVersion: info.version ?? null,
      errorMessage: null,
      progress: null,
      lastCheckedAtMs: Date.now(),
    })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    setStatus('downloading', {
      progress: progressFromEvent(p),
      errorMessage: null,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    setStatus('downloaded', {
      availableVersion: info.version,
      releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : null,
      progress: { percent: 100, bytesPerSecond: 0, transferred: 0, total: 0 },
      errorMessage: null,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    setStatus('error', {
      errorMessage: err?.message || String(err),
      progress: null,
      lastCheckedAtMs: Date.now(),
    })
  })
}

function configureFeed(): boolean {
  const feedUrl = resolveUpdateFeedUrl(app)
  state.feedUrl = feedUrl
  try {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
    return true
  } catch (err) {
    setStatus('error', {
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

async function checkNow(): Promise<AppUpdateActionResult> {
  if (!app.isPackaged) {
    return { ok: false, error: 'DEV_MODE' }
  }
  if (!configureFeed()) {
    return { ok: false, error: state.errorMessage || 'FEED_CONFIG_FAILED' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus('error', { errorMessage: message, lastCheckedAtMs: Date.now() })
    return { ok: false, error: message }
  }
}

async function downloadNow(): Promise<AppUpdateActionResult> {
  if (!app.isPackaged) return { ok: false, error: 'DEV_MODE' }
  if (state.status !== 'available' && state.status !== 'error') {
    return { ok: false, error: 'NO_UPDATE' }
  }
  try {
    setStatus('downloading', { progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 } })
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus('error', { errorMessage: message })
    return { ok: false, error: message }
  }
}

function installNow(): AppUpdateActionResult {
  if (!app.isPackaged) return { ok: false, error: 'DEV_MODE' }
  if (state.status !== 'downloaded') return { ok: false, error: 'NOT_DOWNLOADED' }
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true }
}

export function registerAutoUpdater(): void {
  if (registered) return
  registered = true

  ipcMain.removeHandler('amaan-update-get-state')
  ipcMain.removeHandler('amaan-update-check-now')
  ipcMain.removeHandler('amaan-update-download')
  ipcMain.removeHandler('amaan-update-install')

  ipcMain.handle('amaan-update-get-state', (): AppUpdateState => state)
  ipcMain.handle('amaan-update-check-now', async (): Promise<AppUpdateActionResult> => checkNow())
  ipcMain.handle('amaan-update-download', async (): Promise<AppUpdateActionResult> => downloadNow())
  ipcMain.handle('amaan-update-install', (): AppUpdateActionResult => installNow())

  if (!app.isPackaged) {
    setStatus('disabled', {
      errorMessage: 'Auto-update runs only in the packaged app (Electron).',
    })
    return
  }

  if (process.env.AMAAN_DISABLE_UPDATES === '1') {
    setStatus('disabled', { errorMessage: 'Auto-update disabled via AMAAN_DISABLE_UPDATES=1.' })
    return
  }

  wireUpdaterEvents()
  configureFeed()

  setTimeout(() => {
    void checkNow()
  }, INITIAL_CHECK_DELAY_MS)

  setInterval(() => {
    if (state.status === 'downloading' || state.status === 'downloaded') return
    void checkNow()
  }, PERIODIC_CHECK_INTERVAL_MS)
}
