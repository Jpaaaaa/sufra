'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeSummary as EmployeeSummaryType } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface EmployeeSummaryProps {
  data: EmployeeSummaryType[];
}

type SortField = 'name' | 'ordersHandled' | 'totalSales' | 'cancellations' | 'avgOrderValue';
type SortDirection = 'asc' | 'desc';

export default function EmployeeSummary({ data }: EmployeeSummaryProps) {
  const { t, i18n } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const sortLocale = useMemo(() => (i18n.language?.startsWith('en') ? 'en' : 'ar'), [i18n.language]);

  const [sortField, setSortField] = useState<SortField>('totalSales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    } else if (sortField === 'ordersHandled') {
      aValue = a.ordersHandled;
      bValue = b.ordersHandled;
    } else if (sortField === 'totalSales') {
      aValue = a.totalSales;
      bValue = b.totalSales;
    } else if (sortField === 'cancellations') {
      aValue = a.cancellations;
      bValue = b.cancellations;
    } else {
      aValue = a.avgOrderValue;
      bValue = b.avgOrderValue;
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
        <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.employeeSummaryTitle')}</h3>
        <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.employeeSummarySubtitle')}</p>
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
                  {t('reports.empColName')}
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('ordersHandled')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.empColOrdersHandled')}
                  <SortIcon field="ordersHandled" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('totalSales')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.empColTotalSales')}
                  <SortIcon field="totalSales" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('cancellations')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.summaryCancellations')}
                  <SortIcon field="cancellations" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('avgOrderValue')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.empColAvgOrder')}
                  <SortIcon field="avgOrderValue" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((employee) => (
              <tr
                key={employee.id}
                className="border-b border-black/5 hover:bg-cloud-soft-white/50"
              >
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">{employee.name}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {employee.ordersHandled.toLocaleString(numberLocale)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">
                  {formatCurrency(employee.totalSales)}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{employee.cancellations}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {formatCurrency(employee.avgOrderValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
