'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Combo,
  DailyDeal,
  FeaturedItem,
  HappyHour,
  ScheduledOffer,
} from '../../hooks/useOffers';
import { formatClockTimeAmPm, formatDateTimeAmPm } from '../../utils/format-time';
import { formatWeekdaysOffer } from '../../utils/weekdays';

export type OfferDetailState =
  | { kind: 'daily-deal'; deal: DailyDeal }
  | { kind: 'scheduled'; offer: ScheduledOffer }
  | { kind: 'combo'; combo: Combo; productLines: string[] }
  | { kind: 'featured'; item: FeaturedItem }
  | { kind: 'happy-hour'; hh: HappyHour };

interface OfferDetailModalProps {
  open: boolean;
  onClose: () => void;
  detail: OfferDetailState | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-black/5 py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[13px] font-semibold text-obsidian/60">{label}</span>
      <div className="min-w-0 text-[15px] text-obsidian">{children}</div>
    </div>
  );
}

export default function OfferDetailModal({ open, onClose, detail }: OfferDetailModalProps) {
  const { t } = useTranslation();
  const currency = t('orders.currency');
  const priceWith = (amount: number | string) =>
    t('halls.priceWithCurrency', { price: amount, currency });
  const emDash = t('offers.productsNone');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !detail) return null;

  const title =
    detail.kind === 'daily-deal'
      ? t('offers.detailTitleDaily')
      : detail.kind === 'scheduled'
        ? t('offers.detailTitleScheduled')
        : detail.kind === 'combo'
          ? t('offers.detailTitleCombo')
          : detail.kind === 'featured'
            ? t('offers.detailTitleFeatured')
            : t('offers.detailTitleHappyHour');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-obsidian/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="offer-detail-title" className="text-[18px] font-bold text-obsidian">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[14px] font-medium text-obsidian/70 hover:bg-black/5"
          >
            {t('offers.close')}
          </button>
        </div>

        <div className="rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 px-4">
          {detail.kind === 'daily-deal' && (
            <>
              <Row label={t('offers.rowId')}>{detail.deal.id}</Row>
              <Row label={t('offers.rowProductName')}>{detail.deal.product_name ?? emDash}</Row>
              <Row label={t('offers.rowProductId')}>{detail.deal.product_id}</Row>
              <Row label={t('offers.rowSpecialPrice')}>{priceWith(detail.deal.special_price)}</Row>
              <Row label={t('offers.rowDate')}>{detail.deal.date}</Row>
              <Row label={t('offers.rowStatus')}>
                {(detail.deal.is_active ?? 1) === 1 ? t('offers.statusOn') : t('offers.disabled')}
              </Row>
              <Row label={t('offers.rowCreated')}>{detail.deal.created_at ?? emDash}</Row>
            </>
          )}
          {detail.kind === 'scheduled' && (
            <>
              <Row label={t('offers.rowId')}>{detail.offer.id}</Row>
              <Row label={t('offers.rowType')}>
                {detail.offer.product_id != null
                  ? t('offers.typeProduct')
                  : detail.offer.combo_id != null
                    ? t('offers.typeCombo')
                    : emDash}
              </Row>
              <Row label={t('offers.rowProductOrComboName')}>
                {detail.offer.product_name || detail.offer.combo_name || emDash}
              </Row>
              {detail.offer.product_id != null && (
                <Row label={t('offers.rowProductId')}>{detail.offer.product_id}</Row>
              )}
              {detail.offer.combo_id != null && (
                <Row label={t('offers.rowComboId')}>{detail.offer.combo_id}</Row>
              )}
              <Row label={t('offers.rowSpecialPrice')}>{priceWith(detail.offer.special_price)}</Row>
              <Row label={t('offers.rowFrom')}>{formatDateTimeAmPm(detail.offer.start_datetime)}</Row>
              <Row label={t('offers.rowTo')}>{formatDateTimeAmPm(detail.offer.end_datetime)}</Row>
              <Row label={t('offers.rowActive')}>
                {detail.offer.is_active === 1 ? t('offers.yes') : t('offers.no')}
              </Row>
              <Row label={t('offers.rowCreated')}>{detail.offer.created_at ?? emDash}</Row>
            </>
          )}
          {detail.kind === 'combo' && (
            <>
              <Row label={t('offers.rowId')}>{detail.combo.id}</Row>
              <Row label={t('offers.rowName')}>{detail.combo.combo_name}</Row>
              <Row label={t('offers.rowPrice')}>{priceWith(detail.combo.combo_price)}</Row>
              <Row label={t('offers.rowOfferDays')}>{formatWeekdaysOffer(detail.combo.weekdays)}</Row>
              <Row label={t('offers.rowStatus')}>
                {detail.combo.is_active === 1 ? t('offers.statusOn') : t('offers.statusOff')}
              </Row>
              <Row label={t('offers.rowCreated')}>{detail.combo.created_at ?? emDash}</Row>
              <Row label={t('offers.rowUpdated')}>{detail.combo.updated_at ?? emDash}</Row>
              <Row label={t('offers.rowProducts')}>
                {detail.productLines.length ? (
                  <ul className="list-inside list-disc space-y-1 text-right">
                    {detail.productLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  emDash
                )}
              </Row>
            </>
          )}
          {detail.kind === 'featured' && (
            <>
              <Row label={t('offers.rowId')}>{detail.item.id}</Row>
              <Row label={t('offers.rowProductName')}>{detail.item.product_name ?? emDash}</Row>
              <Row label={t('offers.rowProductId')}>{detail.item.product_id}</Row>
              <Row label={t('offers.rowFeatured')}>
                {detail.item.featured === 1 ? t('offers.yes') : t('offers.no')}
              </Row>
              <Row label={t('offers.rowAdded')}>{detail.item.created_at ?? emDash}</Row>
            </>
          )}
          {detail.kind === 'happy-hour' && (
            <>
              <Row label={t('offers.rowId')}>{detail.hh.id}</Row>
              <Row label={t('offers.rowProductName')}>{detail.hh.product_name ?? emDash}</Row>
              <Row label={t('offers.rowProductId')}>{detail.hh.product_id}</Row>
              <Row label={t('offers.rowHappyPrice')}>{priceWith(detail.hh.happy_hour_price)}</Row>
              <Row label={t('offers.rowFrom')}>{formatClockTimeAmPm(detail.hh.time_start)}</Row>
              <Row label={t('offers.rowTo')}>{formatClockTimeAmPm(detail.hh.time_end)}</Row>
              <Row label={t('offers.rowOfferDays')}>{formatWeekdaysOffer(detail.hh.weekdays)}</Row>
              <Row label={t('offers.rowActive')}>
                {detail.hh.is_active === 1 ? t('offers.yes') : t('offers.no')}
              </Row>
              <Row label={t('offers.rowCreated')}>{detail.hh.created_at ?? emDash}</Row>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
