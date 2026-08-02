import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import type { ShiftBreakdownRow } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';

interface Props {
  rows: ShiftBreakdownRow[];
}

export default function ShiftBreakdownTable({ rows }: Props) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  if (!rows.length) return null;

  return (
    <section className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <h3 className="mb-4 text-[18px] font-semibold text-obsidian">{t('reports.shiftBreakdownTitle')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-black/10 text-obsidian/60">
              <th className="pb-2 pr-4 font-medium">{t('reports.shiftColName')}</th>
              <th className="pb-2 pr-4 font-medium">{t('reports.shiftColHours')}</th>
              <th className="pb-2 pr-4 font-medium">{t('reports.shiftColOrders')}</th>
              <th className="pb-2 font-medium">{t('reports.shiftColSales')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.shiftId ?? `u-${i}`} className="border-b border-black/5">
                <td className="py-3 pr-4 font-medium text-obsidian">{row.shiftName}</td>
                <td className="py-3 pr-4 text-graphite">
                  {row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : '—'}
                </td>
                <td className="py-3 pr-4">{row.orderCount.toLocaleString(numberLocale)}</td>
                <td className="py-3 font-medium">{formatCurrency(row.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
