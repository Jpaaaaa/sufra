import type { App } from 'electron'

/** Canonical generic update feed (electron-updater `latest.yml` + artifacts). Never localhost or platform-derived fallbacks. */
export const SUFRA_LITE_UPDATE_FEED_URL = 'https://bazarone.amaantechnology.com/updates/sufra_lite/'

export function resolveUpdateFeedUrl(_app: App): string {
  return SUFRA_LITE_UPDATE_FEED_URL
}
