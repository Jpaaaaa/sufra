import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { ReceiptIcon } from '../icons';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface ArchivedDineInOrder extends ExistingOrder {
  table_id?: number;
  hall_name?: string;
  table_name?: string;
}

interface ArchivedDineInOrderCardProps {
  order: ArchivedDineInOrder;
  onPrintCustomer: (order: ArchivedDineInOrder) => void;
}

export const ArchivedDineInOrderCard = memo(function ArchivedDineInOrderCard({
  order,
  onPrintCustomer,
}: ArchivedDineInOrderCardProps) {
  const { t } = useTranslation();
  const { numberLocale, dateLocale } = useOrderLocale();
  const isCancelled = order.status === 'cancelled';
  const statusColors = isCancelled ? 'border-red-200 bg-red-50' : 'border-gray-400 bg-gray-50';
  const statusText = isCancelled ? t('orders.statusCancelled') : t('orders.statusArchived');
  const statusBadgeColor = isCancelled ? 'bg-red-500 text-white' : 'bg-gray-500 text-white';

  const createdLabel = useMemo(() => {
    if (!order.created_at) return null;
    return new Date(order.created_at).toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [order.created_at, dateLocale]);

  return (
    <div className={`rounded-soft-xl border-2 bg-white p-5 shadow-soft ${statusColors}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/10">
        <span className="text-[18px] leading-tight font-bold text-obsidian">{t('orders.orderNumber', { id: orderDisplayNumber(order) })}</span>
        <span className="text-[18px] leading-tight font-bold text-obsidian bg-obsidian/5 px-3 py-1 rounded-soft-lg">
          {(order.total ?? 0).toLocaleString(numberLocale)} {t('orders.currency')}
        </span>
      </div>

      {/* Table/Hall Info */}
      {(order.table_name || order.hall_name) && (
        <div className="mb-4 rounded-soft-lg border border-cyber-aqua/20 bg-gradient-to-br from-cyber-aqua/5 to-cyber-aqua/10 p-3 text-[14px] leading-relaxed">
          <div className="font-bold text-obsidian mb-2">
            {[
              order.hall_name && `${t('orders.labelHall')} ${order.hall_name}`,
              order.table_name && `${t('orders.labelTable')} ${order.table_name}`,
            ]
              .filter(Boolean)
              .join(' · ')}
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
          {order.items?.slice(0, 3).map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-black/5 last:border-0">
              <span className="truncate text-obsidian/90">{item.item_name} <span className="text-obsidian/60">×{item.quantity}</span></span>
              <span className="font-bold whitespace-nowrap text-obsidian ms-2">
                {(item.price * item.quantity).toLocaleString(numberLocale)} {t('orders.currency')}
              </span>
            </div>
          ))}
          {order.items?.length > 3 && (
            <div className="text-[13px] text-obsidian/60 text-center pt-2 font-medium">
              {t('orders.moreMenuItems', { count: order.items.length - 3 })}
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className={`text-center py-2.5 rounded-soft-lg text-[14px] leading-normal font-bold mb-4 shadow-soft ${statusBadgeColor}`}>
        {statusText}
      </div>

      {/* Created Date */}
      {createdLabel && (
        <div className="mb-4 text-center text-[13px] leading-relaxed text-obsidian/60">{createdLabel}</div>
      )}

      {/* Action Button - Reprint Customer Receipt Only */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => onPrintCustomer(order)}
          className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-3 py-2.5 text-[13px] leading-normal font-bold shadow-soft  hover:shadow-md w-full"
        >
          <ReceiptIcon className="w-4 h-4" />
          {t('orders.reprintCustomerReceipt')}
        </button>
      </div>
    </div>
  );
});
