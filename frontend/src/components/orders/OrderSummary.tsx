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
    <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-right"
        >
          <span className="truncate text-[14px] font-bold text-obsidian">
            {t('orders.summaryOrdersTitle', { count: orders.length })}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[12px] text-obsidian/45">
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                {t('orders.summaryPending', { count: pendingCount })}
              </span>
            ) : null}
            <span className="text-obsidian/35">{expanded ? '▾' : '◂'}</span>
          </span>
        </button>
        {showMoveUi && selectedCount > 0 && (
          <button
            type="button"
            onClick={onMoveSelected}
            className="shrink-0 rounded-lg bg-cyber-aqua px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-cyber-aqua/90"
          >
            {t('orders.summaryMove', { count: selectedCount })}
          </button>
        )}
      </div>

      {showMergeToggle && (
        <div className="border-t border-black/[0.05] px-3 py-2">
          <button
            type="button"
            onClick={() => setItemsMerged((prev) => !prev)}
            className={`w-full rounded-lg px-3 py-2 text-[12px] font-bold transition-colors ${
              itemsMerged
                ? 'bg-olive-gold/15 text-olive-gold'
                : 'bg-black/[0.03] text-obsidian/70 hover:bg-black/[0.05]'
            }`}
          >
            {itemsMerged ? t('orders.summarySplitItems') : t('orders.summaryMergeItems')}
          </button>
        </div>
      )}

      {expanded && (
        <div className="space-y-2 border-t border-black/[0.05] p-2.5">
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
