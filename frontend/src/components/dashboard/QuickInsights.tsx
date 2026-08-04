'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, UtensilsCrossed, Activity, ListOrdered } from 'lucide-react';
import { fetchReports } from '../../lib/reports/utils';
import { getServerUrl, fetchJson } from '../../utils';
import { homeUi } from './home-ui';

interface DailySummary {
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}

interface InsightsState {
  bestSeller: string;
  dineIn: number;
  pickup: number;
  delivery: number;
  occupancyPct: number;
  activeOrders: number;
}

const EMPTY: InsightsState = {
  bestSeller: '—',
  dineIn: 0,
  pickup: 0,
  delivery: 0,
  occupancyPct: 0,
  activeOrders: 0,
};

function fmtInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-cloud-soft-white">
      <div className="h-full rounded-full bg-cyber-aqua" style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuickInsights() {
  const { t } = useTranslation();
  const [data, setData] = useState<InsightsState>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const [report, summary, active] = await Promise.all([
        fetchReports('daily', new Date()),
        fetchJson<DailySummary>(`${serverUrl}/reports/daily-summary`).catch(() => null),
        fetchJson<unknown[]>(`${serverUrl}/orders/dine-in/active`).catch(() => []),
      ]);

      const salesByType = report.summary.salesByType ?? { dineIn: 0, pickup: 0, delivery: 0 };
      const best = report.itemsPerformance?.[0]?.name?.trim() || '—';
      const occupied = summary?.occupiedTables ?? 0;
      const empty = summary?.emptyTables ?? 0;
      const totalTables = occupied + empty;
      const occupancyPct = totalTables > 0 ? Math.round((occupied / totalTables) * 100) : 0;
      const activeOrders = Array.isArray(active) ? active.length : 0;

      setData({
        bestSeller: best,
        dineIn: salesByType.dineIn ?? 0,
        pickup: salesByType.pickup ?? 0,
        delivery: salesByType.delivery ?? 0,
        occupancyPct,
        activeOrders,
      });
    } catch (error) {
      console.error('Failed to load quick insights:', error);
      setData(EMPTY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const typeMax = Math.max(data.dineIn, data.pickup, data.delivery, 1);

  return (
    <section className={`${homeUi.surface} overflow-hidden`}>
      <header className="border-b border-black/5 px-4 py-3">
        <h2 className={homeUi.sectionTitle}>{t('home.insightsTitle')}</h2>
      </header>

      {isLoading ? (
        <div className={homeUi.emptyState}>
          <p className={homeUi.emptyTitle}>{t('home.loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-black/5 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
              <Trophy className="h-3.5 w-3.5 text-cyber-aqua" />
              {t('home.insightsBestSeller')}
            </div>
            <p className="truncate text-[16px] font-semibold text-obsidian">{data.bestSeller}</p>
          </div>

          <div className="p-4 md:border-s-0">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
              <UtensilsCrossed className="h-3.5 w-3.5 text-cyber-aqua" />
              {t('home.insightsSalesByType')}
            </div>
            <div className="space-y-2">
              {(
                [
                  ['dineIn', data.dineIn],
                  ['pickup', data.pickup],
                  ['delivery', data.delivery],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-obsidian/60">{t(`home.insightsType_${key}`)}</span>
                    <span className="font-semibold tabular-nums text-obsidian">{fmtInt(value)}</span>
                  </div>
                  <ProgressBar value={value} max={typeMax} />
                </div>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
              <Activity className="h-3.5 w-3.5 text-cyber-aqua" />
              {t('home.insightsOccupancy')}
            </div>
            <p className="text-[26px] font-bold tabular-nums leading-none text-obsidian">
              {data.occupancyPct}
              <span className="text-[14px] font-semibold text-obsidian/40">%</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={data.occupancyPct} max={100} />
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
              <ListOrdered className="h-3.5 w-3.5 text-cyber-aqua" />
              {t('home.insightsActiveOrders')}
            </div>
            <p className="text-[26px] font-bold tabular-nums leading-none text-obsidian">
              {fmtInt(data.activeOrders)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(QuickInsights);
