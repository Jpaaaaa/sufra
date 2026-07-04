'use client';

import { useTranslation } from 'react-i18next';
import { ShelfItem } from '../../hooks/useShelves';

interface ShelfSellModalProps {
  item: ShelfItem;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ShelfSellModal({
  item,
  onConfirm,
  onClose,
  loading = false,
}: ShelfSellModalProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <h3 className="mb-4 text-[20px] leading-tight font-semibold text-obsidian">
          {t('shelves.confirmSaleTitle')}
        </h3>
        
        <div className="mb-6 space-y-3">
          <div>
            <span className="text-[13px] leading-relaxed font-bold text-obsidian/70">{t('shelves.labelProduct')}</span>
            <p className="text-[16px] leading-normal font-bold text-obsidian">{item.name}</p>
          </div>
          <div>
            <span className="text-[13px] leading-relaxed font-bold text-obsidian/70">{t('shelves.labelPrice')}</span>
            <p className="text-[18px] leading-normal font-bold text-cyber-aqua">
              {t('halls.priceWithCurrency', {
                price: item.price,
                currency: t('orders.currency'),
              })}
            </p>
          </div>
          <div>
            <span className="text-[13px] leading-relaxed font-bold text-obsidian/70">{t('shelves.labelStock')}</span>
            <p className={`text-[16px] leading-normal font-bold ${
              item.quantity === 0
                ? 'text-red-700'
                : item.quantity < 10
                ? 'text-yellow-700'
                : 'text-green-700'
            }`}>
              {item.quantity}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || item.quantity === 0}
            className="flex-1 rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('shelves.selling') : t('shelves.confirmSaleButton')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-soft-lg border border-black/5 bg-white px-5 py-3 text-[15px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft disabled:opacity-50"
          >
            {t('halls.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

