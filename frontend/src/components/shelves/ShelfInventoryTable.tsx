'use client';

import { useTranslation } from 'react-i18next';
import { ShelfItem } from '../../hooks/useShelves';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface ShelfInventoryTableProps {
  shelves: ShelfItem[];
  loading: boolean;
  onEdit: (item: ShelfItem) => void;
  onDelete: (item: ShelfItem) => void;
}

export default function ShelfInventoryTable({
  shelves,
  loading,
  onEdit,
  onDelete,
}: ShelfInventoryTableProps) {
  const { t } = useTranslation();
  const { dateLocale } = useOrderLocale();
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading && shelves.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
        {t('shelves.loadingStock')}
      </div>
    );
  }

  if (shelves.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
        {t('shelves.emptyStock')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-soft-xl border border-black/5 bg-white shadow-soft">
      <div className="max-h-[500px] overflow-auto">
        <table className="min-w-full divide-y divide-black/[0.06] text-[15px] leading-normal">
          <thead className="bg-cloud-soft-white sticky top-0">
            <tr>
              <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colItemName')}
              </th>
              <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colBarcode')}
              </th>
              <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colPrice')}
              </th>
              <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colQuantity')}
              </th>
              <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colUpdated')}
              </th>
              <th className="px-4 py-3 text-left text-[13px] leading-relaxed font-bold text-obsidian">
                {t('shelves.colActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06] bg-white">
            {shelves.map((item) => {
              const isOutOfStock = item.quantity === 0;
              return (
                <tr key={item.id} className={`hover:bg-cloud-soft-white/50 ${isOutOfStock ? 'bg-red-50' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                    {item.name}
                    {isOutOfStock && (
                      <span className="mr-2 inline-block rounded-soft px-2 py-0.5 text-[12px] leading-relaxed font-bold text-red-700 bg-red-100">
                        {t('shelves.outOfStockBadge')}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-mono text-obsidian/70">
                    {item.barcode}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-cyber-aqua">
                    {t('halls.priceWithCurrency', {
                      price: item.price,
                      currency: t('orders.currency'),
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center rounded-soft-lg px-3 py-1 text-[13px] leading-relaxed font-bold ${
                      item.quantity === 0
                        ? 'bg-red-50 text-red-700'
                        : item.quantity < 10
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-green-50 text-green-700'
                    }`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-light text-obsidian/70">
                    {formatDate(item.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="rounded-soft-lg border border-black/5 bg-white px-3 py-1.5 text-[13px] leading-relaxed font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft"
                        title={t('halls.edit')}
                      >
                        {t('halls.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="rounded-soft-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed font-bold text-red-700 hover:bg-red-100"
                        title={t('halls.delete')}
                      >
                        {t('halls.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

