'use client';

import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import FinanceLineChart from '../../components/finance/FinanceLineChart';
import { formatCurrency } from '../../lib/finance/utils';
import type { ProfitSummary } from '../../lib/finance/types';

interface FinancePageProfitSectionProps {
  profit: ProfitSummary;
  revenues: Array<{ date: string; amount: number }>;
  chartData: Array<{ label: string; value: number; timestamp: string }>;
}

export default function FinancePageProfitSection({
  profit,
  revenues,
  chartData,
}: FinancePageProfitSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  return (
    <div className="space-y-6">
      <FinanceLineChart data={chartData} period="daily" title={t('finance.chartProfitTitle')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
          <h3 className="mb-4 text-[18px] leading-tight font-semibold text-obsidian">{t('finance.profitRevenueAnalysis')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-soft-lg border border-black/5 bg-cloud-soft-white p-3">
              <span className="text-[15px] leading-normal text-obsidian/70">{t('finance.summaryTotalRevenue')}</span>
              <span className="text-[15px] leading-normal font-bold text-obsidian">
                {formatCurrency(profit.totalRevenue, numberLocale)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-soft-lg border border-black/5 bg-cloud-soft-white p-3">
              <span className="text-[15px] leading-normal text-obsidian/70">{t('finance.avgDailyRevenue')}</span>
              <span className="text-[15px] leading-normal font-bold text-obsidian">
                {formatCurrency(profit.totalRevenue / (revenues.length || 1), numberLocale)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
          <h3 className="mb-4 text-[18px] leading-tight font-semibold text-obsidian">{t('finance.profitExpenseAnalysis')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-soft-lg border border-black/5 bg-cloud-soft-white p-3">
              <span className="text-[15px] leading-normal text-obsidian/70">{t('finance.summaryTotalExpenses')}</span>
              <span className="text-[15px] leading-normal font-bold text-obsidian">
                {formatCurrency(profit.totalExpenses, numberLocale)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-soft-lg border border-black/5 bg-cloud-soft-white p-3">
              <span className="text-[15px] leading-normal text-obsidian/70">{t('finance.expenseRatio')}</span>
              <span className="text-[15px] leading-normal font-bold text-obsidian">
                {profit.totalRevenue > 0
                  ? `${((profit.totalExpenses / profit.totalRevenue) * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
