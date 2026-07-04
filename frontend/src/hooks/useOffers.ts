import { useState, useEffect } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { parseWeekdaysJson } from '../utils/weekdays';

// Types
export interface DailyDeal {
  id: number;
  product_id: number;
  special_price: number;
  date: string;
  created_at: string;
  product_name?: string;
  /** 1 = مفعّل في نقطة البيع */
  is_active?: number;
}

export interface Combo {
  id: number;
  combo_name: string;
  combo_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_ids?: number[];
  products?: Array<{ id: number; name: string; price: number }>;
  /** مطابق لـ getDay()؛ غير مُعرّف أو فارغ = كل الأيام */
  weekdays?: number[];
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
}

export interface FeaturedItem {
  id: number;
  product_id: number;
  featured: number;
  created_at: string;
  product_name?: string;
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
}

function normalizeComboRow(raw: Combo): Combo {
  return { ...raw, weekdays: parseWeekdaysJson((raw as unknown as { weekdays?: unknown }).weekdays) };
}

function normalizeHappyHourRow(raw: HappyHour): HappyHour {
  return { ...raw, weekdays: parseWeekdaysJson((raw as unknown as { weekdays?: unknown }).weekdays) };
}

export function useOffers() {
  const [dailyDeals, setDailyDeals] = useState<DailyDeal[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [scheduledOffers, setScheduledOffers] = useState<ScheduledOffer[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [happyHours, setHappyHours] = useState<HappyHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDailyDeals = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<DailyDeal[]>(`${serverUrl}/offers/daily-deals`);
      setDailyDeals(data || []);
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
      setScheduledOffers(data || []);
    } catch (e: any) {
      console.error('Failed to load scheduled offers:', e);
      setError(e.message || 'تعذر تحميل العروض المجدولة');
    }
  };

  const loadFeaturedItems = async () => {
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<FeaturedItem[]>(`${serverUrl}/offers/featured-items`);
      setFeaturedItems(data || []);
    } catch (e: any) {
      console.error('Failed to load featured items:', e);
      setError(e.message || 'تعذر تحميل الوجبات المميزة');
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
      loadFeaturedItems(),
      loadHappyHours(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  // Daily Deals
  const createDailyDeal = async (data: { product_id: number; special_price: number; date: string }) => {
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

  const updateDailyDeal = async (id: number, data: { is_active: number }) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson<DailyDeal>(`${serverUrl}/offers/daily-deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await loadDailyDeals();
      showToast(data.is_active === 1 ? 'تم تفعيل عرض اليوم' : 'تم تعطيل عرض اليوم', 'success');
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
      showToast('تم حذف عرض اليوم بنجاح', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل حذف عرض اليوم', 'error');
      throw e;
    }
  };

  // Combos
  const createCombo = async (data: {
    combo_name: string;
    combo_price: number;
    product_ids: number[];
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
    data: { combo_name?: string; combo_price?: number; product_ids?: number[]; is_active?: number; weekdays?: number[] | null },
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
      showToast('تم حذف العرض المجمع بنجاح', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل حذف العرض المجمع', 'error');
      throw e;
    }
  };

  // Scheduled Offers
  const createScheduledOffer = async (data: {
    product_id?: number;
    combo_id?: number;
    special_price: number;
    start_datetime: string;
    end_datetime: string;
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
    data: { special_price?: number; start_datetime?: string; end_datetime?: string; is_active?: number },
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
      showToast('تم حذف العرض المجدول بنجاح', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل حذف العرض المجدول', 'error');
      throw e;
    }
  };

  // Featured Items
  const setFeatured = async (product_id: number, featured: boolean) => {
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<FeaturedItem>(`${serverUrl}/offers/featured-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id, featured }),
      });
      await loadFeaturedItems();
      showToast(featured ? 'تم تمييز المنتج بنجاح' : 'تم إلغاء تمييز المنتج بنجاح', 'success');
      return result;
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث حالة التمييز', 'error');
      throw e;
    }
  };

  // Happy Hour
  const createHappyHour = async (data: {
    product_id: number;
    happy_hour_price: number;
    time_start: string;
    time_end: string;
    weekdays?: number[];
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
    data: { happy_hour_price?: number; time_start?: string; time_end?: string; is_active?: number; weekdays?: number[] | null },
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
      showToast('تم حذف الساعة السعيدة بنجاح', 'success');
    } catch (e: any) {
      showToast(e.message || 'فشل حذف الساعة السعيدة', 'error');
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
    featuredItems,
    happyHours,
    loading,
    error,
    
    // Load functions
    loadAll,
    loadDailyDeals,
    loadCombos,
    loadScheduledOffers,
    loadFeaturedItems,
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
    
    // Featured Items
    setFeatured,
    
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

