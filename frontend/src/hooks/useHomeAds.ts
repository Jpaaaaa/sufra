import { useEffect, useState } from 'react';
import type { HomeAd } from '../types/homeAds';
import { DEFAULT_HOME_AD } from '../types/homeAds';
import { getServerUrl, fetchJson } from '../utils';

function normalizeAds(raw: unknown): HomeAd[] {
  if (!Array.isArray(raw)) return [];
  const out: HomeAd[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' || typeof o.id === 'number' ? String(o.id) : '';
    const title = typeof o.title === 'string' ? o.title : '';
    const imageUrl = typeof o.imageUrl === 'string' ? o.imageUrl : '';
    const linkUrl = typeof o.linkUrl === 'string' ? o.linkUrl : '';
    if (!id || !imageUrl || !linkUrl) continue;
    // Remote ads need a title unless marked image-only
    const imageOnly = o.imageOnly === true;
    if (!imageOnly && !title) continue;
    const linkTarget = o.linkTarget === 'external' ? 'external' : 'internal';
    out.push({
      id,
      title,
      subtitle: typeof o.subtitle === 'string' ? o.subtitle : undefined,
      imageUrl,
      ctaLabel: typeof o.ctaLabel === 'string' ? o.ctaLabel : undefined,
      linkUrl,
      linkTarget,
      imageOnly,
    });
  }
  return out;
}

/**
 * Loads home ads asynchronously.
 * If the activation panel returns none (or errors), falls back to the default banner.
 */
export function useHomeAds(): { ads: HomeAd[]; isLoading: boolean } {
  const [ads, setAds] = useState<HomeAd[]>([DEFAULT_HOME_AD]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const serverUrl = getServerUrl();
        const data = await fetchJson<unknown>(`${serverUrl}/ads/active`);
        const remote = normalizeAds(data);
        if (!cancelled) {
          setAds(remote.length > 0 ? remote : [DEFAULT_HOME_AD]);
        }
      } catch {
        if (!cancelled) setAds([DEFAULT_HOME_AD]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ads, isLoading };
}
