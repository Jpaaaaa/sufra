'use client';

import { useTranslation } from 'react-i18next';
import { ReportSummary, SalesByType } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { UtensilsIcon, PackageIcon, TruckIcon, ChartIcon } from '../icons';

interface ReportSummaryCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  isCurrency?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function ReportSummaryCard({
  title,
  value,
  icon,
  isCurrency = false,
  trend,
}: ReportSummaryCardProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  return (
    <div className="stats-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{title}</p>
          <p className="text-[24px] leading-tight font-bold text-obsidian">
            {isCurrency ? formatCurrency(value) : value.toLocaleString(numberLocale)}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-[13px] leading-relaxed font-medium ${
                  trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-[13px] leading-relaxed text-obsidian/50">
                {t('reports.trendFromPrevious')}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-soft-lg bg-cyber-aqua/10 text-cyber-aqua">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReportSummaryCardsProps {
  summary: ReportSummary;
}

type OrderTypeKey = keyof SalesByType;

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const { t } = useTranslation();
  const salesByType = summary.salesByType ?? { dineIn: 0, pickup: 0, delivery: 0 };

  const ORDER_TYPE_CONFIG: {
    key: OrderTypeKey;
    labelKey: 'orderTypeDineIn' | 'orderTypePickup' | 'orderTypeDelivery';
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }[] = [
    { key: 'dineIn', labelKey: 'orderTypeDineIn', icon: UtensilsIcon, accentColor: 'border-emerald-400' },
    { key: 'pickup', labelKey: 'orderTypePickup', icon: PackageIcon, accentColor: 'border-amber-400' },
    { key: 'delivery', labelKey: 'orderTypeDelivery', icon: TruckIcon, accentColor: 'border-blue-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ReportSummaryCard title={t('reports.summaryTotalSales')} value={summary.totalSales} isCurrency />
        <ReportSummaryCard title={t('reports.summaryOrderCount')} value={summary.orderCount} />
        <ReportSummaryCard title={t('reports.summaryAverageOrder')} value={summary.averageOrder} isCurrency />
        <ReportSummaryCard title={t('reports.summaryDiscounts')} value={summary.discounts} isCurrency />
        <ReportSummaryCard title={t('reports.summaryCancellations')} value={summary.cancellations} />
        {summary.netProfit !== undefined && (
          <ReportSummaryCard title={t('reports.summaryNetProfit')} value={summary.netProfit} isCurrency />
        )}
      </div>

      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <h3 className="mb-4 flex items-center gap-2 text-[17px] font-semibold text-obsidian">
          <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10">
            <ChartIcon className="h-4 w-4 text-cyber-aqua" />
          </span>
          {t('reports.salesByOrderType')}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ORDER_TYPE_CONFIG.map(({ key, labelKey, icon: Icon, accentColor }) => (
            <div
              key={key}
              className={`stats-card flex items-center justify-between rounded-soft-lg border-2 ${accentColor} border-t-0 border-l-0 border-b-0 bg-white p-4 shadow-soft`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100">
                  <Icon className="h-5 w-5 text-stone-600" />
                </span>
                <span className="text-[14px] font-medium text-obsidian/80">{t(`reports.${labelKey}`)}</span>
              </div>
              <span className="text-[18px] font-bold text-obsidian">{formatCurrency(salesByType[key])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
