/// <reference types="vite/client" />

export type AmaanPreloadApi = {
  apiPort: number
  getApiPort: () => Promise<number>
  licenseGetStatus: () => Promise<import('./src/license/types').LicenseGetStatusResponse>
  licenseGetPlatformUrlSettings: () => Promise<{
    envActive: boolean
    fileUrl: string | null
    resolvedUrl: string | null
  }>
  licenseSetPlatformUrl: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>
  licenseGetPollIntervalMs: () => Promise<number | null>
  licenseImportFromPath: (absolutePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
  licensePickAndImport: () => Promise<{ ok: true } | { ok: false; error: string }>
  licenseImportJson: (jsonText: string) => Promise<{ ok: true } | { ok: false; error: string }>
  licenseCopyMachineId: () => Promise<string>
  updateGetState: () => Promise<unknown>
  updateCheckNow: () => Promise<{ ok: true } | { ok: false; error: string }>
  updateDownload: () => Promise<{ ok: true } | { ok: false; error: string }>
  updateInstallNow: () => Promise<{ ok: true } | { ok: false; error: string }>
  updateOnStateChange?: (cb: (state: unknown) => void) => () => void
}

declare global {
  interface Window {
    amaan?: AmaanPreloadApi
  }
}

export {}
