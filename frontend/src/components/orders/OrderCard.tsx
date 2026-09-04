import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { PrinterIcon, ReceiptIcon, PencilIcon, CheckCircleIcon, XIcon } from '../icons';
import { OrderItemOptionLines } from './OrderItemOptionLines';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface OrderCardProps {
  order: ExistingOrder;
  orderType: 'pickup' | 'delivery';
  onComplete: (orderId: number) => void;
  onCancel: (orderId: number) => void;
  onEdit: (order: ExistingOrder) => void;
  onPrintKitchen: (order: ExistingOrder) => void;
  onPrintCustomer: (order: ExistingOrder) => void;
}

export const OrderCard = memo(function OrderCard({
  order,
  orderType,
  onComplete,
  onCancel,
  onEdit,
  onPrintKitchen,
  onPrintCustomer,
}: OrderCardProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  const statusColors =
    order.status === 'pending'
      ? 'border-yellow-400 bg-yellow-50'
      : order.status === 'printed'
      ? 'border-cyber-aqua bg-cyber-aqua/10'
      : order.status === 'completed'
      ? 'border-green-400 bg-green-50'
      : order.status === 'cancelled'
      ? 'border-red-200 bg-red-50'
      : order.status === 'archived'
      ? 'border-gray-400 bg-gray-50'
      : 'border-gray-400 bg-gray-50';

  const statusText = useMemo(() => {
    switch (order.status) {
      case 'pending':
        return t('orders.statusPending');
      case 'printed':
        return t('orders.statusPrinted');
      case 'completed':
        return t('orders.statusCompleted');
      case 'cancelled':
        return t('orders.statusCancelled');
      case 'archived':
        return t('orders.statusArchived');
      default:
        return String(order.status);
    }
  }, [order.status, t]);

  const statusBadgeColor =
    order.status === 'pending'
      ? 'bg-yellow-500 text-white'
      : order.status === 'printed'
      ? 'bg-cyber-aqua text-white'
      : order.status === 'completed'
      ? 'bg-green-500 text-white'
      : order.status === 'cancelled'
      ? 'bg-red-500 text-white'
      : order.status === 'archived'
      ? 'bg-gray-500 text-white'
      : 'bg-gray-500 text-white';

  const showCompleteButton = order.status === 'pending' || order.status === 'printed';
  const showPrintButtons = order.status === 'pending' || order.status === 'printed' || order.status === 'archived';

  return (
    <div className={`rounded-soft-xl border-2 bg-white p-5 shadow-soft ${statusColors}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/10">
        <span className="text-[18px] leading-tight font-bold text-obsidian">{t('orders.orderNumber', { id: orderDisplayNumber(order) })}</span>
        <span className="text-[18px] leading-tight font-bold text-obsidian bg-obsidian/5 px-3 py-1 rounded-soft-lg">
          {(order.total ?? 0).toLocaleString(numberLocale)} {t('orders.currency')}
        </span>
      </div>

      {orderType === 'delivery' && order.delivery_platform_name && (
        <div className="mb-3">
          <span className="inline-block rounded-full bg-cyber-aqua/15 px-3 py-1 text-[13px] font-bold text-cyber-aqua">
            {order.delivery_platform_name}
            {order.delivery_platform_commission_percent != null
              ? ` · ${order.delivery_platform_commission_percent}%`
              : ''}
          </span>
        </div>
      )}

      {/* Customer Info for Delivery Orders */}
      {orderType === 'delivery' && order.customer_name && (
        <div className="mb-4 rounded-soft-lg border border-cyber-aqua/20 bg-gradient-to-br from-cyber-aqua/5 to-cyber-aqua/10 p-3 text-[14px] leading-relaxed">
          <div className="font-bold text-obsidian mb-2">{t('orders.customerLine', { name: order.customer_name })}</div>
          <div className="space-y-1.5">
            {order.customer_phone && (
              <div className="text-obsidian/80 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-obsidian/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {order.customer_phone}
              </div>
            )}
            {(order.customer_address || order.customer_location) && (
              <div className="text-obsidian/80 flex items-start gap-1.5">
                <svg className="w-4 h-4 text-obsidian/60 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{order.customer_address || order.customer_location}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer name/phone for Pickup Orders (optional fields, section always shown on cards) */}
      {orderType === 'pickup' && (
        <div className="mb-4 rounded-soft-lg border border-graphite/20 bg-gradient-to-br from-graphite/5 to-graphite/10 p-3 text-[14px] leading-relaxed">
          <div className="font-bold text-obsidian mb-2">
            {t('orders.customerLine', { name: order.customer_name?.trim() ? order.customer_name : '—' })}
          </div>
          <div className="text-obsidian/80 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-obsidian/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{order.customer_phone || '—'}</span>
          </div>
        </div>
      )}

      {/* Order Note */}
      {order.note && (
        <div className="mb-4 rounded-soft-lg border border-amber-300/40 bg-gradient-to-br from-amber-50/80 to-amber-100/50 p-3 text-[14px] leading-relaxed text-obsidian">
          <div className="font-semibold text-amber-900/70 mb-1 text-[12px]">{t('orders.noteHeading')}</div>
          {order.note}
        </div>
      )}

      {/* Order Items */}
      <div className="mb-4 rounded-soft-lg bg-cloud-soft-white p-3">
        <div className="space-y-2 text-[14px] leading-relaxed">
          {(order.items ?? [])
            .filter((item: any) => item.parent_order_item_id == null)
            .slice(0, 3)
            .map((item: any, idx: number) => (
            <div key={idx} className="flex items-start justify-between py-1 border-b border-black/5 last:border-0 gap-2">
              <OrderItemOptionLines
                itemName={item.item_name}
                options_json={item.options_json}
                quantity={item.quantity}
                nameClassName="truncate text-obsidian/90"
              />
              <span className="font-bold whitespace-nowrap text-obsidian ms-2">
                {(item.price * item.quantity).toLocaleString(numberLocale)} {t('orders.currency')}
              </span>
            </div>
          ))}
          {(order.items ?? []).filter((item: any) => item.parent_order_item_id == null).length > 3 && (
            <div className="text-[13px] text-obsidian/60 text-center pt-2 font-medium">
              {t('orders.moreMenuItems', {
                count:
                  (order.items ?? []).filter((item: any) => item.parent_order_item_id == null).length - 3,
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className={`text-center py-2.5 rounded-soft-lg text-[14px] leading-normal font-bold mb-4 shadow-soft ${statusBadgeColor}`}>
        {statusText}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5">
        {/* Print Buttons - Show for pending, printed, and completed orders */}
        {showPrintButtons && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onPrintKitchen(order)}
              className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-3 py-2.5 text-[13px] leading-normal font-bold shadow-soft  hover:shadow-md"
            >
              <PrinterIcon className="w-4 h-4" />
              {t('orders.btnKitchen')}
            </button>
            <button
              type="button"
              onClick={() => onPrintCustomer(order)}
              className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-3 py-2.5 text-[13px] leading-normal font-bold shadow-soft  hover:shadow-md"
            >
              <ReceiptIcon className="w-4 h-4" />
              {t('orders.btnCustomer')}
            </button>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className={`grid gap-2.5 ${order.status === 'archived' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {order.status !== 'archived' && (
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-cyber-aqua hover:bg-cyber-aqua/90 active:bg-cyber-aqua/80 text-white px-3 py-2.5 text-[13px] leading-normal font-bold shadow-soft  hover:shadow-md"
            >
              <PencilIcon className="w-4 h-4" />
              {t('orders.btnEdit')}
            </button>
          )}
          {showCompleteButton && (
            <button
              type="button"
              onClick={() => onComplete(order.id)}
              className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-green-500 hover:bg-green-600 active:bg-green-700 text-white px-3 py-2.5 text-[13px] leading-normal font-bold shadow-soft  hover:shadow-md"
            >
              <CheckCircleIcon className="w-4 h-4" />
              {t('orders.btnComplete')}
            </button>
          )}
          {showCompleteButton && (
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-soft-lg border border-red-400 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2.5 text-[13px] leading-normal font-bold"
            >
              <XIcon className="w-4 h-4" />
              {t('orders.btnCancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
