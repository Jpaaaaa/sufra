'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';
import { ReportPeriod, ReportFilters } from '@/lib/reports/types';
import { formatDateForPeriod } from '@/lib/reports/utils';

interface ReportsControlsProps {
  period: ReportPeriod;
  date: Date;
  onDateChange: (date: Date) => void;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onExport: (format: 'pdf' | 'excel') => void;
  isExporting?: boolean;
}

export default function ReportsControls({
  period,
  date,
  onDateChange,
  filters,
  onFiltersChange,
  onExport,
  isExporting = false,
}: ReportsControlsProps) {
  const { t } = useTranslation();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [formattedDate, setFormattedDate] = useState<string>('');

  const employeeKeys = ['reports.mockEmployee1', 'reports.mockEmployee2', 'reports.mockEmployee3', 'reports.mockEmployee4'] as const;
  const itemKeys = ['reports.mockItem1', 'reports.mockItem2', 'reports.mockItem3', 'reports.mockItem4'] as const;

  const employees = useMemo(
    () =>
      [1, 2, 3, 4].map((id) => ({
        id,
        name: t(employeeKeys[id - 1]),
      })),
    [t],
  );

  const items = useMemo(
    () =>
      [1, 2, 3, 4].map((id) => ({
        id,
        name: t(itemKeys[id - 1]),
      })),
    [t],
  );

  const yearlyReportField = useGlobalNumericField(
    period === 'yearly' ? String(date.getFullYear()) : '2024',
    (s) => {
      const year = parseInt(s, 10);
      if (year > 2000 && year <= new Date().getFullYear()) {
        const newDate = new Date(date);
        newDate.setFullYear(year);
        onDateChange(newDate);
      }
    },
  );

  useEffect(() => {
    setFormattedDate(formatDateForPeriod(date, period));
  }, [date, period]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (period === 'weekly') {
      const weekValue = e.target.value;
      if (weekValue) {
        const [year, weekStr] = weekValue.split('-W');
        const week = parseInt(weekStr);
        if (year && week) {
          const newDate = getDateFromWeek(parseInt(year), week);
          onDateChange(newDate);
        }
      }
    } else {
      const parts = e.target.value.split('-').map(Number);
      if (parts.length === 3) {
        const newDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(newDate.getTime())) {
          onDateChange(newDate);
        }
      }
    }
  };

  const getDateInputType = () => {
    if (period === 'daily') return 'date';
    if (period === 'weekly') return 'week';
    if (period === 'monthly') return 'month';
    return 'number';
  };

  const getDateInputValue = () => {
    if (period === 'yearly') {
      return date.getFullYear().toString();
    }
    if (period === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'weekly') {
      const y = date.getFullYear();
      const w = getWeekNumber(date);
      return `${y}-W${String(w).padStart(2, '0')}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const year = parseInt(e.target.value);
    if (year > 2000 && year <= new Date().getFullYear()) {
      const newDate = new Date(date);
      newDate.setFullYear(year);
      onDateChange(newDate);
    }
  };

  const getWeekNumber = (d: Date) => {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const getDateFromWeek = (year: number, week: number) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  };

  const dateLabel =
    period === 'daily'
      ? t('reports.pickDay')
      : period === 'weekly'
        ? t('reports.pickWeek')
        : period === 'monthly'
          ? t('reports.pickMonth')
          : t('reports.pickYear');

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-soft-xl border border-black/5 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-4">
          <label className="text-[15px] leading-normal font-medium text-obsidian">{dateLabel}</label>
          {period === 'yearly' ? (
            <input
              type="text"
              inputMode="numeric"
              min="2000"
              max={new Date().getFullYear()}
              value={getDateInputValue()}
              onChange={handleYearChange}
              onFocus={yearlyReportField.onFocus}
              className="input-soft w-32"
            />
          ) : (
            <input
              type={getDateInputType()}
              value={getDateInputValue()}
              onChange={handleDateChange}
              className="input-soft"
            />
          )}
          <span className="text-[15px] leading-normal text-obsidian/60" suppressHydrationWarning>
            {formattedDate || formatDateForPeriod(date, period)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="btn-ghost flex items-center gap-2"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {t('reports.filtersButton')}
          </button>

          <div className="h-6 w-px bg-black/[0.06]"></div>

          <button
            type="button"
            onClick={() => onExport('pdf')}
            disabled={isExporting}
            className="btn-ghost flex items-center gap-2 text-[15px] leading-normal disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {isExporting ? t('reports.exporting') : t('reports.exportPdf')}
          </button>
          <button
            type="button"
            onClick={() => onExport('excel')}
            disabled={isExporting}
            className="btn-ghost flex items-center gap-2 text-[15px] leading-normal disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {isExporting ? t('reports.exporting') : t('reports.exportExcel')}
          </button>
        </div>
      </div>

      {isFiltersOpen && (
        <div className="rounded-soft-xl border border-black/5 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[15px] leading-normal font-bold text-obsidian">{t('reports.filtersPanelTitle')}</h4>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(false)}
              className="text-[15px] leading-normal text-obsidian/60 hover:text-obsidian"
            >
              {t('reports.close')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
                {t('reports.filterByEmployee')}
              </label>
              <select
                value={filters.employeeId || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    employeeId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="input-soft w-full"
              >
                <option value="">{t('reports.filterAll')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
                {t('reports.filterByItem')}
              </label>
              <select
                value={filters.itemId || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    itemId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="input-soft w-full"
              >
                <option value="">{t('reports.filterAll')}</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
                {t('reports.filterByOrderStatus')}
              </label>
              <select
                value={filters.orderStatus || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    orderStatus: e.target.value
                      ? (e.target.value as ReportFilters['orderStatus'])
                      : undefined,
                  })
                }
                className="input-soft w-full"
              >
                <option value="">{t('reports.filterAll')}</option>
                <option value="pending">{t('orders.statusPending')}</option>
                <option value="printed">{t('orders.statusPrinted')}</option>
                <option value="completed">{t('orders.statusCompleted')}</option>
                <option value="cancelled">{t('orders.statusCancelled')}</option>
              </select>
            </div>
          </div>

          {(filters.employeeId || filters.itemId || filters.orderStatus) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => onFiltersChange({})}
                className="text-[15px] leading-normal text-obsidian/60 hover:text-obsidian underline"
              >
                {t('reports.clearAllFilters')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
