import { useState, useEffect } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { parseWeekdaysJson } from '../utils/weekdays';

// Types
export type ComboPricingMode = 'fixed' | 'sum';
export type ComboItemInput = { product_id: number; quantity: number };

export interface ComboProductRef {
  id: number;
  name: string;
  price: number;
  quantity: number;
  kitchen_id?: number | null;
}

export interface DailyDeal {
  id: number;
  product_id: number;
  special_price: number;
  date: string;
  created_at: string;
  product_name?: string;
  /** 1 = مفعّل في نقطة البيع */
  is_active?: number;
  archived_at?: string | null;
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

export interface Combo {
  id: number;
  combo_name: string;
  combo_price: number;
  pricing_mode?: ComboPricingMode;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_ids?: number[];
  products?: ComboProductRef[];
  /** مطابق لـ getDay()؛ غير مُعرّف أو فارغ = كل الأيام */
  weekdays?: number[];
  archived_at?: string | null;
}

export interface ScheduledOffer {
  id: number;
  product_id: number | null;
  combo_id: number | null;
  special_price: number;
  start_datetime: string;
  end_datetime: string;
  is_active: number;
  created_at: string;
  product_name?: string;
  combo_name?: string;
  archived_at?: string | null;
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

export interface HappyHour {
  id: number;
  product_id: number;
  happy_hour_price: number;
  time_start: string;
  time_end: string;
  is_active: number;
  created_at: string;
  product_name?: string;
  weekdays?: number[];
  archived_at?: string | null;
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

function normalizeBundleProducts(raw: { products?: ComboProductRef[] }): ComboProductRef[] {
  return (raw.products || []).map((p) => ({
    ...p,
    quantity: Math.max(1, Number(p.quantity) || 1),
  }));
}

function normalizeComboRow(raw: Combo): Combo {
  const products = normalizeBundleProducts(raw);
  return {
    ...raw,
    pricing_mode: raw.pricing_mode === 'sum' ? 'sum' : 'fixed',
    products,
    weekdays: parseWeekdaysJson((raw as unknown as { weekdays?: unknown }).weekdays),
  };
}

function normalizeDailyDealRow(raw: DailyDeal): DailyDeal {
  const products = normalizeBundleProducts(raw);
  return {
    ...raw,
    pricing_mode: raw.pricing_mode === 'sum' ? 'sum' : 'fixed',
    products,
    product_ids: products.map((p) => p.id),
  };
}

function normalizeScheduledRow(raw: ScheduledOffer): ScheduledOffer {
  const products = normalizeBundleProducts(raw);
  return {
    ...raw,
    pricing_mode: raw.pricing_mode === 'sum' ? 'sum' : 'fixed',
    products,
    product_ids: products.map((p) => p.id),
  };
}

function normalizeHappyHourRow(raw: HappyHour): HappyHour {
  const products = normalizeBundleProducts(raw);
  return {
    ...raw,
    pricing_mode: raw.pricing_mode === 'sum' ? 'sum' : 'fixed',
    products,
    product_ids: products.map((p) => p.id),
    weekdays: parseWeekdaysJson((raw as unknown as { weekdays?: unknown }).weekdays),
  };
}

export function useOffers() {
  const [dailyDeals, setDailyDeals] = useState<DailyDeal[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [scheduledOffers, setScheduledOffers] = useState<ScheduledOffer[]>([]);
  const [happyHours, setHappyHours] = useState<HappyHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDailyDeals = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<DailyDeal[]>(`${serverUrl}/offers/daily-deals`);
      setDailyDeals((data || []).map(normalizeDailyDealRow));
    } catch (e: any) {
      console.error('Failed to load daily deals:', e);
      setError(e.message || 'تعذر تحميل عروض اليوم');
    }
  };

  const loadCombos = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<Combo[]>(`${serverUrl}/offers/combos`);
      setCombos((data || []).map(normalizeComboRow));
    } catch (e: any) {
      console.error('Failed to load combos:', e);
      setError(e.message || 'تعذر تحميل العروض المجمعة');
    }
  };

