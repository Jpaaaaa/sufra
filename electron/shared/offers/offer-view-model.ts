import {
  resolveOfferStatus,
  type OfferStatusCode,
  type OfferType,
  isMultiProductOffer,
} from './offer-domain';
import { savingsFromPrices } from './offer-domain';

export interface OfferProductRef {
  id: number;
  name: string;
  price?: number;
  quantity?: number;
}

export interface OfferViewModel {
  id: number;
  type: OfferType;
  title: string;
  targetType: 'product' | 'combo' | 'bundle' | 'none';
  targetId: number | null;
  targetLabel: string;
  basePrice: number | null;
  offerPrice: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  startAt: string | null;
  endAt: string | null;
  weekdays: number[] | undefined;
  isActive: boolean;
  archivedAt: string | null;
  status: OfferStatusCode;
  createdAt: string | null;
  updatedAt: string | null;
  /** Extra payload for editors */
  raw: unknown;
}

function withSavings(
  base: number | null,
  offer: number | null,
): Pick<OfferViewModel, 'discountAmount' | 'discountPercent'> {
  if (base == null || offer == null) return { discountAmount: null, discountPercent: null };
  const s = savingsFromPrices(base, offer);
  return { discountAmount: s.discountAmount, discountPercent: s.discountPercent };
}

function formatContentsLabel(products?: OfferProductRef[]): string {
  if (!products?.length) return '';
  return products
    .map((p) => {
      const q = Math.max(1, Number(p.quantity) || 1);
      return q > 1 ? `${q}× ${p.name}` : p.name;
    })
    .join(' · ');
}

function contentsSum(products?: OfferProductRef[]): number | null {
  if (!products?.length) return null;
  return products.reduce(
    (s, p) => s + (p.price || 0) * Math.max(1, Number(p.quantity) || 1),
    0,
  );
}

export function dailyDealToViewModel(
  d: {
    id: number;
    product_id: number;
    special_price: number;
    date: string;
    is_active?: number;
    archived_at?: string | null;
    created_at?: string;
    product_name?: string;
    catalog_price?: number;
    pricing_mode?: string;
    products?: OfferProductRef[];
  },
  now = new Date(),
): OfferViewModel {
  const isActive = d.is_active !== 0;
  const label = formatContentsLabel(d.products) || d.product_name || `#${d.product_id}`;
  const basePrice = contentsSum(d.products) ?? d.catalog_price ?? null;
  const offerPrice = d.special_price;
  const multi = isMultiProductOffer(d.products);
  return {
    id: d.id,
    type: 'daily_deal',
    title: label,
    targetType: multi ? 'bundle' : 'product',
    targetId: d.product_id,
    targetLabel: label,
    basePrice,
    offerPrice,
    ...withSavings(basePrice, offerPrice),
    startAt: d.date,
    endAt: d.date,
    weekdays: undefined,
    isActive,
    archivedAt: d.archived_at ?? null,
    status: resolveOfferStatus(
      {
        type: 'daily_deal',
        isActive,
        archivedAt: d.archived_at,
        date: d.date,
      },
      now,
    ),
    createdAt: d.created_at ?? null,
    updatedAt: null,
    raw: d,
  };
}

export function comboToViewModel(
  c: {
    id: number;
    combo_name: string;
    combo_price: number;
    pricing_mode?: string;
    is_active?: number;
    archived_at?: string | null;
    weekdays?: number[];
    created_at?: string;
    updated_at?: string;
    products?: Array<{ name: string; quantity?: number; price?: number }>;
  },
  now = new Date(),
): OfferViewModel {
  const isActive = c.is_active !== 0;
  const contents =
    c.products?.map((p) => {
      const q = Math.max(1, Number(p.quantity) || 1);
      return q > 1 ? `${q}× ${p.name}` : p.name;
    }) ?? [];
  const contentsTotal =
    c.products?.reduce((s, p) => s + (p.price || 0) * Math.max(1, Number(p.quantity) || 1), 0) ??
    null;
  const basePrice = contentsTotal;
  return {
    id: c.id,
    type: 'combo',
    title: c.combo_name,
    targetType: 'combo',
    targetId: c.id,
    targetLabel: contents.join(' · ') || c.combo_name,
    basePrice,
    offerPrice: c.combo_price,
    ...withSavings(basePrice, c.combo_price),
    startAt: null,
    endAt: null,
    weekdays: c.weekdays,
    isActive,
    archivedAt: c.archived_at ?? null,
    status: resolveOfferStatus(
      {
        type: 'combo',
        isActive,
        archivedAt: c.archived_at,
        weekdays: c.weekdays,
      },
      now,
    ),
    createdAt: c.created_at ?? null,
    updatedAt: c.updated_at ?? null,
    raw: c,
  };
}

