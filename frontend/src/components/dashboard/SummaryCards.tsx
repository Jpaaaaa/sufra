'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../utils';
import { DollarSign, ShoppingBag, Armchair, TrendingUp } from 'lucide-react';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { homeUi } from './home-ui';

interface DailySummary {
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}

function fmtInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function SummaryCards() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { subscribeToOrders } = useOrderSocket();

  const loadSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const data = await fetchJson<DailySummary>(`${serverUrl}/reports/daily-summary`);
      setSummary({
        totalSales: Number(data?.totalSales) || 0,
        ordersCount: Number(data?.ordersCount) || 0,
        occupiedTables: Number(data?.occupiedTables) || 0,
        emptyTables: Number(data?.emptyTables) || 0,
        printerStatus: data?.printerStatus === 'error' ? 'error' : 'success',
      });
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

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.eventType === 'created' || event.eventType === 'updated') {
          loadSummary();
        }
      },
      ['dine-in', 'pickup', 'delivery'],
    );
    return unsubscribe;
  }, [subscribeToOrders, loadSummary]);

  useEffect(() => {
    const interval = setInterval(loadSummary, 60000);
    return () => clearInterval(interval);
  }, [loadSummary]);

  const cards = useMemo(() => {
    if (!summary) return [];
    const avg =
      summary.ordersCount > 0 ? Math.round(summary.totalSales / summary.ordersCount) : 0;
    const currency = t('orders.currency');
    const totalTables = summary.occupiedTables + summary.emptyTables;
    return [
      {
        id: 'sales',
        label: t('home.summaryTotalSales'),
        value: fmtInt(summary.totalSales),
        unit: currency,
        hint: null as string | null,
        icon: DollarSign,
      },
      {
        id: 'orders',
        label: t('home.summaryOrders'),
        value: fmtInt(summary.ordersCount),
        unit: null as string | null,
        hint: null as string | null,
        icon: ShoppingBag,
      },
      {
        id: 'occupied',
        label: t('home.summaryOccupiedTables'),
        value: fmtInt(summary.occupiedTables),
        unit: null as string | null,
        hint: t('home.summaryOccupiedHint', {
          occupied: fmtInt(summary.occupiedTables),
          total: fmtInt(totalTables),
        }),
        icon: Armchair,
      },
      {
        id: 'avg',
        label: t('home.summaryAvgOrder'),
        value: fmtInt(avg),
        unit: currency,
        hint: null as string | null,
        icon: TrendingUp,
      },
    ];
  }, [summary, t]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${homeUi.surface} h-[92px] bg-cloud-soft-white/80`} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.id}
            className={`${homeUi.surface} relative overflow-hidden ps-4 pe-4 py-3.5`}
          >
            <div className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-cyber-aqua" aria-hidden />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
                  {card.label}
                </p>
                <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-[28px] font-bold leading-none tracking-tight text-obsidian tabular-nums">
                    {card.value}
                  </span>
                  {card.unit ? (
                    <span className="text-[12px] font-semibold text-obsidian/45">{card.unit}</span>
                  ) : null}
                </p>
                {card.hint ? (
                  <p className="mt-1.5 text-[11px] font-medium tabular-nums text-obsidian/40">{card.hint}</p>
                ) : (
                  <div className="mt-1.5 h-[15px]" aria-hidden />
                )}
              </div>
              <div className={homeUi.iconWell}>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default memo(SummaryCards);
