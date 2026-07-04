'use client';

import { useTranslation } from 'react-i18next';
import { ItemPerformance, UnsoldMenuItem } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import ItemsPerformanceTable from './ItemsPerformanceTable';

const RANK_LIMIT = 10;

function MiniTable({
  title,
  subtitle,
  rows,
  accentClass,
}: {
  title: string;
  subtitle: string;
  rows: ItemPerformance[];
  accentClass: string;
}) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  if (rows.length === 0) return null;
  return (
    <div
      className={`rounded-soft-xl border border-black/5 bg-white p-5 shadow-soft ${accentClass}`}
    >
      <h4 className="text-[17px] font-semibold text-obsidian">{title}</h4>
      <p className="mb-3 text-[14px] leading-normal text-obsidian/60">{subtitle}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[14px]">
          <thead>
            <tr className="border-b border-black/10 text-[13px] text-obsidian/70">
              <th className="py-2 pl-2">{t('reports.miniColRank')}</th>
              <th className="py-2">{t('reports.miniColItem')}</th>
              <th className="py-2">{t('reports.miniColQty')}</th>
              <th className="py-2">{t('reports.miniColSales')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={item.id} className="border-b border-black/5 last:border-0">
                <td className="py-2 pl-2 text-obsidian/50">{i + 1}</td>
                <td className="py-2 font-medium text-obsidian">{item.name}</td>
                <td className="py-2 tabular-nums">{item.quantitySold.toLocaleString(numberLocale)}</td>
                <td className="py-2 font-semibold tabular-nums text-obsidian">
                  {formatCurrency(item.totalSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ItemsSalesReportSectionProps {
  items: ItemPerformance[];
  unsoldMenuItems?: UnsoldMenuItem[];
}

export default function ItemsSalesReportSection({ items, unsoldMenuItems }: ItemsSalesReportSectionProps) {
  const { t } = useTranslation();
  const unsold = unsoldMenuItems ?? [];
  const bySalesDesc = [...items].sort((a, b) => b.totalSales - a.totalSales);
  const top = bySalesDesc.slice(0, RANK_LIMIT);
  const showBottom = bySalesDesc.length > RANK_LIMIT;
  const bottom = showBottom
    ? [...bySalesDesc].sort((a, b) => a.totalSales - b.totalSales).slice(0, RANK_LIMIT)
    : [];

  const hasAny = items.length > 0 || unsold.length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <h3 className="text-[20px] font-semibold leading-tight text-obsidian">{t('reports.itemsReportTitle')}</h3>
        <p className="mt-1 text-[15px] leading-normal text-obsidian/65">
          {t('reports.itemsReportIntro')}
        </p>
      </div>

      {!hasAny && (
        <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 text-center text-[15px] text-obsidian/60">
          {t('reports.itemsNoSalesInPeriod')}
        </div>
      )}

      {hasAny && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MiniTable
            title={t('reports.topSellersTitle')}
            subtitle={t('reports.topSellersSubtitle')}
            rows={top}
            accentClass="border-t-4 border-t-emerald-500/80"
          />
          <MiniTable
            title={t('reports.bottomSellersTitle')}
            subtitle={
              showBottom
                ? t('reports.bottomSellersSubtitleShown')
                : t('reports.bottomSellersSubtitleHidden')
            }
            rows={bottom}
            accentClass="border-t-4 border-t-amber-500/80"
          />
        </div>
      )}

      {unsold.length > 0 && (
        <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft border-t-4 border-t-rose-400/70">
          <h4 className="text-[17px] font-semibold text-obsidian">{t('reports.unsoldMenuTitle')}</h4>
          <p className="mb-3 text-[14px] leading-normal text-obsidian/60">
            {t('reports.unsoldMenuDescription', { count: unsold.length })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {unsold.map((u) => (
              <li
                key={u.id}
                className="rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-1.5 text-[13px] font-medium text-rose-900/90"
              >
                {u.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <ItemsPerformanceTable
          data={items}
          title={t('reports.itemsDetailTitle')}
          subtitle={t('reports.itemsDetailSubtitle')}
        />
      )}
    </div>
  );
}
