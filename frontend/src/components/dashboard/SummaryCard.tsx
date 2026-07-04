'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../utils';
import { Receipt, Square, DollarSign } from 'lucide-react';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import Card from '../ui/Card';

interface DailySummary {
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}

export default function SummaryCard() {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const data = await fetchJson<DailySummary>(`${serverUrl}/reports/daily-summary`);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
      // Use default data if endpoint doesn't exist
      setSummary({
        totalSales: 0,
        ordersCount: 0,
        occupiedTables: 0,
        emptyTables: 0,
        printerStatus: 'success',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm border bg-white/80 backdrop-blur-sm p-6 mb-6">
        <div className="text-center text-obsidian/60">{t('home.loading')}</div>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const stats = useMemo(
    () => [
      {
        label: t('home.statOrdersCount'),
        value: summary.ordersCount.toString(),
        icon: Receipt,
        iconBg: 'bg-cyber-aqua/10',
        iconColor: 'text-cyber-aqua',
      },
      {
        label: t('home.statTablesClosed'),
        value: summary.occupiedTables.toString(),
        icon: Square,
        iconBg: 'bg-orange-500/10',
        iconColor: 'text-orange-500',
      },
      {
        label: t('home.statTablesOpen'),
        value: summary.emptyTables.toString(),
        icon: Square,
        iconBg: 'bg-gray-500/10',
        iconColor: 'text-gray-500',
      },
      {
        label: t('home.statTotalSales'),
        value: `${Math.round(summary.totalSales).toLocaleString(numberLocale)} ${t('orders.currency')}`,
        icon: DollarSign,
        iconBg: 'bg-green-600/10',
        iconColor: 'text-green-600',
      },
    ],
    [summary, t, numberLocale],
  );

  return (
    <Card className="rounded-lg border border-cyber-aqua/20 bg-white p-6 mb-6">
      <h2 className="text-[20px] leading-tight font-medium text-obsidian mb-6">
        {t('home.summaryCardTitle')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="flex flex-col gap-3 p-5 rounded-lg bg-cloud-soft-white border border-cyber-aqua/10 hover:border-cyber-aqua/20"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[13px] leading-relaxed font-normal text-obsidian/70">
                  {stat.label}
                </span>
              </div>
              <span className="text-[20px] leading-tight font-medium text-obsidian">
                {stat.value}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

