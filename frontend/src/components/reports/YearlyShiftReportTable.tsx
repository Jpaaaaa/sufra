import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyAggregate, ShiftBreakdownRow } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { ShiftBreakdownRows } from './ShiftBreakdownRows';
import { formatReportDate, monthKeyFromRow } from './report-format-utils';

interface Props {
  data: DailyAggregate[];
  shiftBreakdownByMonth: Record<string, Record<string, ShiftBreakdownRow[]>>;
}

function ExpandBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-obsidian/60 hover:bg-black/5"
      aria-expanded={open}
    >
      {open ? '▾' : '▸'}
    </button>
  );
}

export function YearlyShiftReportTable({ data, shiftBreakdownByMonth }: Props) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-black/5">
            <th className="w-10 px-2 py-3" />
            <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colMonth')}</th>
            <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colTotalSales')}</th>
            <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colOrderCount')}</th>
            <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colAverageOrder')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((month) => {
            const mKey = monthKeyFromRow(month.date, (month as DailyAggregate & { monthKey?: string }).monthKey);
            const daysMap = shiftBreakdownByMonth[mKey] ?? {};
            const dayDates = Object.keys(daysMap).sort();
            const monthOpen = expandedMonths[mKey] ?? false;
            const hasDays = dayDates.length > 0;

            return (
              <Fragment key={mKey}>
                <tr className="border-b border-black/5 hover:bg-cloud-soft-white/50">
                  <td className="px-2 py-3 text-center">
                    {hasDays ? <ExpandBtn open={monthOpen} onClick={() => toggleMonth(mKey)} /> : null}
                  </td>
                  <td className="px-4 py-3 text-[15px] font-medium text-obsidian">{month.day}</td>
                  <td className="px-4 py-3 text-[15px] font-medium text-obsidian">
                    {formatCurrency(month.totalSales ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-[15px] text-obsidian">
                    {(month.orderCount ?? 0).toLocaleString(numberLocale)}
                  </td>
                  <td className="px-4 py-3 text-[15px] text-obsidian">
                    {formatCurrency(month.averageOrder ?? 0)}
                  </td>
                </tr>
                {monthOpen && hasDays
                  ? dayDates.map((dateKey) => {
                      const shifts = daysMap[dateKey] ?? [];
                      const dayOpen = expandedDays[dateKey] ?? false;
                      const daySales = shifts.reduce((s, r) => s + r.totalSales, 0);
                      const dayOrders = shifts.reduce((s, r) => s + r.orderCount, 0);
                      return (
                        <Fragment key={dateKey}>
                          <tr className="border-b border-black/5 bg-cloud-soft-white/30">
                            <td className="px-2 py-2 text-center pl-6">
                              <ExpandBtn open={dayOpen} onClick={() => toggleDay(dateKey)} />
                            </td>
                            <td className="px-4 py-2 text-[14px] text-obsidian">{formatReportDate(dateKey)}</td>
                            <td className="px-4 py-2 text-[14px] text-obsidian">{formatCurrency(daySales)}</td>
                            <td className="px-4 py-2 text-[14px] text-obsidian">
                              {dayOrders.toLocaleString(numberLocale)}
                            </td>
                            <td className="px-4 py-2 text-[14px] text-obsidian">
                              {formatCurrency(dayOrders > 0 ? Math.round(daySales / dayOrders) : 0)}
                            </td>
                          </tr>
                          {dayOpen ? (
                            <tr>
                              <td colSpan={5} className="border-b border-black/5 pb-2 pl-8">
                                <ShiftBreakdownRows rows={shifts} compact />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
