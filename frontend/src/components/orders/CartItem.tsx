import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface CartItemData {
  item: Item;
  quantity: number;
  order_type?: 'dine-in' | 'pickup';
  /** When set, show this instead of item.name (e.g. "عرض اليوم") so we don't mention the specific product. */
  offerDisplayName?: string;
}

interface CartItemProps {
  cartItem: CartItemData;
  index: number;
  isDelivery: boolean;
  editingOrderType?: 'dine-in' | 'pickup' | 'delivery'; // Legacy, not used for per-item types
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
  onUpdateOrderType: (itemId: number, newOrderType: 'dine-in' | 'pickup') => void;
}

export const CartItem = memo(function CartItem({
  cartItem,
  index,
  isDelivery,
  onUpdateQuantity,
  onRemove,
  onUpdateOrderType,
}: CartItemProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  // Use the item's own service type, defaulting to 'dine-in'
  const effectiveOrderType = cartItem.order_type || 'dine-in';

  return (
    <div
      key={`${cartItem.item.id}-${index}`}
      className="rounded-soft-lg border border-black/5 bg-cloud-soft-white p-4 sm:p-5 md:p-0 md:rounded-md xl:p-2 xl:rounded-lg shadow-soft space-y-3 md:space-y-0 xl:space-y-2"
    >
      {/* Item Info + Quantity controls: extra gap so +/- never overlap price text */}
      <div className="flex items-center justify-between gap-6 min-w-0 md:gap-0.5 xl:gap-3">
        <div className="flex-1 min-w-0 me-4 overflow-hidden md:me-0.5 xl:me-2">
          <div className="text-[19px] sm:text-[20px] md:text-[11px] xl:text-[14px] leading-normal font-bold text-obsidian truncate whitespace-nowrap">{cartItem.offerDisplayName ?? cartItem.item.name}</div>
          <div className="text-[17px] sm:text-[18px] md:text-[11px] xl:text-[13px] leading-tight font-light text-obsidian/60 truncate">
            {fmt(cartItem.item.price)} × {cartItem.quantity} ={' '}
            <span className="font-bold text-cyber-aqua">{fmt(cartItem.item.price * cartItem.quantity)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 md:gap-0 xl:gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateQuantity(cartItem.item.id, cartItem.quantity - 1)}
            className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-4 md:w-4 xl:h-7 xl:w-7 items-center justify-center rounded-md bg-white border border-black/5 text-[16px] sm:text-[17px] md:text-[11px] xl:text-[13px] leading-none font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft flex-shrink-0"
          >
            −
          </button>
          <span
            className="w-8 sm:w-9 md:w-4 xl:w-7 text-center text-[15px] sm:text-[16px] md:text-[11px] xl:text-[13px] leading-none font-bold text-obsidian whitespace-nowrap"
          >
            {cartItem.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(cartItem.item.id, cartItem.quantity + 1)}
            className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-4 md:w-4 xl:h-7 xl:w-7 items-center justify-center rounded-md bg-cyber-aqua text-[16px] sm:text-[17px] md:text-[11px] xl:text-[13px] leading-none font-bold text-white hover:bg-cyber-aqua/90 shadow-soft flex-shrink-0"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onRemove(cartItem.item.id)}
            className="rounded-md bg-red-50 border border-red-300 px-2 py-1.5 text-[14px] leading-tight font-bold text-red-700 hover:bg-red-100 flex-shrink-0 md:px-0 md:py-0 md:text-[11px] xl:px-1.5 xl:py-1 xl:text-[12px]"
            title={t('orders.deleteItemAria')}
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Item Order Type Selector */}
      {!isDelivery && (
        <div className="flex items-center gap-3 pt-3 border-t border-black/5 md:pt-0 md:gap-0.5 xl:pt-2 xl:gap-2">
          <span className="text-[17px] sm:text-[18px] md:text-[11px] xl:text-[12px] leading-tight font-bold text-obsidian/70 whitespace-nowrap">
            {t('orders.cartTypeLabel')}
          </span>
          <div className="flex gap-2 rounded-soft-lg bg-white p-1.5 border border-black/5 md:p-0.5 md:gap-0.5 md:rounded-md xl:p-1 xl:gap-1 xl:rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateOrderType(cartItem.item.id, 'dine-in')}
              className={`rounded-lg px-4 py-2 text-[15px] sm:text-[16px] md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:px-2 xl:py-1 xl:text-[12px] leading-tight font-bold whitespace-nowrap ${
                effectiveOrderType === 'dine-in'
                  ? 'bg-cyber-aqua text-white shadow-soft'
                  : 'text-obsidian/70 hover:bg-cloud-soft-white'
              }`}
            >
              {t('orders.serviceDineIn')}
            </button>
            <button
              type="button"
              onClick={() => onUpdateOrderType(cartItem.item.id, 'pickup')}
              className={`rounded-lg px-4 py-2 text-[15px] sm:text-[16px] md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:px-2 xl:py-1 xl:text-[12px] leading-tight font-bold whitespace-nowrap ${
                effectiveOrderType === 'pickup'
                  ? 'bg-cyber-aqua text-white shadow-soft'
                  : 'text-obsidian/70 hover:bg-cloud-soft-white'
              }`}
            >
              {t('orders.servicePickup')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

