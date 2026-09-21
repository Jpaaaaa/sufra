import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { homeUi } from './home-ui';
import type { HomeOverview } from './useHomeOverview';

function fmtInt(n: number, locale: string): string {
  return Math.round(Number(n) || 0).toLocaleString(locale);
}

function HomeInsights({ overview }: { overview: HomeOverview }) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const { graphData, reportSummary, topItems, unsoldMenuItems, isLoading } = overview;
  const mix = [
    { key: 'dineIn', value: reportSummary.salesByType?.dineIn ?? 0 },
    { key: 'pickup', value: reportSummary.salesByType?.pickup ?? 0 },
    { key: 'delivery', value: reportSummary.salesByType?.delivery ?? 0 },
  ] as const;
  const mixMax = Math.max(...mix.map((m) => m.value), 1);
  const chartMax = Math.max(...graphData.map((d) => d.value), 1);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className={`${homeUi.surface} overflow-hidden`}>
        <header className="border-b border-black/5 px-4 py-3">
          <h2 className={homeUi.sectionTitle}>{t('home.insightsSalesTrend')}</h2>
        </header>
        {isLoading ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.loading')}</p>
          </div>
        ) : graphData.length === 0 ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.insightsNoChart')}</p>
          </div>
        ) : (
          <div className="flex h-[180px] items-end gap-1 px-4 py-4">
            {graphData.map((point, i) => (
              <div key={`${point.timestamp}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[#3B82F6] to-cyber-aqua"
                  style={{ height: `${Math.max(8, Math.round((point.value / chartMax) * 140))}px` }}
                  title={`${point.label}: ${fmtInt(point.value, numberLocale)}`}
                />
                <span className="max-w-full truncate text-[10px] text-obsidian/45">{point.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${homeUi.surface} overflow-hidden`}>
        <header className="border-b border-black/5 px-4 py-3">
          <h2 className={homeUi.sectionTitle}>{t('home.insightsSalesByType')}</h2>
        </header>
        <div className="space-y-3 p-4">
          {mix.map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-obsidian/60">{t(`home.insightsType_${row.key}`)}</span>
                <span className="font-semibold tabular-nums text-obsidian">
                  {fmtInt(row.value, numberLocale)} {t('orders.currency')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cloud-soft-white">
                <div
                  className="h-full rounded-full bg-cyber-aqua"
                  style={{ width: `${Math.round((row.value / mixMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          <div className="border-t border-black/5 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-obsidian/45">
              {t('home.insightsBestSeller')}
            </p>
            {topItems[0] ? (
              <p className="truncate text-[15px] font-semibold text-obsidian">{topItems[0].name}</p>
            ) : (
              <p className={homeUi.emptyTitle}>—</p>
            )}
            {unsoldMenuItems.length > 0 ? (
              <p className="mt-2 text-[12px] text-obsidian/50">
                {t('home.unsoldHint', { count: unsoldMenuItems.length })}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(HomeInsights);