  const loadScheduledOffers = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<ScheduledOffer[]>(`${serverUrl}/offers/scheduled-offers`);
      setScheduledOffers((data || []).map(normalizeScheduledRow));
    } catch (e: any) {
      console.error('Failed to load scheduled offers:', e);
      setError(e.message || 'تعذر تحميل العروض المجدولة');
    }
  };

  const loadHappyHours = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<HappyHour[]>(`${serverUrl}/offers/happy-hour`);
      setHappyHours((data || []).map(normalizeHappyHourRow));
    } catch (e: any) {
      console.error('Failed to load happy hours:', e);
      setError(e.message || 'تعذر تحميل الساعة السعيدة');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([
      loadDailyDeals(),
      loadCombos(),
      loadScheduledOffers(),
      loadHappyHours(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  // Daily Deals
  const createDailyDeal = async (data: {
    product_id?: number;
    special_price?: number;
    date: string;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<DailyDeal>(`${serverUrl}/offers/daily-deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadDailyDeals();
      showToast('تم إنشاء عرض اليوم بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل إنشاء عرض اليوم', 'error');
      throw e;
    }
  };

  const updateDailyDeal = async (
    id: number,
    data: {
      is_active?: number;
      special_price?: number;
      date?: string;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson<DailyDeal>(`${serverUrl}/offers/daily-deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadDailyDeals();
      showToast(
        data.is_active === 0
          ? 'تم تعطيل عرض اليوم'
          : data.is_active === 1
            ? 'تم تفعيل عرض اليوم'
            : 'تم تحديث عرض اليوم',
        'success',
      );
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث عرض اليوم', 'error');
      throw e;
    }
  };

  const deleteDailyDeal = async (id: number) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/offers/daily-deals/${id}`, {
        method: 'DELETE',
      });
      await loadDailyDeals();
      showToast('تم أرشفة عرض اليوم', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل أرشفة عرض اليوم', 'error');
      throw e;
    }
  };

  // Combos
  const createCombo = async (data: {
    combo_name: string;
    combo_price?: number;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
    weekdays?: number[];
  }) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<Combo>(`${serverUrl}/offers/combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (result && result.id) {
        setCombos((prev) => {
          const rest = prev.filter((c) => c.id !== result.id);
          return [normalizeComboRow(result as Combo), ...rest];
        });
      }
      await loadCombos();
      showToast('تم إنشاء العرض المجمع بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل إنشاء العرض المجمع', 'error');
      throw e;
    }
  };

  const updateCombo = async (
    id: number,
    data: {
      combo_name?: string;
      combo_price?: number;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
      is_active?: number;
      weekdays?: number[] | null;
    },
  ) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<Combo>(`${serverUrl}/offers/combos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadCombos();
      showToast('تم تحديث العرض المجمع بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث العرض المجمع', 'error');
      throw e;
    }
  };

  const deleteCombo = async (id: number) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/offers/combos/${id}`, {
        method: 'DELETE',
      });
      await loadCombos();
      showToast('تم أرشفة العرض المجمع', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل أرشفة العرض المجمع', 'error');
      throw e;
    }
  };

  // Scheduled Offers
  const createScheduledOffer = async (data: {
    product_id?: number;
    combo_id?: number;
    special_price?: number;
    start_datetime: string;
    end_datetime: string;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<ScheduledOffer>(`${serverUrl}/offers/scheduled-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadScheduledOffers();
      showToast('تم إنشاء العرض المجدول بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل إنشاء العرض المجدول', 'error');
      throw e;
    }
  };

  const updateScheduledOffer = async (
    id: number,
    data: {
      special_price?: number;
      start_datetime?: string;
      end_datetime?: string;
      is_active?: number;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<ScheduledOffer>(`${serverUrl}/offers/scheduled-offers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadScheduledOffers();
      showToast('تم تحديث العرض المجدول بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث العرض المجدول', 'error');
      throw e;
    }
  };

  const deleteScheduledOffer = async (id: number) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/offers/scheduled-offers/${id}`, {
        method: 'DELETE',
      });
      await loadScheduledOffers();
      showToast('تم أرشفة العرض المجدول', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل أرشفة العرض المجدول', 'error');
      throw e;
    }
  };

  // Happy Hour
  const createHappyHour = async (data: {
    product_id?: number;
    happy_hour_price?: number;
    time_start: string;
    time_end: string;
    weekdays?: number[];
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<HappyHour>(`${serverUrl}/offers/happy-hour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadHappyHours();
      showToast('تم إنشاء الساعة السعيدة بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل إنشاء الساعة السعيدة', 'error');
      throw e;
    }
  };

  const updateHappyHour = async (
    id: number,
    data: {
      happy_hour_price?: number;
      time_start?: string;
      time_end?: string;
      is_active?: number;
      weekdays?: number[] | null;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<HappyHour>(`${serverUrl}/offers/happy-hour/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadHappyHours();
      showToast('تم تحديث الساعة السعيدة بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث الساعة السعيدة', 'error');
      throw e;
    }
  };

  const deleteHappyHour = async (id: number) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/offers/happy-hour/${id}`, {
        method: 'DELETE',
      });
      await loadHappyHours();
      showToast('تم أرشفة الساعة السعيدة', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل أرشفة الساعة السعيدة', 'error');
      throw e;
    }
  };

  // Helper: parse datetime string (ISO or "YYYY-MM-DD HH:mm:ss") to Date for reliable comparison
  const parseOfferDatetime = (s: string): Date => {
    if (!s) return new Date(0);
    const normalized = s.replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const getActiveDailyDeal = () => {
    const today = new Date().toISOString().split('T')[0];
    return dailyDeals.find((dd) => dd.date === today && (dd.is_active ?? 1) === 1);
  };

  /** Scheduled rows whose datetime window includes now (for admin list + toggle). */
  const getScheduledOffersInCurrentWindow = () => {
    const now = Date.now();
    return scheduledOffers.filter((so) => {
      const start = parseOfferDatetime(so.start_datetime).getTime();
      const end = parseOfferDatetime(so.end_datetime).getTime();
      return start <= now && end >= now;
    });
  };

  const getActiveScheduledOffers = () => {
    const now = Date.now();
    return scheduledOffers.filter((so) => {
      if (so.is_active !== 1) return false;
      const start = parseOfferDatetime(so.start_datetime).getTime();
      const end = parseOfferDatetime(so.end_datetime).getTime();
      return start <= now && end >= now;
    });
  };

  const getExpiredScheduledOffers = () => {
    const now = Date.now();
    return scheduledOffers.filter((so) => parseOfferDatetime(so.end_datetime).getTime() < now);
  };

  const getScheduledOffers = () => {
    const now = Date.now();
    return scheduledOffers.filter(
      (so) => so.is_active === 1 && parseOfferDatetime(so.start_datetime).getTime() > now,
    );
  };

  return {
    // Data
    dailyDeals,
    combos,
    scheduledOffers,
    featuredItems: [] as Array<{ id: number; product_id: number; featured: number; created_at: string; product_name?: string }>,
    happyHours,
    loading,
    error,
    
    // Load functions
    loadAll,
    loadDailyDeals,
    loadCombos,
    loadScheduledOffers,
    loadFeaturedItems: async () => {},
    loadHappyHours,
    
    // Daily Deals
    createDailyDeal,
    updateDailyDeal,
    deleteDailyDeal,
    
    // Combos
    createCombo,
    updateCombo,
    deleteCombo,
    
    // Scheduled Offers
    createScheduledOffer,
    updateScheduledOffer,
    deleteScheduledOffer,
    
    // Featured Items (removed from UI; stub for older call sites)
    setFeatured: async (_product_id: number, _featured: boolean) => {
      throw new Error('Featured products were removed');
    },
    
    // Happy Hour
    createHappyHour,
    updateHappyHour,
    deleteHappyHour,
    
    // Helpers
    getActiveDailyDeal,
    getScheduledOffersInCurrentWindow,
    getActiveScheduledOffers,
    getExpiredScheduledOffers,
    getScheduledOffers,
  };
}

