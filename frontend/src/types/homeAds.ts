export type HomeAdLinkTarget = 'internal' | 'external';

export interface HomeAd {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  linkUrl: string;
  linkTarget: HomeAdLinkTarget;
  /** Full artwork banner — no text/CTA overlay (used for default fallback). */
  imageOnly?: boolean;
}

/** Default home banner when activation panel returns no ads. */
export const DEFAULT_HOME_AD: HomeAd = {
  id: 'default-bazar-one',
  title: '',
  imageUrl: './ads/bazar-one-hero.png',
  linkUrl: 'https://amaantechnology.com/products/trade-retail/bazaar-one-pos',
  linkTarget: 'external',
  imageOnly: true,
};
