'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyAggregate } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface DailySummaryTableProps {
  data: DailyAggregate[];
}

type SortField = 'day' | 'date' | 'totalSales' | 'orderCount' | 'averageOrder' | 'totalDiscounts' | 'netProfit';
type SortDirection = 'asc' | 'desc';

export default function DailySummaryTable({ data }: DailySummaryTableProps) {
  const { t, i18n } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const sortLocale = useMemo(() => (i18n.language?.startsWith('en') ? 'en' : 'ar'), [i18n.language]);

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-4">
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.dailySummaryTitle')}</h3>
          <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.noData')}</p>
        </div>
      </div>
    );
  }

  const validData = Array.isArray(data)
    ? data.filter((day) => {
        if (!day || typeof day !== 'object') {
          return false;
        }
        const isDailyAggregate =
          ('date' in day || 'day' in day) &&
          ('totalSales' in day || 'orderCount' in day) &&
          !('openTime' in day) &&
          !('closeTime' in day);
        const hasDateField = 'date' in day;
        const hasDayField = 'day' in day;
        return isDailyAggregate || hasDateField || hasDayField;
      })
    : [];

  const looksLikeOrderReport =
    data &&
    Array.isArray(data) &&
    data.length > 0 &&
    data[0] &&
    ('openTime' in data[0] || 'closeTime' in data[0] || 'totalAmount' in data[0]);

  if (validData.length === 0) {
    return (
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-4">
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.dailySummaryTitle')}</h3>
          <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.dailyNoBusinessDays')}</p>
          {data && Array.isArray(data) && data.length > 0 && (
            <div className="text-[12px] leading-normal text-obsidian/40 mt-2 space-y-1">
              <p>{t('reports.devValidationNone', { count: data.length })}</p>
              {looksLikeOrderReport && (
                <p className="text-red-600 font-semibold">{t('reports.devWrongShape')}</p>
              )}
              <p className="mt-1">
                {data[0] ? Object.keys(data[0]).join(', ') : ''}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-obsidian/60">{t('reports.devShowFirstItem')}</summary>
                <pre className="mt-1 text-[10px] bg-obsidian/5 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(data[0], null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...validData].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField === 'day') {
      aValue = a.day;
      bValue = b.day;
    } else if (sortField === 'date') {
      aValue = new Date(a.date).getTime();
      bValue = new Date(b.date).getTime();
    } else if (sortField === 'totalSales') {
      aValue = a.totalSales;
      bValue = b.totalSales;
    } else if (sortField === 'orderCount') {
      aValue = a.orderCount;
      bValue = b.orderCount;
    } else if (sortField === 'averageOrder') {
      aValue = a.averageOrder;
      bValue = b.averageOrder;
    } else if (sortField === 'totalDiscounts') {
      aValue = a.totalDiscounts;
      bValue = b.totalDiscounts;
    } else {
      aValue = a.netProfit;
      bValue = b.netProfit;
    }

    if (typeof aValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue as string, sortLocale)
        : (bValue as string).localeCompare(aValue, sortLocale);
    } else {
      const aNum = typeof aValue === 'number' ? aValue : Number(aValue);
      const bNum = typeof bValue === 'number' ? bValue : Number(bValue);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
  });

  const bestDay: DailyAggregate =
    sortedData.length > 0
      ? sortedData.reduce(
          (best, day) => ((day.totalSales ?? 0) > (best.totalSales ?? 0) ? day : best),
          sortedData[0],
        )
      : { id: -1, totalSales: 0, orderCount: 0, day: '', date: '', averageOrder: 0, totalDiscounts: 0, netProfit: 0 };

  const worstDay: DailyAggregate =
    sortedData.length > 0
      ? sortedData.reduce(
          (worst, day) =>
            (day.totalSales ?? 0) < (worst.totalSales ?? Infinity) && (day.totalSales ?? 0) > 0 ? day : worst,
          sortedData[0],
        )
      : { id: -1, totalSales: Infinity, orderCount: 0, day: '', date: '', averageOrder: 0, totalDiscounts: 0, netProfit: 0 };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-4 w-4 text-obsidian/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="h-4 w-4 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    const formatNumericDate = (d: Date): string => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1);
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      const dt = new Date(year, month - 1, day);
      if (!isNaN(dt.getTime())) {
        return formatNumericDate(dt);
      }
    }
    const dt = new Date(dateString);
    if (!isNaN(dt.getTime())) {
      return formatNumericDate(dt);
    }
    return dateString;
  };

  const getRowClassName = (day: DailyAggregate) => {
    const baseClass = 'border-b border-black/5';
    const daySales = day.totalSales ?? 0;
    const bestSales = bestDay.totalSales ?? 0;
    const worstSales = worstDay.totalSales ?? 0;

    if (day.id === bestDay.id && daySales > 0) {
      return `${baseClass} hover:bg-cyan-50 bg-cyan-50/30`;
    }
    if (day.id === worstDay.id && daySales > 0 && worstSales < bestSales) {
      return `${baseClass} hover:bg-red-50 bg-red-50/20`;
    }
    return `${baseClass} hover:bg-cloud-soft-white/50`;
  };

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.dailySummaryTitle')}</h3>
          <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.dailySummarySubtitle')}</p>
        </div>
        <div className="text-[15px] leading-normal text-obsidian/60">
          {t('reports.dailyTotalDays', { count: validData.length })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('day')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colDayName')}
                  <SortIcon field="day" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('date')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colDate')}
                  <SortIcon field="date" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('totalSales')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colTotalSales')}
                  <SortIcon field="totalSales" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('orderCount')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colOrderCount')}
                  <SortIcon field="orderCount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('averageOrder')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colAverageOrder')}
                  <SortIcon field="averageOrder" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('totalDiscounts')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colDiscounts')}
                  <SortIcon field="totalDiscounts" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('netProfit')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colNetProfit')}
                  <SortIcon field="netProfit" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((day) => (
              <tr key={day.id} className={getRowClassName(day)}>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">{day.day}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{formatDate(day.date)}</td>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">
                  {formatCurrency(day.totalSales ?? 0)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {(day.orderCount ?? 0).toLocaleString(numberLocale)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {formatCurrency(day.averageOrder ?? 0)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {formatCurrency(day.totalDiscounts ?? 0)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">
                  {formatCurrency(day.netProfit ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bestDay && (bestDay.totalSales ?? 0) > 0 && (
        <div className="mt-4 rounded-soft-lg bg-cyan-50/50 border border-cyan-200/50 p-3">
          <p className="text-[14px] leading-normal text-obsidian">
            {t('reports.bestDayLine', {
              day: bestDay.day ?? '',
              amount: formatCurrency(bestDay.totalSales ?? 0),
              orders: (bestDay.orderCount ?? 0).toLocaleString(numberLocale),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
