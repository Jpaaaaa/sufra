'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOffers, type Combo } from '../../hooks/useOffers';
import type { Item } from '../../hooks/useItems';
import { showConfirm } from '../ui/ConfirmDialog';
import { showToast } from '../ui/Toast';
import { OfferSideDrawer } from './OfferSideDrawer';
import { WeekdayCheckboxes } from './WeekdayCheckboxes';
import { ComboContentsPicker } from './ComboContentsPicker';
import {
  comboToViewModel,
  dailyDealToViewModel,
  featuredToViewModel,
  happyHourToViewModel,
  scheduledToViewModel,
  savingsFromPrices,
  type OfferViewModel,
  type OfferStatusCode,
  type OfferType,
  happyHourCrossesMidnight,
  mergeComboItems,
  sumComboContentsPrice,
} from '../../lib/offers';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';
import { formatWeekdaysOffer } from '../../utils/weekdays';

interface OffersCenterProps {
  offers: ReturnType<typeof useOffers>;
  items: Item[];
  isManager: boolean;
}

type EditorMode = 'create' | 'edit';
type StatusTab = 'all' | 'active_now' | 'scheduled' | 'inactive' | 'expired';

const STATUS_TABS: StatusTab[] = ['all', 'active_now', 'scheduled', 'inactive', 'expired'];

function statusTone(status: OfferStatusCode): string {
  switch (status) {
    case 'active_now':
      return 'bg-emerald-100 text-emerald-800';
    case 'scheduled':
    case 'outside_time':
      return 'bg-amber-100 text-amber-900';
    case 'inactive':
    case 'expired':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-red-100 text-red-800';
  }
}

