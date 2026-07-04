import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Kitchen } from '../../utils';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface ExistingOrder {
  id: number;
  order_type: 'dine-in' | 'pickup' | 'delivery';
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'draft' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'archived' | 'open';
  total: number;
  items: any[];
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_location?: string | null;
  customer_address?: string | null; // For delivery orders
  note?: string;
}

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
  /** When provided, show checkboxes and "Move selected" for dine-in table */
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
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);
  if (orders.length === 0) return null;
  const selectedCount = selectedOrderIds?.size ?? 0;
  const showMoveUi = selectedOrderIds != null && onToggleOrderSelect != null && onMoveSelected != null;

  return (
    <div className={`rounded-xl border border-black/5 bg-white p-4 flex flex-col overflow-hidden shadow-sm md:p-0.5 md:rounded-md xl:p-4 xl:rounded-xl`}>
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
      {expanded && (
        <div 
          className="space-y-4 md:space-y-0.5 xl:space-y-4"
        >
          {orders.map((order) => (
            <div
              key={order.id}
              className={`rounded-xl border p-4 shadow-sm relative md:rounded-md md:p-0.5 xl:rounded-xl xl:p-4 ${
                order.status === 'pending'
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-cyber-aqua bg-cyber-aqua/10'
              } ${editingOrderId === order.id ? 'ring-1 ring-olive-gold' : ''} ${selectedOrderIds?.has(order.id) ? 'ring-2 ring-cyber-aqua' : ''}`}
            >
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/10 md:mb-0 md:pb-0 xl:mb-3 xl:pb-3">
                {showMoveUi && (
                  <label className="flex items-center shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds?.has(order.id) ?? false}
                      onChange={() => onToggleOrderSelect?.(order.id)}
                      className="h-4 w-4 rounded border-stone-300 text-cyber-aqua focus:ring-cyber-aqua"
                    />
                  </label>
                )}
                <span className="text-[17px] sm:text-[18px] md:text-[10px] xl:text-[18px] leading-normal font-bold text-obsidian">
                  #{order.id}
                </span>
                <span className="flex-1" />
                <span className="text-[18px] sm:text-[19px] md:text-[11px] xl:text-[19px] leading-normal font-bold text-obsidian whitespace-nowrap">
                  {fmt(order.total)}
                </span>
              </div>

              {/* Order Note Display */}
              {(order.note && String(order.note).trim() !== '') && (
                <div className="mb-3 rounded-xl border border-cyber-aqua/40 bg-cyber-aqua/10 p-3 text-[15px] leading-tight text-obsidian md:mb-0 md:p-0.5 md:text-[11px] md:rounded-md xl:mb-3 xl:p-3 xl:text-[15px] xl:rounded-xl">
                  <span className="font-bold text-cyber-aqua">{t('orders.noteLabelStrong')} </span>
                  {order.note}
                </div>
              )}

              {/* Customer Info for Delivery Orders */}
              {order.order_type === 'delivery' && order.customer_name && (
                <div className="mb-3 rounded-xl border border-graphite/30 bg-graphite/5 p-3 text-[15px] leading-tight md:mb-0 md:p-0.5 md:text-[11px] md:rounded-md xl:mb-3 xl:p-3 xl:text-[15px] xl:rounded-xl">
                  <div className="font-bold text-graphite mb-1.5 md:mb-0 md:text-[11px] xl:mb-1.5 xl:text-base">
                    {t('orders.customerInfoBlock')}
                  </div>
                  <div className="space-y-0.5 text-obsidian/80 md:text-[11px] xl:text-[15px]">
                    <div>{order.customer_name}</div>
                    {order.customer_phone && <div>{order.customer_phone}</div>}
                    {order.customer_location && <div>{order.customer_location}</div>}
                  </div>
                </div>
              )}

              {/* Optional customer name/phone for Pickup Orders */}
              {order.order_type === 'pickup' && (order.customer_name || order.customer_phone) && (
                <div className="mb-3 rounded-xl border border-graphite/30 bg-graphite/5 p-3 text-[15px] leading-tight md:mb-0 md:p-0.5 md:text-[11px] md:rounded-md xl:mb-3 xl:p-3 xl:text-[15px] xl:rounded-xl">
                  <div className="font-bold text-graphite mb-1.5 md:mb-0 md:text-[11px] xl:mb-1.5 xl:text-base">
                    {t('orders.customerInfoBlock')}
                  </div>
                  <div className="space-y-0.5 text-obsidian/80 md:text-[11px] xl:text-[15px]">
                    {order.customer_name && <div>{order.customer_name}</div>}
                    {order.customer_phone && <div>{order.customer_phone}</div>}
                  </div>
                </div>
              )}

              {/* Order Items Display - compact on tablet, scrollable when many items */}
              <div className="mb-3 rounded-xl bg-white/60 p-3 md:mb-0 md:p-0.5 md:rounded-md xl:mb-3 xl:p-3 xl:rounded-xl">
                <div className="text-[16px] font-bold text-obsidian mb-1.5 pb-1.5 border-b border-black/10 md:text-[11px] md:mb-0 md:pb-0 xl:text-[16px] xl:mb-1.5 xl:pb-1.5">
                  {t('orders.summaryLineItems', { count: order.items.length })}
                </div>
                <div className="space-y-1.5 md:space-y-0 md:max-h-[44px] md:overflow-y-auto xl:space-y-1.5 xl:max-h-none xl:overflow-visible">
                {order.items.map((item: any) => {
                  const serviceType = item.service_type || 'dine-in';
                  const serviceLabel =
                    serviceType === 'pickup' ? t('orders.servicePickup') : t('orders.serviceDineIn');
                  const itemTotal = item.price * item.quantity;
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between text-[15px] leading-tight py-1.5 gap-3 md:text-[11px] md:py-0 md:gap-0 xl:text-[15px] xl:py-1.5 xl:gap-3">
                      <span className="font-bold text-obsidian whitespace-nowrap">{fmt(itemTotal)}</span>
                      <span className="font-medium text-obsidian/90 truncate flex-1 min-w-0">{item.item_name} ×{item.quantity}</span>
                      <span className="text-[14px] leading-tight font-semibold text-obsidian/70 whitespace-nowrap md:text-[11px] xl:text-[14px]">
                        {serviceLabel}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-black/10 md:gap-0 md:pt-0 xl:gap-3 xl:pt-3">
                <button
                  type="button"
                  onClick={() => onEditOrder(order)}
                  className="flex-1 rounded-xl bg-cyber-aqua px-4 py-3 text-[16px] leading-relaxed font-bold text-white hover:bg-cyber-aqua/90 md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:rounded-xl xl:px-4 xl:py-3 xl:text-[16px]"
                >
                  {t('orders.summaryEdit')}
                </button>
                <button
                  type="button"
                  onClick={() => onPrintOrder(order.id)}
                  className={`rounded-xl px-4 py-3 text-[16px] leading-relaxed font-bold text-white md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:rounded-xl xl:px-4 xl:py-3 xl:text-[16px] ${
                    order.status === 'pending'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-graphite hover:bg-graphite/90'
                  }`}
                >
                  {order.status === 'pending' ? t('orders.summaryPrint') : t('orders.summaryReprint')}
                </button>
                {onCancelOrder && (
                  <button
                    type="button"
                    onClick={() => onCancelOrder(order.id)}
                    className="rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-[16px] leading-relaxed font-bold text-red-600 hover:bg-red-100 md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:rounded-xl xl:px-4 xl:py-3 xl:text-[16px]"
                  >
                    {t('orders.summaryCancelOrder')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

