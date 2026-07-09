import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kitchen } from '../../utils';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import type { ExistingOrder } from '../../hooks/useOrderModal';
import { mergeOrderItemsAcrossOrders } from '../../utils/merge-order-items';
import { MergedItemsList } from './MergedItemsList';
import { OrderSummaryCard } from './OrderSummaryCard';

interface OrderSummaryProps {
  orders: ExistingOrder[];
  expanded: boolean;
  onToggleExpanded: () => void;
  editingOrderId: number | null;
  animatedOrderId: number | null;
  isDelivery: boolean;
  kitchens: Kitchen[];
  onEditOrder: (order: ExistingOrder) => void;
  onPrintOrder: (orderId: number) => void;
  onCancelOrder?: (orderId: number) => void;
  onUpdateOrderType?: (orderId: number, newOrderType: 'dine-in' | 'pickup' | 'delivery') => void;
  selectedOrderIds?: Set<number>;
  onToggleOrderSelect?: (orderId: number) => void;
  onMoveSelected?: () => void;
}

export const OrderSummary = memo(function OrderSummary({
  orders,
  expanded,
  onToggleExpanded,
  editingOrderId,
  onEditOrder,
  onPrintOrder,
  onCancelOrder,
  selectedOrderIds,
  onToggleOrderSelect,
  onMoveSelected,
}: OrderSummaryProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const [itemsMerged, setItemsMerged] = useState(false);
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);
  const mergedItems = useMemo(
    () => (itemsMerged ? mergeOrderItemsAcrossOrders(orders) : []),
    [orders, itemsMerged],
  );

  if (orders.length === 0) return null;

  const selectedCount = selectedOrderIds?.size ?? 0;
  const showMoveUi = selectedOrderIds != null && onToggleOrderSelect != null && onMoveSelected != null;
  const showMergeToggle = showMoveUi && orders.length > 1;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 flex flex-col overflow-hidden shadow-sm md:p-0.5 md:rounded-md xl:p-4 xl:rounded-xl">
      <div className="mb-3 flex w-full items-center justify-between flex-shrink-0 md:mb-0 xl:mb-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex flex-1 items-center justify-between text-[17px] sm:text-[18px] md:text-[11px] xl:text-[18px] leading-normal font-bold text-obsidian hover:text-cyber-aqua py-2 md:py-0 xl:py-2"
        >
          <span>{t('orders.summaryOrdersTitle', { count: orders.length })}</span>
          <div className="flex items-center gap-3 md:gap-1.5 xl:gap-3">
            <span className="text-[14px] leading-relaxed font-light text-obsidian/60 md:text-[11px] xl:text-[14px]">
              {t('orders.summaryPending', { count: pendingCount })}
            </span>
            <span className="text-[17px] leading-normal font-bold text-cyber-aqua md:text-[11px] xl:text-[17px]">
              {expanded ? '▼' : '◀'}
            </span>
          </div>
        </button>
        {showMoveUi && selectedCount > 0 && (
          <button
            type="button"
            onClick={onMoveSelected}
            className="mr-2 rounded-lg bg-cyber-aqua px-3 py-1.5 text-[13px] font-bold text-white hover:bg-cyber-aqua/90 md:text-[11px]"
          >
            {t('orders.summaryMove', { count: selectedCount })}
          </button>
        )}
      </div>

      {showMergeToggle && (
        <div className="mb-3 flex-shrink-0 md:mb-0.5 xl:mb-3">
          <button
            type="button"
            onClick={() => setItemsMerged((prev) => !prev)}
            className={`w-full rounded-xl border px-4 py-2.5 text-[15px] font-bold transition-colors md:rounded-md md:px-1.5 md:py-1 md:text-[11px] xl:px-4 xl:py-2.5 xl:text-[15px] ${
              itemsMerged
                ? 'border-olive-gold bg-olive-gold/15 text-olive-gold hover:bg-olive-gold/25'
                : 'border-black/10 bg-white text-obsidian hover:bg-cloud-soft-white'
            }`}
          >
            {itemsMerged ? t('orders.summarySplitItems') : t('orders.summaryMergeItems')}
          </button>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 md:space-y-0.5 xl:space-y-4">
          {itemsMerged && <MergedItemsList items={mergedItems} fmt={fmt} t={t} />}

          {orders.map((order) => (
            <OrderSummaryCard
              key={order.id}
              order={order}
              showItemList={!itemsMerged}
              editingOrderId={editingOrderId}
              showMoveUi={showMoveUi}
              isSelected={selectedOrderIds?.has(order.id) ?? false}
              onToggleSelect={() => onToggleOrderSelect?.(order.id)}
              onEditOrder={onEditOrder}
              onPrintOrder={onPrintOrder}
              onCancelOrder={onCancelOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
});
