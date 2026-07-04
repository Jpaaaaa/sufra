'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../utils';
import { DollarSign, Square, SquareCheck } from 'lucide-react';
import Card from '../ui/Card';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface DailySummary {
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}

export default function SummaryCards() {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { subscribeToOrders } = useOrderSocket();

  const loadSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const data = await fetchJson<DailySummary>(`${serverUrl}/reports/daily-summary`);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
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
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Refetch when orders are created or updated (e.g. completed/cleaned)
  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.eventType === 'created' || event.eventType === 'updated') {
          loadSummary();
        }
      },
      ['dine-in', 'pickup', 'delivery']
    );
    return unsubscribe;
  }, [subscribeToOrders, loadSummary]);

  // Periodic refresh every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(loadSummary, 60000);
    return () => clearInterval(interval);
  }, [loadSummary]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: t('home.summaryTotalSales'),
        value: `${Math.round(summary.totalSales).toLocaleString(numberLocale)} ${t('orders.currency')}`,
        icon: DollarSign,
        iconBg: 'bg-cyber-aqua/10',
        iconColor: 'text-cyber-aqua',
        borderColor: 'border-cyber-aqua/20',
        bgGradient: 'bg-gradient-to-br from-cyber-aqua/5 to-cyber-aqua/10',
      },
      {
        label: t('home.summaryOpenTables'),
        value: summary.emptyTables.toString(),
        icon: Square,
        iconBg: 'bg-cyber-aqua/10',
        iconColor: 'text-cyber-aqua',
        borderColor: 'border-cyber-aqua/20',
        bgGradient: 'bg-gradient-to-br from-cyber-aqua/5 to-cyber-aqua/10',
      },
      {
        label: t('home.summaryClosedTables'),
        value: summary.occupiedTables.toString(),
        icon: SquareCheck,
        iconBg: 'bg-cyber-aqua/10',
        iconColor: 'text-cyber-aqua',
        borderColor: 'border-cyber-aqua/20',
        bgGradient: 'bg-gradient-to-br from-cyber-aqua/5 to-cyber-aqua/10',
      },
    ];
  }, [summary, t, numberLocale]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl shadow-soft border border-black/5 bg-white p-6">
            <div className="text-center text-obsidian/60">{t('home.loading')}</div>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card
            key={index}
            className={`rounded-xl shadow-soft border ${card.borderColor} bg-white p-6 hover:shadow-md`}
          >
            <div className={`${card.bgGradient} rounded-lg p-4 mb-4`}>
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg ${card.iconBg} ${card.iconColor}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
            <h3 className="text-[14px] leading-relaxed font-medium text-obsidian/70 mb-2">
              {card.label}
            </h3>
            <p className="text-[28px] leading-tight font-bold text-obsidian">
              {card.value}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