export function scheduledToViewModel(
  s: {
    id: number;
    product_id: number | null;
    combo_id: number | null;
    special_price: number;
    start_datetime: string;
    end_datetime: string;
    is_active?: number;
    archived_at?: string | null;
    created_at?: string;
    product_name?: string;
    combo_name?: string;
    catalog_price?: number;
    pricing_mode?: string;
    products?: OfferProductRef[];
  },
  now = new Date(),
): OfferViewModel {
  const isActive = s.is_active !== 0;
  const isCombo = s.combo_id != null && !(s.products && s.products.length > 0);
  const contentsLabel = formatContentsLabel(s.products);
  const title = isCombo
    ? s.combo_name || `Combo #${s.combo_id}`
    : contentsLabel || s.product_name || `Product #${s.product_id}`;
  const basePrice = contentsSum(s.products) ?? s.catalog_price ?? null;
  const multi = isMultiProductOffer(s.products);
  return {
    id: s.id,
    type: 'scheduled',
    title,
    targetType: isCombo ? 'combo' : multi ? 'bundle' : 'product',
    targetId: isCombo ? s.combo_id : s.product_id,
    targetLabel: title,
    basePrice,
    offerPrice: s.special_price,
    ...withSavings(basePrice, s.special_price),
    startAt: s.start_datetime,
    endAt: s.end_datetime,
    weekdays: undefined,
    isActive,
    archivedAt: s.archived_at ?? null,
    status: resolveOfferStatus(
      {
        type: 'scheduled',
        isActive,
        archivedAt: s.archived_at,
        startAt: s.start_datetime,
        endAt: s.end_datetime,
      },
      now,
    ),
    createdAt: s.created_at ?? null,
    updatedAt: null,
    raw: s,
  };
}

export function happyHourToViewModel(
  h: {
    id: number;
    product_id: number;
    happy_hour_price: number;
    time_start: string;
    time_end: string;
    weekdays?: number[];
    is_active?: number;
    archived_at?: string | null;
    created_at?: string;
    product_name?: string;
    catalog_price?: number;
    pricing_mode?: string;
    products?: OfferProductRef[];
  },
  now = new Date(),
): OfferViewModel {
  const isActive = h.is_active !== 0;
  const label = formatContentsLabel(h.products) || h.product_name || `#${h.product_id}`;
  const basePrice = contentsSum(h.products) ?? h.catalog_price ?? null;
  const multi = isMultiProductOffer(h.products);
  return {
    id: h.id,
    type: 'happy_hour',
    title: label,
    targetType: multi ? 'bundle' : 'product',
    targetId: h.product_id,
    targetLabel: label,
    basePrice,
    offerPrice: h.happy_hour_price,
    ...withSavings(basePrice, h.happy_hour_price),
    startAt: h.time_start,
    endAt: h.time_end,
    weekdays: h.weekdays,
    isActive,
    archivedAt: h.archived_at ?? null,
    status: resolveOfferStatus(
      {
        type: 'happy_hour',
        isActive,
        archivedAt: h.archived_at,
        timeStart: h.time_start,
        timeEnd: h.time_end,
        weekdays: h.weekdays,
      },
      now,
    ),
    createdAt: h.created_at ?? null,
    updatedAt: null,
    raw: h,
  };
}
