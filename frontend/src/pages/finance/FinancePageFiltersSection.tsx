'use client';

import { useTranslation } from 'react-i18next';
import type { FinanceFilters } from '../../lib/finance/types';

interface FinancePageFiltersSectionProps {
  filters: FinanceFilters;
  setFilters: (f: FinanceFilters) => void;
  isSyncing: boolean;
  onSyncCurrent: () => void;
  onSync: () => void;
}

export default function FinancePageFiltersSection({
  filters,
  setFilters,
  isSyncing,
  onSyncCurrent,
  onSync,
}: FinancePageFiltersSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 rounded-soft-xl border border-black/5 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-[15px] leading-normal font-medium text-obsidian">{t('finance.dateFrom')}</label>
          <input
            type="date"
            value={filters.from || ''}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="input-soft"
          />
          <label className="text-[15px] leading-normal font-medium text-obsidian">{t('finance.dateTo')}</label>
          <input
            type="date"
            value={filters.to || ''}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="input-soft"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSyncCurrent}
            disabled={isSyncing}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('finance.syncTodayTitle')}
          >
            {isSyncing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>{t('finance.syncing')}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{t('finance.syncToday')}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing || !filters.from || !filters.to}
            className="rounded-soft-lg border border-cyber-aqua bg-white px-4 py-2 text-[15px] leading-normal font-medium text-cyber-aqua hover:bg-cyber-aqua/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title={t('finance.syncRangeTitle')}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{t('finance.syncRange')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