export default function OffersCenter({ offers, items, isManager }: OffersCenterProps) {
  const { t } = useTranslation();
  const currency = t('orders.currency');
  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : t('halls.priceWithCurrency', { price: n, currency });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<OfferType | 'all'>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editorType, setEditorType] = useState<OfferType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [details, setDetails] = useState<OfferViewModel | null>(null);

  // Shared form state (simplified multi-type)
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formWeekdays, setFormWeekdays] = useState<number[]>([]);
  const [formPricingMode, setFormPricingMode] = useState<'fixed' | 'sum'>('fixed');
  const [formItems, setFormItems] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formTimeStart, setFormTimeStart] = useState('17:00');
  const [formTimeEnd, setFormTimeEnd] = useState('20:00');
  const [formTargetKind, setFormTargetKind] = useState<'product' | 'combo'>('product');
  const [formComboId, setFormComboId] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  const priceField = useGlobalNumericField(formPrice, (next) => {
    setFormPrice(next);
    setDirty(true);
  });

  const catalogById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const viewModels = useMemo(() => {
    const now = new Date();
    const list: OfferViewModel[] = [];
    for (const d of offers.dailyDeals) {
      list.push(
        dailyDealToViewModel(
          {
            ...d,
            catalog_price: catalogById.get(d.product_id)?.price,
            archived_at: (d as { archived_at?: string | null }).archived_at,
          },
          now,
        ),
      );
    }
    for (const c of offers.combos) {
      list.push(
        comboToViewModel(
          { ...c, archived_at: (c as { archived_at?: string | null }).archived_at },
          now,
        ),
      );
    }
    for (const s of offers.scheduledOffers) {
      const catalog =
        s.product_id != null
          ? catalogById.get(s.product_id)?.price
          : offers.combos.find((c) => c.id === s.combo_id)?.combo_price;
      list.push(
        scheduledToViewModel(
          {
            ...s,
            catalog_price: catalog,
            archived_at: (s as { archived_at?: string | null }).archived_at,
          },
          now,
        ),
      );
    }
    for (const f of offers.featuredItems) {
      list.push(
        featuredToViewModel(
          {
            ...f,
            catalog_price: catalogById.get(f.product_id)?.price,
            archived_at: (f as { archived_at?: string | null }).archived_at,
          },
          now,
        ),
      );
    }
    for (const h of offers.happyHours) {
      list.push(
        happyHourToViewModel(
          {
            ...h,
            catalog_price: catalogById.get(h.product_id)?.price,
            archived_at: (h as { archived_at?: string | null }).archived_at,
          },
          now,
        ),
      );
    }
    return list;
  }, [offers, catalogById]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let activeNow = 0;
    let upcoming = 0;
    let stopped = 0;
    let endingToday = 0;
    for (const v of viewModels) {
      if (v.archivedAt) continue;
      if (v.status === 'active_now') activeNow += 1;
      else if (v.status === 'scheduled' || v.status === 'outside_time') upcoming += 1;
      else if (v.status === 'inactive' || v.status === 'expired') stopped += 1;
      if (v.endAt && String(v.endAt).startsWith(today) && v.status === 'active_now') {
        endingToday += 1;
      }
      if (v.type === 'daily_deal' && v.startAt === today && v.status === 'active_now') {
        // already in activeNow
      }
    }
    return { activeNow, upcoming, stopped, endingToday };
  }, [viewModels]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return viewModels.filter((v) => {
      if (!showArchived && v.archivedAt) return false;
      if (showArchived && !v.archivedAt) {
        /* allow both when show archived — show all */
      }
      if (typeFilter !== 'all' && v.type !== typeFilter) return false;
      if (statusTab !== 'all') {
        if (statusTab === 'active_now' && v.status !== 'active_now') return false;
        if (statusTab === 'scheduled' && v.status !== 'scheduled' && v.status !== 'outside_time')
          return false;
        if (statusTab === 'inactive' && v.status !== 'inactive') return false;
        if (statusTab === 'expired' && v.status !== 'expired' && !v.archivedAt) return false;
      }
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.targetLabel.toLowerCase().includes(q) ||
        v.type.includes(q)
      );
    });
  }, [viewModels, search, typeFilter, statusTab, showArchived]);

  const contentsTotal = useMemo(() => {
    return sumComboContentsPrice(
      formItems.map((row) => ({
        product_id: row.product_id,
        quantity: row.quantity,
        unit_price: catalogById.get(row.product_id)?.price ?? 0,
      })),
    );
  }, [formItems, catalogById]);

  const selectedProduct = catalogById.get(Number(formProductId));
  const dailySavings =
    selectedProduct && formPrice
      ? savingsFromPrices(selectedProduct.price, Number(formPrice) || 0)
      : null;

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormProductId('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormWeekdays([]);
    setFormPricingMode('fixed');
    setFormItems([]);
    setFormStart('');
    setFormEnd('');
    setFormTimeStart('17:00');
    setFormTimeEnd('20:00');
    setFormTargetKind('product');
    setFormComboId('');
    setFormActive(true);
    setProductSearch('');
    setDirty(false);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setEditorMode('create');
    setEditorType(null);
    setEditorOpen(true);
  };

  const openEdit = (vm: OfferViewModel) => {
    resetForm();
    setEditorMode('edit');
    setEditorType(vm.type);
    setEditingId(vm.id);
    setFormActive(vm.isActive);
    if (vm.type === 'daily_deal') {
      const raw = vm.raw as { product_id: number; special_price: number; date: string };
      setFormProductId(String(raw.product_id));
      setFormPrice(String(raw.special_price));
      setFormDate(raw.date);
    } else if (vm.type === 'combo') {
      const raw = vm.raw as Combo;
      setFormName(raw.combo_name);
      setFormPrice(String(raw.combo_price));
      setFormPricingMode(raw.pricing_mode === 'sum' ? 'sum' : 'fixed');
      setFormWeekdays(raw.weekdays?.length ? [...raw.weekdays] : []);
      setFormItems(
        (raw.products || []).map((p) => ({
          product_id: p.id,
          quantity: Math.max(1, Number(p.quantity) || 1),
        })),
      );
    } else if (vm.type === 'scheduled') {
      const raw = vm.raw as {
        product_id: number | null;
        combo_id: number | null;
        special_price: number;
        start_datetime: string;
        end_datetime: string;
      };
      setFormTargetKind(raw.combo_id != null ? 'combo' : 'product');
      setFormProductId(raw.product_id != null ? String(raw.product_id) : '');
      setFormComboId(raw.combo_id != null ? String(raw.combo_id) : '');
      setFormPrice(String(raw.special_price));
      setFormStart(raw.start_datetime.replace(' ', 'T').slice(0, 16));
      setFormEnd(raw.end_datetime.replace(' ', 'T').slice(0, 16));
    } else if (vm.type === 'happy_hour') {
      const raw = vm.raw as {
        product_id: number;
        happy_hour_price: number;
        time_start: string;
        time_end: string;
        weekdays?: number[];
      };
      setFormProductId(String(raw.product_id));
      setFormPrice(String(raw.happy_hour_price));
      setFormTimeStart(raw.time_start.slice(0, 5));
      setFormTimeEnd(raw.time_end.slice(0, 5));
      setFormWeekdays(raw.weekdays?.length ? [...raw.weekdays] : []);
    } else if (vm.type === 'featured') {
      const raw = vm.raw as { product_id: number };
      setFormProductId(String(raw.product_id));
    }
    setEditorOpen(true);
    setDirty(false);
  };

  const closeEditor = async () => {
    if (dirty) {
      const ok = await showConfirm({
        title: t('offers.unsavedTitle', { defaultValue: 'تغييرات غير محفوظة' }),
        message: t('offers.unsavedMessage', { defaultValue: 'هل تريد إغلاق النموذج وفقدان التغييرات؟' }),
        confirmText: t('offers.discard', { defaultValue: 'تجاهل' }),
        cancelText: t('halls.cancel'),
      });
      if (!ok) return;
    }
    setEditorOpen(false);
    resetForm();
  };

  const invokeDuplicate = async (vm: OfferViewModel) => {
    const sufra = window.sufra?.offers;
    try {
      if (vm.type === 'combo' && sufra?.duplicateCombo) await sufra.duplicateCombo(vm.id);
      else if (vm.type === 'daily_deal' && sufra?.duplicateDailyDeal)
        await sufra.duplicateDailyDeal(vm.id);
      else if (vm.type === 'happy_hour' && sufra?.duplicateHappyHour)
        await sufra.duplicateHappyHour(vm.id);
      else if (vm.type === 'scheduled' && sufra?.duplicateScheduledOffer)
        await sufra.duplicateScheduledOffer(vm.id);
      else {
        showToast(t('offers.duplicateUnsupported', { defaultValue: 'النسخ غير متاح لهذا النوع' }), 'error');
        return;
      }
      await offers.loadAll();
      showToast(t('offers.duplicated', { defaultValue: 'تم إنشاء نسخة (غير مفعّلة)' }), 'success');
    } catch (e: any) {
      showToast(e.message || 'Duplicate failed', 'error');
    }
  };

  const archiveOffer = async (vm: OfferViewModel) => {
    const ok = await showConfirm({
      title: t('offers.deleteConfirmTitle', { defaultValue: 'حذف العرض' }),
      message: t('offers.deleteConfirmMessage', {
        defaultValue: 'سيتم أرشفة العرض وإخفاؤه من نقطة البيع (يمكن إظهار المؤرشف لاحقاً). المتابعة؟',
      }),
      confirmText: t('offers.delete', { defaultValue: 'حذف' }),
      cancelText: t('halls.cancel'),
      confirmColor: 'danger',
    });
    if (!ok) return;
    try {
      if (vm.type === 'daily_deal') await offers.deleteDailyDeal(vm.id);
      else if (vm.type === 'combo') await offers.deleteCombo(vm.id);
      else if (vm.type === 'scheduled') await offers.deleteScheduledOffer(vm.id);
      else if (vm.type === 'happy_hour') await offers.deleteHappyHour(vm.id);
      else if (vm.type === 'featured') await offers.setFeatured(vm.targetId!, false);
      setDetails(null);
    } catch {
      /* toast in hook */
    }
  };

  const toggleActive = async (vm: OfferViewModel) => {
    try {
      const next = vm.isActive ? 0 : 1;
      if (vm.type === 'daily_deal') await offers.updateDailyDeal(vm.id, { is_active: next });
      else if (vm.type === 'combo') await offers.updateCombo(vm.id, { is_active: next });
      else if (vm.type === 'scheduled') await offers.updateScheduledOffer(vm.id, { is_active: next });
      else if (vm.type === 'happy_hour') await offers.updateHappyHour(vm.id, { is_active: next });
    } catch {
      /* toast */
    }
  };

  const saveEditor = async () => {
    if (!editorType || saving) return;
    setSaving(true);
    try {
      if (editorType === 'daily_deal') {
        if (!formProductId) {
          showToast(t('offers.validationPickProduct', { defaultValue: 'اختر منتجاً' }), 'error');
          return;
        }
        if (!formPrice || Number(formPrice) < 0) {
          showToast(t('offers.validationOfferPrice', { defaultValue: 'أدخل سعر العرض' }), 'error');
          return;
        }
        if (!formDate) {
          showToast(t('offers.validationDate', { defaultValue: 'أدخل التاريخ' }), 'error');
          return;
        }
        if (editorMode === 'edit' && editingId) {
          await offers.updateDailyDeal(editingId, { is_active: formActive ? 1 : 0 });
        } else {
          await offers.createDailyDeal({
            product_id: Number(formProductId),
            special_price: Number(formPrice),
            date: formDate,
          });
        }
      } else if (editorType === 'combo') {
        const itemsPayload = mergeComboItems(formItems);
        const name = formName.trim();
        if (!name) {
          showToast(t('offers.validationOfferName', { defaultValue: 'أدخل اسم العرض' }), 'error');
          return;
        }
        if (itemsPayload.length === 0) {
          showToast(t('offers.validationComboItems', { defaultValue: 'أضف منتجاً واحداً على الأقل للصينية' }), 'error');
          return;
        }
        if (formPricingMode === 'fixed') {
          const priceNum = Number(formPrice);
          if (!Number.isFinite(priceNum) || formPrice.trim() === '' || priceNum < 0) {
            showToast(t('offers.validationOfferPrice', { defaultValue: 'أدخل سعر العرض' }), 'error');
            return;
          }
        }
        const payload = {
          combo_name: name,
          pricing_mode: formPricingMode,
          combo_price: formPricingMode === 'fixed' ? Number(formPrice) : contentsTotal,
          items: itemsPayload,
          weekdays: formWeekdays.length ? formWeekdays : undefined,
          is_active: formActive ? 1 : 0,
        };
        if (editorMode === 'edit' && editingId) {
          await offers.updateCombo(editingId, payload);
        } else {
          await offers.createCombo(payload as any);
        }
      } else if (editorType === 'scheduled') {
        if (!formPrice || Number(formPrice) < 0) {
          showToast(t('offers.validationOfferPrice', { defaultValue: 'أدخل سعر العرض' }), 'error');
          return;
        }
        if (!formStart || !formEnd) {
          showToast(t('offers.validationScheduleDates', { defaultValue: 'أدخل تاريخ البداية والنهاية' }), 'error');
          return;
        }
        if (formTargetKind === 'product' && !formProductId) {
          showToast(t('offers.validationPickProduct', { defaultValue: 'اختر منتجاً' }), 'error');
          return;
        }
        if (formTargetKind === 'combo' && !formComboId) {
          showToast(t('offers.validationPickCombo', { defaultValue: 'اختر عرضاً مجمعاً' }), 'error');
          return;
        }
        const body = {
          product_id: formTargetKind === 'product' ? Number(formProductId) : undefined,
          combo_id: formTargetKind === 'combo' ? Number(formComboId) : undefined,
          special_price: Number(formPrice),
          start_datetime: formStart.replace('T', ' '),
          end_datetime: formEnd.replace('T', ' '),
          is_active: formActive ? 1 : 0,
        };
        if (editorMode === 'edit' && editingId) {
          await offers.updateScheduledOffer(editingId, body);
        } else {
          await offers.createScheduledOffer(body);
        }
      } else if (editorType === 'happy_hour') {
        if (!formProductId) {
          showToast(t('offers.validationPickProduct', { defaultValue: 'اختر منتجاً' }), 'error');
          return;
        }
        if (!formPrice || Number(formPrice) < 0) {
          showToast(t('offers.validationOfferPrice', { defaultValue: 'أدخل سعر العرض' }), 'error');
          return;
        }
        if (!formTimeStart || !formTimeEnd) {
          showToast(t('offers.validationHappyTimes', { defaultValue: 'أدخل وقت البداية والنهاية' }), 'error');
          return;
        }
        const body = {
          product_id: Number(formProductId),
          happy_hour_price: Number(formPrice),
          time_start: formTimeStart,
          time_end: formTimeEnd,
          weekdays: formWeekdays.length ? formWeekdays : undefined,
          is_active: formActive ? 1 : 0,
        };
        if (editorMode === 'edit' && editingId) {
          await offers.updateHappyHour(editingId, {
            happy_hour_price: body.happy_hour_price,
            time_start: body.time_start,
            time_end: body.time_end,
            weekdays: body.weekdays ?? null,
            is_active: body.is_active,
          });
        } else {
          await offers.createHappyHour(body);
        }
      } else if (editorType === 'featured') {
        if (!formProductId) {
          showToast(t('offers.validationPickProduct', { defaultValue: 'اختر منتجاً' }), 'error');
          return;
        }
        await offers.setFeatured(Number(formProductId), true);
      }
      setDirty(false);
      setEditorOpen(false);
      resetForm();
    } catch (e: any) {
      // Hook already toasts; keep drawer open for correction
      console.error('[OffersCenter] save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = items.filter((i) =>
    !productSearch.trim()
      ? true
      : i.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  const typeLabel = (type: OfferType) => {
    const map: Record<OfferType, string> = {
      daily_deal: t('offers.typeDailyDeal', { defaultValue: 'عرض اليوم' }),
      combo: t('offers.typeCombo'),
      scheduled: t('offers.typeScheduled', { defaultValue: 'عرض مجدول' }),
      featured: t('offers.typeFeatured', { defaultValue: 'منتج مميز' }),
      happy_hour: t('offers.typeHappyHour', { defaultValue: 'ساعة سعيدة' }),
    };
    return map[type];
  };

  const statusLabel = (s: OfferStatusCode) =>
    t(`offers.status.${s}`, {
      defaultValue:
        s === 'active_now'
          ? 'نشط الآن'
          : s === 'scheduled'
            ? 'قادم'
            : s === 'inactive'
              ? 'متوقف'
              : s === 'expired'
                ? 'منتهي'
                : s === 'outside_time'
                  ? 'خارج وقت العرض'
                  : 'يوجد خطأ',
    });

  return (
    <div className="mt-4 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-obsidian">{t('nav.offers')}</h2>
          <p className="mt-1 max-w-xl text-[14px] text-obsidian/60">
            {t('offers.centerSubtitle', {
              defaultValue: 'إدارة عروض المطعم والأسعار الترويجية من مكان واحد.',
            })}
          </p>
        </div>
        {isManager ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
          >
            {t('offers.addNewOffer', { defaultValue: '+ عرض جديد' })}
          </button>
        ) : (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-[13px] text-orange-800">
            {t('offers.managerOnlyWarning')}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { key: 'active', label: t('offers.summaryActiveNow', { defaultValue: 'نشطة الآن' }), value: summary.activeNow, tone: 'text-emerald-700' },
          { key: 'up', label: t('offers.summaryUpcoming', { defaultValue: 'قادمة' }), value: summary.upcoming, tone: 'text-amber-700' },
          { key: 'stop', label: t('offers.summaryStopped', { defaultValue: 'متوقفة' }), value: summary.stopped, tone: 'text-slate-600' },
          { key: 'end', label: t('offers.summaryEndingToday', { defaultValue: 'تنتهي اليوم' }), value: summary.endingToday, tone: 'text-obsidian' },
        ].map((card) => (
          <div key={card.key} className="rounded-soft-xl border border-black/5 bg-white p-4 shadow-soft">
            <div className="text-[12px] font-semibold text-obsidian/50">{card.label}</div>
            <div className={`mt-1 text-[28px] font-bold tabular-nums ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-soft-xl border border-black/5 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                statusTab === tab
                  ? 'bg-cyber-aqua text-white'
                  : 'bg-black/[0.04] text-obsidian/70 hover:bg-black/[0.07]'
              }`}
            >
              {t(`offers.tab.${tab}`, {
                defaultValue:
                  tab === 'all'
                    ? 'الكل'
                    : tab === 'active_now'
                      ? 'نشطة الآن'
                      : tab === 'scheduled'
                        ? 'قادمة'
                        : tab === 'inactive'
                          ? 'متوقفة'
                          : 'منتهية',
              })}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('offers.searchPlaceholder', { defaultValue: 'بحث...' })}
            className="min-w-[180px] flex-1 rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] outline-none focus:border-cyber-aqua"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OfferType | 'all')}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px]"
          >
            <option value="all">{t('offers.filterAllTypes', { defaultValue: 'كل الأنواع' })}</option>
            <option value="daily_deal">{typeLabel('daily_deal')}</option>
            <option value="combo">{typeLabel('combo')}</option>
            <option value="scheduled">{typeLabel('scheduled')}</option>
            <option value="featured">{typeLabel('featured')}</option>
            <option value="happy_hour">{typeLabel('happy_hour')}</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-[12px] text-obsidian/70">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t('offers.showArchived', { defaultValue: 'عرض المؤرشف' })}
          </label>
        </div>
      </div>

      {/* List */}
      {offers.loading ? (
        <div className="rounded-soft-xl border border-black/5 bg-white p-10 text-center text-obsidian/50">
          {t('offers.loading', { defaultValue: 'جاري التحميل...' })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-soft-xl border border-dashed border-black/15 bg-white p-10 text-center">
          <p className="text-[15px] font-semibold text-obsidian">
            {search
              ? t('offers.noSearchResults', { defaultValue: 'لا نتائج للبحث' })
              : t('offers.emptyTitle', { defaultValue: 'لا توجد عروض حالياً' })}
          </p>
          {!search && isManager ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-soft-lg bg-cyber-aqua px-4 py-2 text-[14px] font-bold text-white"
            >
              {t('offers.createFirst', { defaultValue: 'إنشاء أول عرض' })}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vm) => (
            <div
              key={`${vm.type}-${vm.id}`}
              className="flex flex-wrap items-center gap-3 rounded-soft-xl border border-black/5 bg-white p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1 text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <h3 className="truncate text-[15px] font-bold text-obsidian">{vm.title}</h3>
                  <span className="rounded-md bg-black/[0.05] px-2 py-0.5 text-[11px] font-bold text-obsidian/70">
                    {typeLabel(vm.type)}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${statusTone(vm.status)}`}>
                    {statusLabel(vm.status)}
                  </span>
                  {vm.archivedAt ? (
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                      {t('offers.archivedBadge', { defaultValue: 'مؤرشف' })}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] text-obsidian/55">{vm.targetLabel}</p>
                <p className="mt-1 text-[13px] text-obsidian/80">
                  {vm.offerPrice != null ? fmt(vm.offerPrice) : '—'}
                  {vm.basePrice != null && vm.discountAmount ? (
                    <span className="mr-2 text-[12px] text-emerald-700">
                      {t('offers.savingsShort', {
                        defaultValue: 'توفير {{amount}} ({{percent}}%)',
                        amount: vm.discountAmount,
                        percent: vm.discountPercent,
                      })}
                    </span>
                  ) : null}
                </p>
                {(vm.weekdays || vm.startAt) && (
                  <p className="mt-0.5 text-[12px] text-obsidian/45">
                    {vm.weekdays ? formatWeekdaysOffer(vm.weekdays) : null}
                    {vm.startAt && vm.endAt ? ` · ${vm.startAt} → ${vm.endAt}` : null}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold hover:bg-black/[0.03]"
                  onClick={() => setDetails(vm)}
                >
                  {t('offers.details', { defaultValue: 'تفاصيل' })}
                </button>
                {isManager ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold hover:bg-black/[0.03]"
                      onClick={() => openEdit(vm)}
                    >
                      {t('halls.edit')}
                    </button>
                    {vm.type !== 'featured' ? (
                      <button
                        type="button"
                        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold hover:bg-black/[0.03]"
                        onClick={() => void invokeDuplicate(vm)}
                      >
                        {t('offers.duplicate', { defaultValue: 'نسخ' })}
                      </button>
                    ) : null}
                    {vm.type !== 'featured' ? (
                      <button
                        type="button"
                        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold hover:bg-black/[0.03]"
                        onClick={() => void toggleActive(vm)}
                      >
                        {vm.isActive ? t('offers.deactivate') : t('offers.activate')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-100"
                      onClick={() => void archiveOffer(vm)}
                    >
                      {t('offers.delete', { defaultValue: 'حذف' })}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor drawer */}
      <OfferSideDrawer
        open={editorOpen}
        widthClassName={editorType === 'combo' ? 'w-full max-w-2xl' : 'w-full max-w-xl'}
        title={
          editorMode === 'edit'
            ? t('offers.editOffer', { defaultValue: 'تعديل عرض' })
            : t('offers.newOffer', { defaultValue: 'عرض جديد' })
        }
        onClose={() => void closeEditor()}
        footer={
          editorType ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void closeEditor()}
                className="rounded-soft-lg border border-black/10 px-4 py-2 text-[14px] font-bold"
              >
                {t('halls.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEditor()}
                className="rounded-soft-lg bg-cyber-aqua px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {saving
                  ? t('offers.saving', { defaultValue: 'جاري الحفظ...' })
                  : t('offers.saveOffer', { defaultValue: 'حفظ العرض' })}
              </button>
            </div>
          ) : null
        }
      >
        {!editorType ? (
          <div className="grid gap-2">
            <p className="mb-2 text-[13px] text-obsidian/60">
              {t('offers.pickOfferType', { defaultValue: 'اختر نوع العرض' })}
            </p>
            {(
              [
                'daily_deal',
                'combo',
                'scheduled',
                'featured',
                'happy_hour',
              ] as OfferType[]
            ).map((ty) => (
              <button
                key={ty}
                type="button"
                onClick={() => {
                  setEditorType(ty);
                  setDirty(true);
                }}
                className="rounded-xl border border-black/10 px-4 py-3 text-right text-[14px] font-bold hover:border-cyber-aqua/40 hover:bg-cyber-aqua/[0.04]"
              >
                {typeLabel(ty)}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4" onChange={() => setDirty(true)}>
            {editorType === 'daily_deal' && (
              <>
                <label className="block text-[13px] font-bold">{t('offers.product')}</label>
                <select
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formProductId}
                  onChange={(e) => {
                    setFormProductId(e.target.value);
                    setDirty(true);
                  }}
                  disabled={editorMode === 'edit'}
                >
                  <option value="">{t('offers.selectProduct')}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {fmt(i.price)}
                    </option>
                  ))}
                </select>
                {selectedProduct ? (
                  <p className="text-[13px] text-obsidian/60">
                    {t('offers.currentPrice', { defaultValue: 'السعر الحالي' })}: {fmt(selectedProduct.price)}
                  </p>
                ) : null}
                <label className="block text-[13px] font-bold">{t('offers.offerPrice', { defaultValue: 'سعر العرض' })}</label>
                <input
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formPrice}
                  onChange={(e) => {
                    setFormPrice(e.target.value);
                    setDirty(true);
                  }}
                  onFocus={priceField.onFocus}
                  disabled={editorMode === 'edit'}
                />
                {dailySavings && dailySavings.discountAmount > 0 ? (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                    {t('offers.savingsPreview', {
                      defaultValue: 'التوفير: {{amount}} ({{percent}}%)',
                      amount: dailySavings.discountAmount,
                      percent: dailySavings.discountPercent,
                    })}
                  </div>
                ) : null}
                <label className="block text-[13px] font-bold">{t('offers.date')}</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value);
                    setDirty(true);
                  }}
                  disabled={editorMode === 'edit'}
                />
              </>
            )}

            {editorType === 'combo' && (
              <div className="space-y-4">
                <div className="sticky top-0 z-10 -mx-1 space-y-3 rounded-soft-lg border border-black/8 bg-white/95 p-3 shadow-sm backdrop-blur">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold">
                      {t('offers.offerName')}
                      <span className="mr-1 text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-soft-lg border border-black/10 px-3 py-2.5 outline-none ring-cyber-aqua/30 focus:ring-2"
                      value={formName}
                      placeholder={t('offers.offerNamePlaceholder', {
                        defaultValue: 'مثال: صينية إفطار',
                      })}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[13px] font-bold">
                      {t('offers.comboPricingModeLabel')}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`rounded-soft-lg border px-3 py-2.5 text-[13px] font-bold transition ${
                          formPricingMode === 'fixed'
                            ? 'border-cyber-aqua bg-cyber-aqua text-white shadow-sm'
                            : 'border-black/10 bg-white text-obsidian/70 hover:bg-black/[0.03]'
                        }`}
                        onClick={() => {
                          setFormPricingMode('fixed');
                          setDirty(true);
                        }}
                      >
                        {t('offers.comboPricingFixed')}
                      </button>
                      <button
                        type="button"
                        className={`rounded-soft-lg border px-3 py-2.5 text-[13px] font-bold transition ${
                          formPricingMode === 'sum'
                            ? 'border-cyber-aqua bg-cyber-aqua text-white shadow-sm'
                            : 'border-black/10 bg-white text-obsidian/70 hover:bg-black/[0.03]'
                        }`}
                        onClick={() => {
                          setFormPricingMode('sum');
                          setFormPrice(String(contentsTotal));
                          setDirty(true);
                        }}
                      >
                        {t('offers.comboPricingSum')}
                      </button>
                    </div>
                  </div>

                  {formPricingMode === 'fixed' ? (
                    <div>
                      <label className="mb-1.5 block text-[13px] font-bold">
                        {t('offers.offerPrice', { defaultValue: 'سعر العرض' })}
                        <span className="mr-1 text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-soft-lg border border-black/10 px-3 py-2.5 outline-none ring-cyber-aqua/30 focus:ring-2"
                        value={formPrice}
                        onChange={(e) => {
                          setFormPrice(e.target.value);
                          setDirty(true);
                        }}
                        onFocus={priceField.onFocus}
                        placeholder={t('offers.offerPrice', { defaultValue: 'سعر العرض' })}
                      />
                      {Number(formPrice) > 0 && contentsTotal > 0 ? (
                        <div className="mt-1.5 text-[12px] font-semibold text-emerald-700">
                          {(() => {
                            const s = savingsFromPrices(contentsTotal, Number(formPrice));
                            return t('offers.savingsPreview', {
                              defaultValue: 'التوفير: {{amount}} ({{percent}}%)',
                              amount: s.discountAmount,
                              percent: s.discountPercent,
                            });
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-soft-lg border border-black/8 bg-slate-50 px-3 py-2">
                      <p className="text-[12px] text-obsidian/50">{t('offers.comboPricingSumHint')}</p>
                      <p className="mt-0.5 text-[16px] font-bold text-obsidian">{fmt(contentsTotal)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="mb-1.5 block text-[13px] font-bold">{t('offers.comboWeekdaysLabel')}</span>
                  <WeekdayCheckboxes
                    idPrefix="combo-v2"
                    value={formWeekdays}
                    onChange={(w) => {
                      setFormWeekdays(w);
                      setDirty(true);
                    }}
                  />
                </div>

                <p className="rounded-soft-lg border border-black/6 bg-slate-50/90 px-3 py-2 text-[12px] leading-relaxed text-obsidian/55">
                  {t('offers.comboTrayHint')}
                </p>

                <ComboContentsPicker
                  items={items}
                  value={formItems}
                  onChange={(next) => {
                    setFormItems(next);
                    setDirty(true);
                    if (formPricingMode === 'sum') {
                      const total = sumComboContentsPrice(
                        next.map((row) => ({
                          product_id: row.product_id,
                          quantity: row.quantity,
                          unit_price: catalogById.get(row.product_id)?.price ?? 0,
                        })),
                      );
                      setFormPrice(String(total));
                    }
                  }}
                  formatPrice={fmt}
                />
              </div>
            )}

            {editorType === 'scheduled' && (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-bold ${
                      formTargetKind === 'product' ? 'border-cyber-aqua bg-cyber-aqua/10' : ''
                    }`}
                    onClick={() => {
                      setFormTargetKind('product');
                      setDirty(true);
                    }}
                  >
                    {t('offers.product')}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-bold ${
                      formTargetKind === 'combo' ? 'border-cyber-aqua bg-cyber-aqua/10' : ''
                    }`}
                    onClick={() => {
                      setFormTargetKind('combo');
                      setDirty(true);
                    }}
                  >
                    {t('offers.typeCombo')}
                  </button>
                </div>
                {formTargetKind === 'product' ? (
                  <select
                    className="w-full rounded-lg border border-black/10 px-3 py-2"
                    value={formProductId}
                    onChange={(e) => {
                      setFormProductId(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="">{t('offers.selectProduct')}</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="w-full rounded-lg border border-black/10 px-3 py-2"
                    value={formComboId}
                    onChange={(e) => {
                      setFormComboId(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="">{t('offers.selectCombo')}</option>
                    {offers.combos
                      .filter((c) => !(c as any).archived_at)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.combo_name}
                        </option>
                      ))}
                  </select>
                )}
                <input
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formPrice}
                  onChange={(e) => {
                    setFormPrice(e.target.value);
                    setDirty(true);
                  }}
                  onFocus={priceField.onFocus}
                  placeholder={t('offers.offerPrice', { defaultValue: 'سعر العرض' })}
                />
                <label className="block text-[12px] font-bold">{t('offers.start')}</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formStart}
                  onChange={(e) => {
                    setFormStart(e.target.value);
                    setDirty(true);
                  }}
                />
                <label className="block text-[12px] font-bold">{t('offers.end')}</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formEnd}
                  onChange={(e) => {
                    setFormEnd(e.target.value);
                    setDirty(true);
                  }}
                />
              </>
            )}

            {editorType === 'happy_hour' && (
              <>
                <select
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formProductId}
                  onChange={(e) => {
                    setFormProductId(e.target.value);
                    setDirty(true);
                  }}
                  disabled={editorMode === 'edit'}
                >
                  <option value="">{t('offers.selectProduct')}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {fmt(i.price)}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-lg border border-black/10 px-3 py-2"
                  value={formPrice}
                  onChange={(e) => {
                    setFormPrice(e.target.value);
                    setDirty(true);
                  }}
                  onFocus={priceField.onFocus}
                  placeholder={t('offers.offerPrice', { defaultValue: 'سعر العرض' })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[12px] font-bold">{t('offers.timeStart')}</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-black/10 px-3 py-2"
                      value={formTimeStart}
                      onChange={(e) => {
                        setFormTimeStart(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold">{t('offers.timeEnd')}</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-black/10 px-3 py-2"
                      value={formTimeEnd}
                      onChange={(e) => {
                        setFormTimeEnd(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </div>
                </div>
                {happyHourCrossesMidnight(formTimeStart, formTimeEnd) ? (
                  <p className="text-[12px] text-amber-800">
                    {t('offers.crossesMidnight', { defaultValue: 'يمتد إلى اليوم التالي' })}
                  </p>
                ) : null}
                <WeekdayCheckboxes
                  idPrefix="hh-v2"
                  value={formWeekdays}
                  onChange={(w) => {
                    setFormWeekdays(w);
                    setDirty(true);
                  }}
                />
              </>
            )}

            {editorType === 'featured' && (
              <>
                <p className="text-[13px] text-obsidian/60">
                  {t('offers.featuredCurrent', { defaultValue: 'المنتجات المميزة حالياً' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {offers.featuredItems.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-bold text-amber-900"
                      onClick={() => void offers.setFeatured(f.product_id, false)}
                    >
                      {f.product_name || `#${f.product_id}`} ×
                    </button>
                  ))}
                </div>
                <input
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]"
                  placeholder={t('offers.searchProduct', { defaultValue: 'بحث منتج...' })}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {filteredProducts.map((item) => {
                    const on = offers.featuredItems.some((f) => f.product_id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={on}
                        className="flex w-full items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-right text-[13px] hover:bg-black/[0.02] disabled:opacity-40"
                        onClick={() => {
                          setFormProductId(String(item.id));
                          setDirty(true);
                          void offers.setFeatured(item.id, true);
                        }}
                      >
                        <span>{item.name}</span>
                        <span className="text-obsidian/45">{fmt(item.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {editorType !== 'featured' && editorMode === 'edit' ? (
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => {
                    setFormActive(e.target.checked);
                    setDirty(true);
                  }}
                />
                {t('offers.activateDirectly', { defaultValue: 'مفعّل' })}
              </label>
            ) : null}
          </div>
        )}
      </OfferSideDrawer>

      {/* Details drawer */}
      <OfferSideDrawer
        open={!!details}
        title={t('offers.details', { defaultValue: 'تفاصيل' })}
        onClose={() => setDetails(null)}
        footer={
          details && isManager ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-[13px] font-bold"
                onClick={() => {
                  const vm = details;
                  setDetails(null);
                  openEdit(vm);
                }}
              >
                {t('halls.edit')}
              </button>
              {details.type !== 'featured' ? (
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-[13px] font-bold"
                  onClick={() => void invokeDuplicate(details)}
                >
                  {t('offers.duplicate', { defaultValue: 'نسخ' })}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700"
                onClick={() => void archiveOffer(details)}
              >
                {t('offers.delete', { defaultValue: 'حذف' })}
              </button>
            </div>
          ) : null
        }
      >
        {details ? (
          <div className="space-y-3 text-[14px]">
            <Row label={t('offers.rowName')}>{details.title}</Row>
            <Row label={t('offers.rowType', { defaultValue: 'النوع' })}>{typeLabel(details.type)}</Row>
            <Row label={t('offers.rowStatus')}>{statusLabel(details.status)}</Row>
            <Row label={t('offers.rowPrice')}>{fmt(details.offerPrice)}</Row>
            <Row label={t('offers.rowBasePrice', { defaultValue: 'السعر الأصلي' })}>
              {fmt(details.basePrice)}
            </Row>
            <Row label={t('offers.rowSavings', { defaultValue: 'التوفير' })}>
              {details.discountAmount != null
                ? `${details.discountAmount} (${details.discountPercent}%)`
                : '—'}
            </Row>
            <Row label={t('offers.rowOfferDays')}>{formatWeekdaysOffer(details.weekdays)}</Row>
            <Row label={t('offers.rowFrom')}>{details.startAt ?? '—'}</Row>
            <Row label={t('offers.rowTo')}>{details.endAt ?? '—'}</Row>
            <Row label={t('offers.rowCreated')}>{details.createdAt ?? '—'}</Row>
            <Row label={t('offers.rowUpdated')}>{details.updatedAt ?? '—'}</Row>
            <Row label={t('offers.rowProducts')}>{details.targetLabel}</Row>
          </div>
        ) : null}
      </OfferSideDrawer>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/[0.04] py-2">
      <span className="text-[12px] font-semibold text-obsidian/45">{label}</span>
      <span className="max-w-[65%] text-left text-[13px] font-medium text-obsidian">{children}</span>
    </div>
  );
}
