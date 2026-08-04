'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyAggregate, ReportPeriod, ShiftBreakdownRow } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { ShiftBreakdownRows } from './ShiftBreakdownRows';
import { YearlyShiftReportTable } from './YearlyShiftReportTable';
import { formatReportDate } from './report-format-utils';

interface Props {
  period: ReportPeriod;
  data: DailyAggregate[];
  shiftBreakdownByDay?: Record<string, ShiftBreakdownRow[]>;
  shiftBreakdownByMonth?: Record<string, Record<string, ShiftBreakdownRow[]>>;
  shiftBreakdownTotals?: ShiftBreakdownRow[];
  defaultExpanded?: boolean;
}

function titleKey(period: ReportPeriod): string {
  if (period === 'weekly') return 'reports.weeklyShiftSummaryTitle';
  if (period === 'monthly') return 'reports.monthlyShiftSummaryTitle';
  if (period === 'yearly') return 'reports.yearlyShiftSummaryTitle';
  return 'reports.dailySummaryTitle';
}

function subtitleKey(period: ReportPeriod): string {
  if (period === 'yearly') return 'reports.yearlyShiftSummarySubtitle';
  return 'reports.dayShiftSummarySubtitle';
}

function getWeekEndStr(weekStartStr: string): string {
  const d = new Date(`${weekStartStr}T12:00:00`);
  d.setDate(d.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function aggregateShiftRows(rows: ShiftBreakdownRow[]): ShiftBreakdownRow[] {
  const byShift = new Map<string, ShiftBreakdownRow>();
  for (const row of rows) {
    const key = String(row.shiftId ?? row.shiftName ?? 'unknown');
    const existing = byShift.get(key);
    if (existing) {
      existing.orderCount = (Number(existing.orderCount) || 0) + (Number(row.orderCount) || 0);
      existing.totalSales = (Number(existing.totalSales) || 0) + (Number(row.totalSales) || 0);
    } else {
      byShift.set(key, {
        shiftId: row.shiftId ?? null,
        shiftName: row.shiftName ?? '-',
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        orderCount: Number(row.orderCount) || 0,
        totalSales: Number(row.totalSales) || 0,
        averageOrder: 0,
      });
    }
  }
  return Array.from(byShift.values()).map((row) => ({
    ...row,
    averageOrder: row.orderCount > 0 ? Math.round(row.totalSales / row.orderCount) : 0,
  }));
}

function getShiftsForPeriodRow(
  period: ReportPeriod,
  day: DailyAggregate,
  shiftBreakdownByDay?: Record<string, ShiftBreakdownRow[]>,
): ShiftBreakdownRow[] {
  if (!shiftBreakdownByDay || !day.date) return [];
  if (period === 'monthly') {
    const weekEnd = getWeekEndStr(day.date);
    const rows: ShiftBreakdownRow[] = [];
    for (const [dateKey, dayRows] of Object.entries(shiftBreakdownByDay)) {
      if (dateKey >= day.date && dateKey < weekEnd) {
        rows.push(...dayRows);
      }
    }
    return aggregateShiftRows(rows);
  }
  return shiftBreakdownByDay[day.date] ?? [];
}

export default function PeriodShiftReport({
  period,
  data,
  shiftBreakdownByDay,
  shiftBreakdownByMonth,
  shiftBreakdownTotals,
  defaultExpanded = false,
}: Props) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const validData = useMemo(
    () =>
      (data || []).filter(
        (day) => day && typeof day === 'object' && ('date' in day || 'day' in day) && !('openTime' in day),
      ),
    [data],
  );

  const toggle = (date: string) => {
    setExpanded((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const isExpanded = (date: string) => expanded[date] ?? defaultExpanded;

  if (!validData.length) {
    return (
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <p className="text-[15px] text-graphite">{t('reports.noData')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4">
        <h3 className="text-[20px] font-semibold text-obsidian">{t(titleKey(period))}</h3>
        <p className="text-[15px] text-obsidian/60">{t(subtitleKey(period))}</p>
      </div>

      {shiftBreakdownTotals && shiftBreakdownTotals.length > 0 ? (
        <div className="mb-6 rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/5 p-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-obsidian/55">
            {t('reports.shiftPeriodTotals')}
          </p>
          <ShiftBreakdownRows rows={shiftBreakdownTotals} compact />
        </div>
      ) : null}

      {period === 'yearly' && shiftBreakdownByMonth ? (
        <YearlyShiftReportTable data={validData} shiftBreakdownByMonth={shiftBreakdownByMonth} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/5">
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colDate')}</th>
                <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colTotalSales')}</th>
                <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colOrderCount')}</th>
                <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('reports.colAverageOrder')}</th>
              </tr>
            </thead>
            <tbody>
              {validData.map((day) => {
                const dateKey = day.date;
                const shifts = getShiftsForPeriodRow(period, day, shiftBreakdownByDay);
                const open = isExpanded(dateKey);
                const hasShifts = shifts.length > 0;
                const label =
                  (period === 'weekly' || period === 'monthly') && day.day ? day.day : formatReportDate(day.date);

                return (
                  <Fragment key={dateKey}>
                    <tr className="border-b border-black/5 hover:bg-cloud-soft-white/50">
                      <td className="px-2 py-3 text-center">
                        {hasShifts ? (
                          <button
                            type="button"
                            onClick={() => toggle(dateKey)}
                            className="rounded p-1 text-obsidian/60 hover:bg-black/5"
                            aria-expanded={open}
                          >
                            {open ? '▾' : '▸'}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[15px] font-medium text-obsidian">{label}</td>
                      <td className="px-4 py-3 text-[15px] font-medium text-obsidian">
                        {formatCurrency(day.totalSales ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-[15px] text-obsidian">
                        {(day.orderCount ?? 0).toLocaleString(numberLocale)}
                      </td>
                      <td className="px-4 py-3 text-[15px] text-obsidian">
                        {formatCurrency(day.averageOrder ?? 0)}
                      </td>
                    </tr>
                    {open && hasShifts ? (
                      <tr>
                        <td colSpan={5} className="border-b border-black/5 pb-2">
                          <ShiftBreakdownRows rows={shifts} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
