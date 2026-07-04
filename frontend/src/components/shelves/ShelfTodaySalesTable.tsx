'use client';

import { useTranslation } from 'react-i18next';
import { ShelfSale } from '../../hooks/useShelvesSell';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface ShelfTodaySalesTableProps {
  sales: ShelfSale[];
  loading: boolean;
}

export default function ShelfTodaySalesTable({
  sales,
  loading,
}: ShelfTodaySalesTableProps) {
  const { t } = useTranslation();
  const { dateLocale } = useOrderLocale();
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString(dateLocale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.price * sale.quantity), 0);
  const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);

  if (loading && sales.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
        {t('shelves.loadingTodaySales')}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[18px] leading-tight font-semibold text-obsidian">
          {t('shelves.todaySalesTitle')}
        </h3>
        <div className="flex gap-4 text-[15px] leading-normal">
          <span className="font-bold text-obsidian">
            {t('shelves.totalRevenuePrefix')}:{' '}
            <span className="text-cyber-aqua">
              {t('halls.priceWithCurrency', {
                price: totalRevenue,
                currency: t('orders.currency'),
              })}
            </span>
          </span>
          <span className="font-bold text-obsidian">
            {t('shelves.totalQuantityLabel')}:{' '}
            <span className="text-cyber-aqua">{totalQuantity}</span>
          </span>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('shelves.noSalesToday')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-soft-xl border border-black/5 bg-white shadow-soft">
          <div className="max-h-[400px] overflow-auto">
            <table className="min-w-full divide-y divide-black/[0.06] text-[15px] leading-normal">
              <thead className="bg-cloud-soft-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colTime')}
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colProduct')}
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colBarcode')}
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colQuantity')}
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colPrice')}
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                    {t('shelves.colLineTotal')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] bg-white">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-cloud-soft-white/50">
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-light text-obsidian/70">
                      {formatTime(sale.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                      {sale.item_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-mono text-obsidian/70">
                      {sale.item_barcode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                      {sale.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-cyber-aqua">
                      {t('halls.priceWithCurrency', {
                        price: sale.price,
                        currency: t('orders.currency'),
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                      {t('halls.priceWithCurrency', {
                        price: sale.price * sale.quantity,
                        currency: t('orders.currency'),
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

