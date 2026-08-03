import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import type { ExistingOrder } from '../../hooks/useOrderModal';
import { OrderItemOptionLines } from './OrderItemOptionLines';

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

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm relative md:rounded-md md:p-0.5 xl:rounded-xl xl:p-4 ${
        order.status === 'pending'
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-cyber-aqua bg-cyber-aqua/10'
      } ${editingOrderId === order.id ? 'ring-1 ring-olive-gold' : ''} ${isSelected ? 'ring-2 ring-cyber-aqua' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/10 md:mb-0 md:pb-0 xl:mb-3 xl:pb-3">
        {showMoveUi && (
          <label className="flex items-center shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
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

      {(order.note && String(order.note).trim() !== '') && (
        <div className="mb-3 rounded-xl border border-cyber-aqua/40 bg-cyber-aqua/10 p-3 text-[15px] leading-tight text-obsidian md:mb-0 md:p-0.5 md:text-[11px] md:rounded-md xl:mb-3 xl:p-3 xl:text-[15px] xl:rounded-xl">
          <span className="font-bold text-cyber-aqua">{t('orders.noteLabelStrong')} </span>
          {order.note}
        </div>
      )}

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

      {showItemList && (
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
                <div
                  key={item.id}
                  className="flex items-start justify-between text-[15px] leading-tight py-1.5 gap-3 md:text-[11px] md:py-0 md:gap-0 xl:text-[15px] xl:py-1.5 xl:gap-3"
                >
                  <span className="font-bold text-obsidian whitespace-nowrap">{fmt(itemTotal)}</span>
                  <OrderItemOptionLines
                    itemName={item.item_name}
                    options_json={item.options_json}
                    quantity={item.quantity}
                    nameClassName="font-medium text-obsidian/90 truncate"
                    subLineClassName="text-[12px] text-obsidian/60 md:text-[10px] xl:text-[12px]"
                  />
                  <span className="text-[14px] leading-tight font-semibold text-obsidian/70 whitespace-nowrap md:text-[11px] xl:text-[14px]">
                    {serviceLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  );
});
