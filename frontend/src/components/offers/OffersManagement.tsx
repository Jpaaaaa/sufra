'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOffers } from '../../hooks/useOffers';
import { Item } from '../../hooks/useItems';
import { showConfirm } from '../ui/ConfirmDialog';
import OfferDetailModal, { type OfferDetailState } from './OfferDetailModal';
import { OfferActivateToggle } from './OfferActivateToggle';
import { WeekdayCheckboxes } from './WeekdayCheckboxes';
import { formatWeekdaysOffer } from '../../utils/weekdays';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import type { HappyHour } from '../../hooks/useOffers';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface OffersManagementProps {
  offers: ReturnType<typeof useOffers>;
  items: Item[];
  loadingItems: boolean;
  isManager: boolean;
}

export default function OffersManagement({
  offers,
  items,
  isManager,
}: OffersManagementProps) {
  const { t } = useTranslation();
  const { dateLocale } = useOrderLocale();
  const currency = t('orders.currency');
  const fmtPrice = (amount: number | string) =>
    t('halls.priceWithCurrency', { price: amount, currency });
  const itemListSep = t('offers.weekdayListSep');

  const [selectedOfferType, setSelectedOfferType] = useState<
    'daily-deal' | 'combo' | 'scheduled' | 'featured' | 'happy-hour' | null
  >(null);

  // Form states
  const [dailyDealForm, setDailyDealForm] = useState({
    product_id: '',
    special_price: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [comboForm, setComboForm] = useState({
    combo_name: '',
    combo_price: '',
    product_ids: [] as number[],
    weekdays: [] as number[],
  });
  const [editingComboId, setEditingComboId] = useState<number | null>(null);

  const [scheduledForm, setScheduledForm] = useState({
    offer_type: 'product' as 'product' | 'combo',
    product_id: '',
    combo_id: '',
    special_price: '',
    start_datetime: '',
    end_datetime: '',
  });

  const [happyHourForm, setHappyHourForm] = useState({
    product_id: '',
    happy_hour_price: '',
    time_start: '',
    time_end: '',
    weekdays: [] as number[],
  });
  const [editingHappyHourId, setEditingHappyHourId] = useState<number | null>(null);

  const dailyDealPriceField = useGlobalNumericField(dailyDealForm.special_price, (next) =>
    setDailyDealForm((prev) => ({ ...prev, special_price: next })),
  );
  const scheduledPriceField = useGlobalNumericField(scheduledForm.special_price, (next) =>
    setScheduledForm((prev) => ({ ...prev, special_price: next })),
  );
  const comboPriceField = useGlobalNumericField(comboForm.combo_price, (next) =>
    setComboForm((prev) => ({ ...prev, combo_price: next })),
  );
  const happyHourPriceField = useGlobalNumericField(happyHourForm.happy_hour_price, (next) =>
    setHappyHourForm((prev) => ({ ...prev, happy_hour_price: next })),
  );

  const [offerDetail, setOfferDetail] = useState<OfferDetailState | null>(null);

  const comboProductLines = (combo: {
    product_ids?: number[];
    products?: Array<{ id: number; name: string; price: number }>;
  }) => {
    const sep = t('offers.comboLineSep');
    return combo.products?.length
      ? combo.products.map((p) => `${p.name}${sep}${fmtPrice(p.price)}`)
      : (combo.product_ids || []).map((pid) => {
          const it = items.find((i) => i.id === pid);
          return it ? `${it.name}${sep}${fmtPrice(it.price)}` : t('offers.productNumbered', { id: pid });
        });
  };

  const handleDailyDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyDealForm.product_id || !dailyDealForm.special_price || !dailyDealForm.date) {
      return;
    }
    await offers.createDailyDeal({
      product_id: Number(dailyDealForm.product_id),
      special_price: Number(dailyDealForm.special_price),
      date: dailyDealForm.date,
    });
    setDailyDealForm({
      product_id: '',
      special_price: '',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedOfferType(null);
  };

  const handleEditCombo = (combo: {
    id: number;
    combo_name: string;
    combo_price: number;
    product_ids?: number[];
    products?: Array<{ id: number; name: string; price: number }>;
    weekdays?: number[];
  }) => {
    const ids = combo.product_ids?.length ? combo.product_ids : (combo.products || []).map((p) => p.id);
    setEditingComboId(combo.id);
    setComboForm({
      combo_name: combo.combo_name,
      combo_price: String(combo.combo_price),
      product_ids: ids,
      weekdays: combo.weekdays?.length ? [...combo.weekdays] : [],
    });
    setSelectedOfferType('combo');
  };

  const handleComboSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboForm.combo_name || !comboForm.combo_price || comboForm.product_ids.length === 0) {
      return;
    }
    const wdPayload = comboForm.weekdays.length ? comboForm.weekdays : undefined;
    if (editingComboId) {
      await offers.updateCombo(editingComboId, {
        combo_name: comboForm.combo_name,
        combo_price: Number(comboForm.combo_price),
        product_ids: comboForm.product_ids,
        weekdays: wdPayload ?? null,
      });
      setEditingComboId(null);
    } else {
      await offers.createCombo({
        combo_name: comboForm.combo_name,
        combo_price: Number(comboForm.combo_price),
        product_ids: comboForm.product_ids,
        weekdays: wdPayload,
      });
    }
    setComboForm({
      combo_name: '',
      combo_price: '',
      product_ids: [],
      weekdays: [],
    });
    setSelectedOfferType(null);
  };

  const handleScheduledSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !scheduledForm.special_price ||
      !scheduledForm.start_datetime ||
      !scheduledForm.end_datetime ||
      (scheduledForm.offer_type === 'product' && !scheduledForm.product_id) ||
      (scheduledForm.offer_type === 'combo' && !scheduledForm.combo_id)
    ) {
      return;
    }
    await offers.createScheduledOffer({
      product_id: scheduledForm.offer_type === 'product' ? Number(scheduledForm.product_id) : undefined,
      combo_id: scheduledForm.offer_type === 'combo' ? Number(scheduledForm.combo_id) : undefined,
      special_price: Number(scheduledForm.special_price),
      start_datetime: scheduledForm.start_datetime,
      end_datetime: scheduledForm.end_datetime,
    });
    setScheduledForm({
      offer_type: 'product',
      product_id: '',
      combo_id: '',
      special_price: '',
      start_datetime: '',
      end_datetime: '',
    });
    setSelectedOfferType(null);
  };

  const handleHappyHourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!happyHourForm.product_id || !happyHourForm.happy_hour_price || !happyHourForm.time_start || !happyHourForm.time_end) {
      return;
    }
    const base = {
      happy_hour_price: Number(happyHourForm.happy_hour_price),
      time_start: happyHourForm.time_start,
      time_end: happyHourForm.time_end,
    };
    if (editingHappyHourId) {
      await offers.updateHappyHour(editingHappyHourId, {
        ...base,
        weekdays: happyHourForm.weekdays.length ? happyHourForm.weekdays : null,
      });
      setEditingHappyHourId(null);
    } else {
      await offers.createHappyHour({
        product_id: Number(happyHourForm.product_id),
        ...base,
        ...(happyHourForm.weekdays.length ? { weekdays: happyHourForm.weekdays } : {}),
      });
    }
    setHappyHourForm({
      product_id: '',
      happy_hour_price: '',
      time_start: '',
      time_end: '',
      weekdays: [],
    });
    setSelectedOfferType(null);
  };

  const handleEditHappyHour = (hh: HappyHour) => {
    setEditingHappyHourId(hh.id);
    setHappyHourForm({
      product_id: String(hh.product_id),
      happy_hour_price: String(hh.happy_hour_price),
      time_start: hh.time_start.slice(0, 5),
      time_end: hh.time_end.slice(0, 5),
      weekdays: hh.weekdays?.length ? [...hh.weekdays] : [],
    });
    setSelectedOfferType('happy-hour');
  };

  const toggleProductInCombo = (productId: number) => {
    setComboForm((prev) => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter((id) => id !== productId)
        : [...prev.product_ids, productId],
    }));
  };

  const activeOffers = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dailyDeal = offers.dailyDeals.find((d) => d.date === today) ?? null;
    const now = Date.now();
    const scheduledOffers = offers.scheduledOffers.filter((so) => {
      const start = new Date(so.start_datetime.replace(' ', 'T')).getTime();
      const end = new Date(so.end_datetime.replace(' ', 'T')).getTime();
      return start <= now && end >= now;
    });
    return { dailyDeal, scheduledOffers };
  }, [offers.dailyDeals, offers.scheduledOffers]);

  const detailBtnClass =
    'rounded-lg border border-slate-200 bg-white px-3 py-1 text-[14px] font-medium text-obsidian hover:bg-slate-50';

  return (
    <div className="mt-6 flex flex-col gap-6">
      <OfferDetailModal open={!!offerDetail} onClose={() => setOfferDetail(null)} detail={offerDetail} />
      <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] leading-tight font-semibold text-obsidian">{t('offers.activeOffersTitle')}</h2>
              <p className="text-[15px] leading-normal font-light text-obsidian/70">
                {t('offers.activeOffersSubtitle')}
              </p>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedOfferType('scheduled')}
                  className="rounded-soft-lg bg-emerald-600 px-4 py-2 text-[14px] font-bold text-white shadow-soft hover:bg-emerald-700"
                >
                  {t('offers.addScheduledOffer')}
                </button>
              </div>
            )}
          </div>

          {/* Daily Deal Form */}
          {selectedOfferType === 'daily-deal' && (
            <form onSubmit={handleDailyDealSubmit} className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.dailyDealTitle')}</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.product')}</label>
                  <select
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={dailyDealForm.product_id}
                    onChange={(e) => setDailyDealForm((prev) => ({ ...prev, product_id: e.target.value }))}
                  >
                    <option value="">{t('offers.selectProduct')}</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {fmtPrice(item.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">
                    {t('offers.specialPriceLabel', { currency })}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={dailyDealForm.special_price}
                    onChange={(e) => setDailyDealForm((prev) => ({ ...prev, special_price: e.target.value }))}
                    onFocus={dailyDealPriceField.onFocus}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.date')}</label>
                  <input
                    type="date"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={dailyDealForm.date}
                    onChange={(e) => setDailyDealForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="rounded-soft-lg bg-cyber-aqua px-5 py-2 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
                >
                  {t('halls.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOfferType(null);
                    setDailyDealForm({
                      product_id: '',
                      special_price: '',
                      date: new Date().toISOString().split('T')[0],
                    });
                  }}
                  className="rounded-soft-lg border border-black/5 bg-white px-5 py-2 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
                >
                  {t('halls.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Scheduled Offer Form */}
          {selectedOfferType === 'scheduled' && (
            <form onSubmit={handleScheduledSubmit} className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.scheduledOfferTitle')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.offerType')}</label>
                  <select
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={scheduledForm.offer_type}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({
                        ...prev,
                        offer_type: e.target.value as 'product' | 'combo',
                        product_id: '',
                        combo_id: '',
                      }))
                    }
                  >
                    <option value="product">{t('offers.typeProduct')}</option>
                    <option value="combo">{t('offers.typeCombo')}</option>
                  </select>
                </div>
                {scheduledForm.offer_type === 'product' ? (
                  <div>
                    <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.product')}</label>
                    <select
                      className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                      value={scheduledForm.product_id}
                      onChange={(e) => setScheduledForm((prev) => ({ ...prev, product_id: e.target.value }))}
                    >
                      <option value="">{t('offers.selectProduct')}</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {fmtPrice(item.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.scheduledCombo')}</label>
                    <select
                      className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                      value={scheduledForm.combo_id}
                      onChange={(e) => setScheduledForm((prev) => ({ ...prev, combo_id: e.target.value }))}
                    >
                      <option value="">{t('offers.selectCombo')}</option>
                      {offers.combos.filter(c => c.is_active === 1).map((combo) => (
                        <option key={combo.id} value={combo.id}>
                          {combo.combo_name} — {fmtPrice(combo.combo_price)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">
                    {t('offers.specialPriceLabel', { currency })}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={scheduledForm.special_price}
                    onChange={(e) => setScheduledForm((prev) => ({ ...prev, special_price: e.target.value }))}
                    onFocus={scheduledPriceField.onFocus}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.startDate')}</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={scheduledForm.start_datetime}
                    onChange={(e) => setScheduledForm((prev) => ({ ...prev, start_datetime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.endDate')}</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={scheduledForm.end_datetime}
                    onChange={(e) => setScheduledForm((prev) => ({ ...prev, end_datetime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="rounded-soft-lg bg-cyber-aqua px-5 py-2 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
                >
                  {t('halls.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOfferType(null);
                    setScheduledForm({
                      offer_type: 'product',
                      product_id: '',
                      combo_id: '',
                      special_price: '',
                      start_datetime: '',
                      end_datetime: '',
                    });
                  }}
                  className="rounded-soft-lg border border-black/5 bg-white px-5 py-2 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
                >
                  {t('halls.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Loading state */}
          {offers.loading && (
            <div className="flex items-center justify-center rounded-soft-xl border border-black/5 bg-white py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyber-aqua border-r-transparent" />
                <p className="text-[15px] text-obsidian/70">{t('offers.loadingOffers')}</p>
              </div>
            </div>
          )}

          {/* Display Active Offers */}
          {!offers.loading && (
          <div className="space-y-4">
            {activeOffers?.dailyDeal && (
              <div
                className={`rounded-soft-xl border p-4 ${
                  (activeOffers.dailyDeal.is_active ?? 1) === 1
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 opacity-90'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[16px] font-bold text-emerald-900">{t('offers.dailyDealBadge')}</h4>
                      {(activeOffers.dailyDeal.is_active ?? 1) === 0 && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                          {t('offers.disabled')}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-emerald-700">
                      {activeOffers.dailyDeal.product_name} —{' '}
                      {t('offers.priceLine', {
                        amount: activeOffers.dailyDeal.special_price,
                        currency,
                      })}
                    </p>
                    <p className="text-[13px] text-emerald-600">
                      {t('offers.dateLine', { date: activeOffers.dailyDeal.date })}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOfferDetail({ kind: 'daily-deal', deal: activeOffers.dailyDeal! })
                      }
                      className={detailBtnClass}
                    >
                      {t('offers.details')}
                    </button>
                    {isManager && (
                      <>
                        <OfferActivateToggle
                          active={(activeOffers.dailyDeal.is_active ?? 1) === 1}
                          onToggle={() =>
                            void offers.updateDailyDeal(activeOffers.dailyDeal!.id, {
                              is_active: (activeOffers.dailyDeal!.is_active ?? 1) === 1 ? 0 : 1,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (await showConfirm({ message: t('offers.confirmDeleteDailyDeal') })) {
                              await offers.deleteDailyDeal(activeOffers.dailyDeal!.id);
                            }
                          }}
                          className="rounded-lg bg-red-500 px-3 py-1 text-[14px] font-medium text-white hover:bg-red-600"
                        >
                          {t('halls.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeOffers?.scheduledOffers?.map((offer) => (
              <div
                key={offer.id}
                className={`rounded-soft-xl border p-4 ${
                  offer.is_active === 1
                    ? 'border-cyber-aqua/20 bg-cyber-aqua/5'
                    : 'border-slate-200 bg-slate-50 opacity-90'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[16px] font-bold text-obsidian">{t('offers.scheduledCardTitle')}</h4>
                      {offer.is_active === 0 && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                          {t('offers.disabled')}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-obsidian/80">
                      {offer.product_name || offer.combo_name} —{' '}
                      {t('offers.priceLine', { amount: offer.special_price, currency })}
                    </p>
                    <p className="text-[13px] text-obsidian/60">
                      {t('offers.dateRange', {
                        from: new Date(offer.start_datetime.replace(' ', 'T')).toLocaleString(dateLocale),
                        to: new Date(offer.end_datetime.replace(' ', 'T')).toLocaleString(dateLocale),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOfferDetail({ kind: 'scheduled', offer })}
                      className={detailBtnClass}
                    >
                      {t('offers.details')}
                    </button>
                    {isManager && (
                      <>
                        <OfferActivateToggle
                          active={offer.is_active === 1}
                          onToggle={() =>
                            void offers.updateScheduledOffer(offer.id, {
                              is_active: offer.is_active === 1 ? 0 : 1,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (await showConfirm({ message: t('offers.confirmDeleteScheduled') })) {
                              await offers.deleteScheduledOffer(offer.id);
                            }
                          }}
                          className="rounded-lg bg-red-500 px-3 py-1 text-[14px] font-medium text-white hover:bg-red-600"
                        >
                          {t('halls.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Empty state when no active offers */}
            {!activeOffers?.dailyDeal && (!activeOffers?.scheduledOffers?.length) && (
              <div className="rounded-soft-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-[16px] font-medium text-obsidian/80">{t('offers.noActiveOffers')}</p>
                <p className="mt-2 text-[14px] text-obsidian/60">{t('offers.noActiveOffersHint')}</p>
              </div>
            )}
          </div>
          )}
        </div>

      <div className="flex flex-col gap-6 border-t border-slate-200 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] leading-tight font-semibold text-obsidian">{t('offers.regularOffersTitle')}</h2>
              <p className="text-[15px] leading-normal font-light text-obsidian/70">
                {t('offers.regularOffersSubtitle')}
              </p>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingComboId(null);
                    setComboForm({ combo_name: '', combo_price: '', product_ids: [], weekdays: [] });
                    setEditingComboId(null);
                    setSelectedOfferType('combo');
                  }}
                  className="rounded-soft-lg bg-cyber-aqua px-4 py-2 text-[14px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
                >
                  {t('offers.addCombo')}
                </button>
                <button
                  onClick={() => setSelectedOfferType('featured')}
                  className="rounded-soft-lg bg-amber-600 px-4 py-2 text-[14px] font-bold text-white shadow-soft hover:bg-amber-700"
                >
                  {t('offers.addFeatured')}
                </button>
                <button
                  onClick={() => {
                    setEditingHappyHourId(null);
                    setHappyHourForm({
                      product_id: '',
                      happy_hour_price: '',
                      time_start: '',
                      time_end: '',
                      weekdays: [],
                    });
                    setSelectedOfferType('happy-hour');
                  }}
                  className="rounded-soft-lg bg-purple-600 px-4 py-2 text-[14px] font-bold text-white shadow-soft hover:bg-purple-700"
                >
                  {t('offers.addHappyHour')}
                </button>
              </div>
            )}
          </div>

          {/* Combo Form */}
          {selectedOfferType === 'combo' && (
            <form onSubmit={handleComboSubmit} className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">
                {editingComboId ? t('offers.comboEditTitle') : t('offers.comboNewTitle')}
              </h3>
              <p className="mb-3 text-[14px] text-obsidian/70">{t('offers.comboWeekdaysHint')}</p>
              <div className="mb-4">
                <span className="mb-2 block text-[15px] font-bold text-obsidian">{t('offers.comboWeekdaysLabel')}</span>
                <WeekdayCheckboxes
                  idPrefix="combo"
                  value={comboForm.weekdays}
                  onChange={(weekdays) => setComboForm((prev) => ({ ...prev, weekdays }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.offerName')}</label>
                  <input
                    type="text"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={comboForm.combo_name}
                    onChange={(e) => setComboForm((prev) => ({ ...prev, combo_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">
                    {t('offers.priceCurrency', { currency })}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={comboForm.combo_price}
                    onChange={(e) => setComboForm((prev) => ({ ...prev, combo_price: e.target.value }))}
                    onFocus={comboPriceField.onFocus}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.pickProducts')}</label>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-soft border border-black/5 bg-white p-4">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={comboForm.product_ids.includes(item.id)}
                        onChange={() => toggleProductInCombo(item.id)}
                      />
                      <span className="text-[14px] text-obsidian">
                        {item.name} — {fmtPrice(item.price)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="rounded-soft-lg bg-cyber-aqua px-5 py-2 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
                >
                  {t('halls.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOfferType(null);
                    setEditingComboId(null);
                    setComboForm({
                      combo_name: '',
                      combo_price: '',
                      product_ids: [],
                      weekdays: [],
                    });
                  }}
                  className="rounded-soft-lg border border-black/5 bg-white px-5 py-2 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
                >
                  {t('halls.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Featured Items Form */}
          {selectedOfferType === 'featured' && (
            <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.featuredSectionTitle')}</h3>
              <div className="space-y-2">
                {items.map((item) => {
                  const isFeatured = offers.featuredItems.some((fi) => fi.product_id === item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-black/5 bg-white p-3"
                    >
                      <span className="text-[15px] text-obsidian">{item.name}</span>
                      <button
                        onClick={() => offers.setFeatured(item.id, !isFeatured)}
                        className={`rounded-lg px-4 py-2 text-[14px] font-medium ${
                          isFeatured
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-slate-200 text-obsidian hover:bg-slate-300'
                        }`}
                      >
                        {isFeatured ? t('offers.featuredToggleOn') : t('offers.featuredToggleAdd')}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setSelectedOfferType(null)}
                  className="rounded-soft-lg border border-black/5 bg-white px-5 py-2 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
                >
                  {t('offers.close')}
                </button>
              </div>
            </div>
          )}

          {/* Happy Hour Form */}
          {selectedOfferType === 'happy-hour' && (
            <form onSubmit={handleHappyHourSubmit} className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">
                {editingHappyHourId ? t('offers.happyHourEdit') : t('offers.happyHourNew')}
              </h3>
              <p className="mb-3 text-[14px] text-obsidian/70">{t('offers.happyHourHint')}</p>
              <div className="mb-4">
                <span className="mb-2 block text-[15px] font-bold text-obsidian">{t('offers.happyHourWeekdaysLabel')}</span>
                <WeekdayCheckboxes
                  idPrefix="hh"
                  value={happyHourForm.weekdays}
                  onChange={(weekdays) => setHappyHourForm((prev) => ({ ...prev, weekdays }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.product')}</label>
                  <select
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={happyHourForm.product_id}
                    disabled={editingHappyHourId != null}
                    onChange={(e) => setHappyHourForm((prev) => ({ ...prev, product_id: e.target.value }))}
                  >
                    <option value="">{t('offers.selectProduct')}</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {fmtPrice(item.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">
                    {t('offers.priceCurrency', { currency })}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={happyHourForm.happy_hour_price}
                    onChange={(e) => setHappyHourForm((prev) => ({ ...prev, happy_hour_price: e.target.value }))}
                    onFocus={happyHourPriceField.onFocus}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.timeStart')}</label>
                  <input
                    type="time"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={happyHourForm.time_start}
                    onChange={(e) => setHappyHourForm((prev) => ({ ...prev, time_start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-[15px] font-bold text-obsidian">{t('offers.timeEnd')}</label>
                  <input
                    type="time"
                    className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua"
                    value={happyHourForm.time_end}
                    onChange={(e) => setHappyHourForm((prev) => ({ ...prev, time_end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="rounded-soft-lg bg-cyber-aqua px-5 py-2 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
                >
                  {t('halls.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOfferType(null);
                    setEditingHappyHourId(null);
                    setHappyHourForm({
                      product_id: '',
                      happy_hour_price: '',
                      time_start: '',
                      time_end: '',
                      weekdays: [],
                    });
                  }}
                  className="rounded-soft-lg border border-black/5 bg-white px-5 py-2 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
                >
                  {t('halls.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Display Regular Offers */}
          <div className="space-y-6">
            {/* Combos */}
            <div>
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.combosListTitle')}</h3>
              <div className="space-y-4">
                {offers.combos.map((combo) => {
                  const productNames = combo.products?.length
                    ? combo.products.map((p) => p.name)
                    : (combo.product_ids || []).map((pid) => items.find((i) => i.id === pid)?.name).filter(Boolean);
                  return (
                  <div
                    key={combo.id}
                    className={`rounded-soft-xl border p-4 ${
                      combo.is_active === 1 ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-90'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[16px] font-bold text-obsidian">{combo.combo_name}</h4>
                          {combo.is_active === 0 && (
                            <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                              {t('offers.disabled')}
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] text-obsidian/80">
                          {t('offers.comboPriceLabelShort', { amount: combo.combo_price, currency })}
                        </p>
                        <p className="text-[13px] text-amber-800/90">{formatWeekdaysOffer(combo.weekdays)}</p>
                        <p className="text-[13px] text-obsidian/60">
                          {t('offers.productsLine', {
                            list: productNames.length ? productNames.join(itemListSep) : t('offers.productsNone'),
                          })}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setOfferDetail({
                              kind: 'combo',
                              combo,
                              productLines: comboProductLines(combo),
                            })
                          }
                          className={detailBtnClass}
                        >
                          {t('offers.details')}
                        </button>
                        {isManager && (
                          <>
                            <OfferActivateToggle
                              active={combo.is_active === 1}
                              onToggle={() =>
                                void offers.updateCombo(combo.id, {
                                  is_active: combo.is_active === 1 ? 0 : 1,
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => handleEditCombo(combo)}
                              className="rounded-lg bg-cyber-aqua px-3 py-1 text-[14px] font-medium text-white hover:bg-cyber-aqua/90"
                            >
                              {t('halls.edit')}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (await showConfirm({ message: t('offers.confirmDeleteCombo') })) {
                                  await offers.deleteCombo(combo.id);
                                }
                              }}
                              className="rounded-lg bg-red-500 px-3 py-1 text-[14px] font-medium text-white hover:bg-red-600"
                            >
                              {t('halls.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Featured Items */}
            <div>
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.featuredSectionTitle')}</h3>
              <div className="space-y-2">
                {offers.featuredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-soft-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <span className="text-[15px] font-medium text-amber-900">
                      ⭐ {item.product_name}
                    </span>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOfferDetail({ kind: 'featured', item })}
                        className={detailBtnClass}
                      >
                        {t('offers.details')}
                      </button>
                      {isManager && (
                        <OfferActivateToggle
                          active
                          onToggle={() => void offers.setFeatured(item.product_id, false)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Happy Hours */}
            <div>
              <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('offers.happyHourListTitle')}</h3>
              <div className="space-y-4">
                {offers.happyHours.map((hh) => (
                    <div
                      key={hh.id}
                      className={`rounded-soft-xl border p-4 ${
                        hh.is_active === 1
                          ? 'border-purple-200 bg-purple-50'
                          : 'border-slate-200 bg-slate-50 opacity-90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[16px] font-bold text-purple-900">{hh.product_name}</h4>
                            {hh.is_active === 0 && (
                              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                                {t('offers.disabled')}
                              </span>
                            )}
                          </div>
                          <p className="text-[14px] text-purple-700">
                            {t('offers.happyHourPriceLine', {
                              amount: hh.happy_hour_price,
                              currency,
                            })}
                          </p>
                          <p className="text-[13px] text-purple-600">
                            {t('offers.happyHourTimeRange', { start: hh.time_start, end: hh.time_end })}
                          </p>
                          <p className="text-[13px] text-purple-800/90">{formatWeekdaysOffer(hh.weekdays)}</p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOfferDetail({ kind: 'happy-hour', hh })}
                            className={detailBtnClass}
                          >
                            {t('offers.details')}
                          </button>
                          {isManager && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditHappyHour(hh)}
                                className="rounded-lg bg-cyber-aqua px-3 py-1 text-[14px] font-medium text-white hover:bg-cyber-aqua/90"
                              >
                                {t('halls.edit')}
                              </button>
                              <OfferActivateToggle
                                active={hh.is_active === 1}
                                onToggle={() =>
                                  void offers.updateHappyHour(hh.id, {
                                    is_active: hh.is_active === 1 ? 0 : 1,
                                  })
                                }
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (await showConfirm({ message: t('offers.confirmDeleteHappyHour') })) {
                                    await offers.deleteHappyHour(hh.id);
                                  }
                                }}
                                className="rounded-lg bg-red-500 px-3 py-1 text-[14px] font-medium text-white hover:bg-red-600"
                              >
                                {t('halls.delete')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

