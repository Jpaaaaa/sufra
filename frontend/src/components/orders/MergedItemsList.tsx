import { memo } from 'react';
import { TFunction } from 'i18next';
import type { MergedOrderLine } from '../../utils/merge-order-items';

interface MergedItemsListProps {
  items: MergedOrderLine[];
  fmt: (amount: number) => string;
  t: TFunction;
}

export const MergedItemsList = memo(function MergedItemsList({
  items,
  fmt,
  t,
}: MergedItemsListProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-olive-gold/40 bg-olive-gold/5 p-3 md:rounded-md md:p-0.5 xl:rounded-xl xl:p-3">
      <div className="text-[16px] font-bold text-obsidian mb-1.5 pb-1.5 border-b border-black/10 md:text-[11px] md:mb-0 md:pb-0 xl:text-[16px] xl:mb-1.5 xl:pb-1.5">
        {t('orders.summaryMergedLineItems', { count: items.length })}
      </div>
      <div className="space-y-1.5 md:space-y-0 xl:space-y-1.5">
        {items.map((item) => {
          const serviceLabel =
            item.service_type === 'pickup'
              ? t('orders.servicePickup')
              : t('orders.serviceDineIn');
          return (
            <div
              key={item.key}
              className="flex items-center justify-between text-[15px] leading-tight py-1.5 gap-3 md:text-[11px] md:py-0 md:gap-0 xl:text-[15px] xl:py-1.5 xl:gap-3"
            >
              <span className="font-bold text-obsidian whitespace-nowrap">{fmt(item.lineTotal)}</span>
              <span className="font-medium text-obsidian/90 truncate flex-1 min-w-0">
                {item.item_name} ×{item.quantity}
                <span className="text-obsidian/60 font-normal"> ({fmt(item.price)})</span>
              </span>
              <span className="text-[14px] leading-tight font-semibold text-obsidian/70 whitespace-nowrap md:text-[11px] xl:text-[14px]">
                {serviceLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
