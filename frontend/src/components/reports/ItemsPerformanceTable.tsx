'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemPerformance } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface ItemsPerformanceTableProps {
  data: ItemPerformance[];
  title?: string;
  subtitle?: string;
}

type SortField = 'name' | 'quantitySold' | 'totalSales';
type SortDirection = 'asc' | 'desc';

export default function ItemsPerformanceTable({
  data,
  title,
  subtitle,
}: ItemsPerformanceTableProps) {
  const { t, i18n } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [sortField, setSortField] = useState<SortField>('totalSales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortLocale = useMemo(() => (i18n.language?.startsWith('en') ? 'en' : 'ar'), [i18n.language]);

  const displayTitle = title ?? t('reports.itemsDetailTitle');
  const displaySubtitle = subtitle ?? t('reports.itemsDetailSubtitle');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField === 'name') {
      aValue = a.name;
      bValue = b.name;
    } else if (sortField === 'quantitySold') {
      aValue = a.quantitySold;
      bValue = b.quantitySold;
    } else {
      aValue = a.totalSales;
      bValue = b.totalSales;
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

  const getStatusBadge = (status: 'high' | 'medium' | 'low') => {
    const label =
      status === 'high'
        ? t('reports.movementHigh')
        : status === 'medium'
          ? t('reports.movementMedium')
          : t('reports.movementLow');
    const config = {
      high: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      medium: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
      low: { color: 'bg-red-100 text-red-700 border-red-200' },
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] leading-relaxed font-medium ${config[status].color}`}
      >
        {label}
      </span>
    );
  };

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

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4">
        <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{displayTitle}</h3>
        <p className="text-[15px] leading-normal text-obsidian/60">{displaySubtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.perfColItemName')}
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('quantitySold')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.perfColQtySold')}
                  <SortIcon field="quantitySold" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('totalSales')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.perfColTotalSales')}
                  <SortIcon field="totalSales" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                {t('reports.perfColMovement')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item) => (
              <tr
                key={item.id}
                className="border-b border-black/5 hover:bg-cloud-soft-white/50"
              >
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{item.name}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {item.quantitySold.toLocaleString(numberLocale)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">
                  {formatCurrency(item.totalSales)}
                </td>
                <td className="px-4 py-3">{getStatusBadge(item.movementStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
