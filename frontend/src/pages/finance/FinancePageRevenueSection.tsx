'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import FinanceLineChart from '../../components/finance/FinanceLineChart';
import { formatDate, formatCurrency } from '../../lib/finance/utils';
import type { Revenue } from '../../lib/finance/types';

interface FinancePageRevenueSectionProps {
  revenues: Revenue[];
  chartData: Array<{ label: string; value: number; timestamp: string }>;
}

function orderCountLabel(rev: Revenue): string {
  if (rev.order_count != null && rev.order_count !== undefined && !Number.isNaN(Number(rev.order_count))) {
    return String(rev.order_count);
  }
  return '—';
}

export default function FinancePageRevenueSection({ revenues, chartData }: FinancePageRevenueSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const totals = useMemo(() => {
    const amount = revenues.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const orders = revenues.reduce((s, r) => {
      if (r.order_count != null && r.order_count !== undefined) {
        return s + (Number(r.order_count) || 0);
      }
      return s;
    }, 0);
    const anyOrderCount = revenues.some((r) => r.order_count != null && r.order_count !== undefined);
    return { amount, orders, anyOrderCount };
  }, [revenues]);

  return (
    <div className="space-y-6">
      <FinanceLineChart data={chartData} period="daily" title={t('finance.chartRevenueTitle')} />
      <div className="rounded-soft-xl border border-black/10 bg-white p-6 shadow-soft">
        <h3 className="mb-4 text-[20px] leading-tight font-semibold text-obsidian">{t('finance.revenueTableTitle')}</h3>
        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[520px] border-collapse text-right">
            <thead>
              <tr className="border-b border-black/10 bg-slate-100/90">
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colDate')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colRevenue')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colOrderCount')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {revenues.length > 0 ? (
                revenues.map((rev) => (
                  <tr
                    key={rev.id}
                    className="border-b border-black/5 odd:bg-white even:bg-slate-50/80 hover:bg-cyber-aqua/5"
                  >
                    <td className="px-4 py-3 text-[15px] text-obsidian">{formatDate(rev.date)}</td>
                    <td className="px-4 py-3 text-[15px] font-semibold tabular-nums text-obsidian">
                      {formatCurrency(rev.amount, numberLocale)}
                    </td>
                    <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">{orderCountLabel(rev)}</td>
                    <td className="max-w-[240px] px-4 py-3 text-[14px] leading-relaxed break-words text-obsidian/75">
                      {rev.notes?.trim() ? rev.notes : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[15px] text-obsidian/60">
                    <div className="flex flex-col items-center gap-2">
                      <p>{t('finance.revenueEmpty')}</p>
                      <p className="text-[13px] leading-relaxed text-obsidian/40">{t('finance.revenueEmptyHint')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {revenues.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-black/15 bg-cloud-soft-white font-bold">
                  <td className="px-4 py-3 text-[15px] text-obsidian">{t('finance.totalRow')}</td>
                  <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">{formatCurrency(totals.amount, numberLocale)}</td>
                  <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">
                    {totals.anyOrderCount ? totals.orders : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-normal text-obsidian/50">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
