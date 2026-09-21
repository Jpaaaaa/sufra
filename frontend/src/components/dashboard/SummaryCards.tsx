import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Armchair, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { homeUi } from './home-ui';
import type { HomeOverview } from './useHomeOverview';

function fmtInt(n: number, locale: string): string {
  return Math.round(Number(n) || 0).toLocaleString(locale);
}

function SummaryCards({ overview }: { overview: HomeOverview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { numberLocale } = useOrderLocale();
  const { reportSummary, profit, live, isLoading } = overview;
  const currency = t('orders.currency');
  const totalTables = live.occupiedTables + live.emptyTables;
  const occupancyPct = totalTables > 0 ? Math.round((live.occupiedTables / totalTables) * 100) : 0;

  const cards = useMemo(
    () => [
      {
        id: 'sales',
        label: t('home.kpiSales'),
        value: fmtInt(reportSummary.totalSales, numberLocale),
        unit: currency,
        hint: t('home.kpiSalesHint', { avg: fmtInt(reportSummary.averageOrder, numberLocale), currency }),
        icon: TrendingUp,
        tint: 'bg-[#E8F1FF]',
        well: 'bg-[#3B82F6] text-white',
        href: '/reports',
      },
      {
        id: 'orders',
        label: t('home.kpiOrders'),
        value: fmtInt(reportSummary.orderCount, numberLocale),
        unit: null as string | null,
        hint: t('home.kpiOrdersHint', {
          dineIn: fmtInt(reportSummary.salesByType?.dineIn ?? 0, numberLocale),
          pickup: fmtInt(reportSummary.salesByType?.pickup ?? 0, numberLocale),
          delivery: fmtInt(reportSummary.salesByType?.delivery ?? 0, numberLocale),
          currency,
        }),
        icon: ShoppingBag,
        tint: 'bg-[#E7F8F2]',
        well: 'bg-[#10B981] text-white',
        href: '/orders',
      },
      {
        id: 'profit',
        label: t('home.kpiProfit'),
        value: fmtInt(profit?.netProfit ?? reportSummary.netProfit ?? 0, numberLocale),
        unit: currency,
        hint: t('home.kpiProfitHint', {
          expenses: fmtInt(profit?.totalExpenses ?? 0, numberLocale),
          currency,
        }),
        icon: Wallet,
        tint: 'bg-[#ECFDF3]',
        well: 'bg-[#059669] text-white',
        href: '/finance',
      },
      {
        id: 'leak',
        label: t('home.kpiLeak'),
        value: fmtInt(reportSummary.cancellations, numberLocale),
        unit: null as string | null,
        hint: t('home.kpiLeakHint', {
          discounts: fmtInt(reportSummary.discounts, numberLocale),
          currency,
        }),
        icon: Receipt,
        tint: 'bg-[#FFF4E5]',
        well: 'bg-[#F59E0B] text-white',
        href: '/reports',
      },
      {
        id: 'floor',
        label: t('home.kpiFloor'),
        value: fmtInt(live.occupiedTables, numberLocale),
        unit: null as string | null,
        hint: t('home.summaryOccupiedHint', {
          occupied: fmtInt(live.occupiedTables, numberLocale),
          total: fmtInt(totalTables, numberLocale),
        }) + ` · ${occupancyPct}%`,
        icon: Armchair,
        tint: 'bg-[#F3E8FF]',
        well: 'bg-[#8B5CF6] text-white',
        href: '/pos/floor',
      },
    ],
    [currency, live.occupiedTables, numberLocale, occupancyPct, profit, reportSummary, t, totalTables],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${homeUi.surface} h-[118px] bg-white/70`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => navigate(card.href)}
            className={`relative overflow-hidden rounded-2xl ${card.tint} px-4 py-3.5 text-start shadow-soft ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-obsidian/55">{card.label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.well}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
              <span className="text-[26px] font-bold leading-none tracking-tight text-obsidian tabular-nums">
                {card.value}
              </span>
              {card.unit ? (
                <span className="text-[12px] font-semibold text-obsidian/45">{card.unit}</span>
              ) : null}
            </p>
            <p className="mt-2 line-clamp-2 text-[11px] font-medium text-obsidian/45">{card.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

export default memo(SummaryCards);
