import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import type { ExistingOrder } from '../../hooks/useOrderModal';
import { OrderItemOptionLines } from './OrderItemOptionLines';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface OrderSummaryCardProps {
  order: ExistingOrder;
  showItemList: boolean;
  editingOrderId: number | null;
  showMoveUi: boolean;
  isSelected: boolean;
  onToggleSelect?: () => void;
  onEditOrder: (order: ExistingOrder) => void;
  onPrintOrder: (orderId: number) => void;
  onCancelOrder?: (orderId: number) => void;
}

export const OrderSummaryCard = memo(function OrderSummaryCard({
  order,
  showItemList,
  editingOrderId,
  showMoveUi,
  isSelected,
  onToggleSelect,
  onEditOrder,
  onPrintOrder,
  onCancelOrder,
}: OrderSummaryCardProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const isPending = order.status === 'pending';
  const topItems = (order.items ?? []).filter((i: any) => i.parent_order_item_id == null);

  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        isPending ? 'border-amber-200' : 'border-black/[0.08]'
      } ${editingOrderId === order.id ? 'ring-2 ring-olive-gold/40' : ''} ${
        isSelected ? 'ring-2 ring-cyber-aqua/50' : ''
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {showMoveUi && (
          <label className="flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-stone-300 text-cyber-aqua focus:ring-cyber-aqua"
            />
          </label>
        )}
        <span className="text-[15px] font-bold text-obsidian">#{orderDisplayNumber(order)}</span>
        {isPending ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {t('orders.statusPending', { defaultValue: 'معلق' })}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="text-[15px] font-bold tabular-nums text-obsidian">{fmt(order.total)}</span>
      </div>

      {order.note && String(order.note).trim() !== '' && (
        <div className="mb-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-[12px] text-obsidian/70">
          <span className="font-semibold text-obsidian/50">{t('orders.noteLabelStrong')} </span>
          {order.note}
        </div>
      )}

      {(order.order_type === 'delivery' || order.order_type === 'pickup') &&
        (order.customer_name || order.customer_phone) && (
          <div className="mb-2 text-[12px] leading-relaxed text-obsidian/60">
            {order.customer_name}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
            {order.order_type === 'delivery' && order.customer_location
              ? ` · ${order.customer_location}`
              : ''}
          </div>
        )}

      {showItemList && topItems.length > 0 && (
        <div className="mb-2 space-y-1 border-t border-black/[0.05] pt-2">
          {topItems.map((item: any) => {
            const itemTotal = item.price * item.quantity;
            const childNames =
              item.line_kind === 'tray'
                ? (order.items ?? [])
                    .filter((c: any) => c.parent_order_item_id === item.id)
                    .map((c: any) => `${c.item_name}×${c.quantity}`)
                    .join(' + ')
                : null;
            return (
              <div key={item.id} className="flex items-start justify-between gap-2 text-[13px]">
                <span className="shrink-0 font-semibold tabular-nums text-obsidian/80">
                  {fmt(itemTotal)}
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <OrderItemOptionLines
                    itemName={item.item_name}
                    options_json={item.options_json}
                    quantity={item.quantity}
                    nameClassName="font-medium text-obsidian/85 truncate"
                    subLineClassName="text-[11px] text-obsidian/45"
                  />
                  {childNames ? (
                    <div className="truncate text-[11px] text-obsidian/40">{childNames}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 border-t border-black/[0.05] pt-2">
        <button
          type="button"
          onClick={() => onEditOrder(order)}
          className="flex-1 rounded-lg bg-cyber-aqua px-2 py-2 text-[13px] font-bold text-white hover:bg-cyber-aqua/90"
        >
          {t('orders.summaryEdit')}
        </button>
        <button
          type="button"
          onClick={() => onPrintOrder(order.id)}
          className={`rounded-lg px-2.5 py-2 text-[13px] font-bold text-white ${
            isPending ? 'bg-amber-600 hover:bg-amber-700' : 'bg-obsidian/70 hover:bg-obsidian'
          }`}
        >
          {isPending ? t('orders.summaryPrint') : t('orders.summaryReprint')}
        </button>
        {onCancelOrder && (
          <button
            type="button"
            onClick={() => onCancelOrder(order.id)}
            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[13px] font-bold text-red-600 hover:bg-red-100"
          >
            {t('orders.summaryCancelOrder')}
          </button>
        )}
      </div>
    </div>
  );
});
