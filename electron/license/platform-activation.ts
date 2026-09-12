import { app } from 'electron'
import type { PlatformStoreSnapshot } from '../shared/types/platform-devices'
import type { RestaurantProfileSaveBody } from '../shared/types/restaurant-profile'
import { getMachineId } from './machine-id'
import { resolvePlatformUrl } from './platform-url-resolve'

export type SubmitActivationResult =
  | { ok: true; status: 'pending' }
  | { ok: false; error: string }

function profileToStoreSnapshot(body: RestaurantProfileSaveBody): PlatformStoreSnapshot | null {
  const storeName = body.restaurantName?.trim()
  if (!storeName) return null

  const trimOpt = (v: string | null | undefined, max: number): string | null => {
    if (v == null) return null
    const t = v.trim()
    if (!t) return null
    return t.length > max ? t.slice(0, max) : t
  }

  return {
    storeName: storeName.length > 120 ? storeName.slice(0, 120) : storeName,
    phone: trimOpt(body.phone, 40),
    addressLine: trimOpt(body.addressLine, 200),
    city: trimOpt(body.city, 80),
    storeType: 'other',
    storeTypeOther: 'restaurant',
    ownerContactName: trimOpt(body.ownerContactName, 120),
  }
}

export async function submitActivationRequest(
  profile: RestaurantProfileSaveBody,
): Promise<SubmitActivationResult> {
  const baseUrl = resolvePlatformUrl(app)
  if (!baseUrl) return { ok: false, error: 'NO_PLATFORM_URL' }

  const store = profileToStoreSnapshot(profile)
  if (!store) return { ok: false, error: 'NO_STORE_NAME' }

  const machineId = getMachineId()
  const url = `${baseUrl.replace(/\/$/, '')}/api/platform/v1/activation-requests`

  const body = {
    product: 'sufra_lite',
    machineId,
    storeName: store.storeName,
    phone: store.phone,
    addressLine: store.addressLine,
    city: store.city,
    storeType: store.storeType,
    storeTypeOther: store.storeTypeOther,
    ownerContactName: store.ownerContactName,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (res.status === 429) return { ok: false, error: 'RATE_LIMITED' }
    if (!res.ok) {
      try {
        const j = JSON.parse(text) as { error?: string }
        return { ok: false, error: j.error ?? `HTTP_${res.status}` }
      } catch {
        return { ok: false, error: `HTTP_${res.status}` }
      }
    }
    return { ok: true, status: 'pending' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'NETWORK' }
  }
}
