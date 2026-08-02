import { useTranslation } from 'react-i18next';
import { ShiftBreakdownRow } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface Props {
  rows: ShiftBreakdownRow[];
  compact?: boolean;
}

export function ShiftBreakdownRows({ rows, compact }: Props) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  if (!rows.length) {
    return (
      <p className={`px-4 text-obsidian/55 ${compact ? 'py-1 text-[12px]' : 'py-2 text-[13px]'}`}>
        {t('reports.noShiftData')}
      </p>
    );
  }

  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-2';
  const textSize = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <table className={`w-full ${textSize}`}>
      <thead>
        <tr className="border-b border-black/5 text-obsidian/55">
          <th className={`${cellPad} text-right font-medium`}>{t('reports.shiftColName')}</th>
          <th className={`${cellPad} text-right font-medium`}>{t('reports.shiftColHours')}</th>
          <th className={`${cellPad} text-right font-medium`}>{t('reports.shiftColOrders')}</th>
          <th className={`${cellPad} text-right font-medium`}>{t('reports.shiftColSales')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.shiftId ?? `u-${i}`} className="border-b border-black/5 bg-cloud-soft-white/40">
            <td className={`${cellPad} font-medium text-obsidian`}>{row.shiftName}</td>
            <td className={`${cellPad} text-graphite`}>
              {row.startTime && row.endTime ? `${row.startTime.slice(0, 5)} – ${row.endTime.slice(0, 5)}` : '—'}
            </td>
            <td className={cellPad}>{row.orderCount.toLocaleString(numberLocale)}</td>
            <td className={`${cellPad} font-medium`}>{formatCurrency(row.totalSales)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
