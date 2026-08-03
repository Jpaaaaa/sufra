import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import { formatOptionsSuffix } from '../../lib/item-options';
import type { CartItem as CartItemData } from '../../hooks/useOrderModalTypes';

interface CartItemProps {
  cartItem: CartItemData;
  isDelivery: boolean;
  onUpdateQuantity: (cartLineId: string, quantity: number) => void;
  onRemove: (cartLineId: string) => void;
  onUpdateOrderType: (cartLineId: string, newOrderType: 'dine-in' | 'pickup') => void;
  onEditOptions?: (cartLineId: string) => void;
}

export const CartItem = memo(function CartItem({
  cartItem,
  isDelivery,
  onUpdateQuantity,
  onRemove,
  onUpdateOrderType,
  onEditOptions,
}: CartItemProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const effectiveOrderType = cartItem.order_type || 'dine-in';
  const optionsSuffix = formatOptionsSuffix(cartItem.selectedOptions);
  const canEditOptions =
    onEditOptions && cartItem.selectedOptions.length > 0 && !cartItem.shelfItem;

  return (
    <div
      key={cartItem.cartLineId}
      className="rounded-soft-lg border border-black/5 bg-cloud-soft-white p-4 sm:p-5 md:p-0 md:rounded-md xl:p-2 xl:rounded-lg shadow-soft space-y-3 md:space-y-0 xl:space-y-2"
    >
      <div className="flex items-center justify-between gap-6 min-w-0 md:gap-0.5 xl:gap-3">
        <button
          type="button"
          className={`flex-1 min-w-0 me-4 overflow-hidden md:me-0.5 xl:me-2 text-right ${canEditOptions ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => canEditOptions && onEditOptions?.(cartItem.cartLineId)}
          title={canEditOptions ? t('orders.optionsEditLine') : undefined}
        >
          <div className="text-[19px] sm:text-[20px] md:text-[11px] xl:text-[14px] leading-normal font-bold text-obsidian truncate whitespace-nowrap">
            {cartItem.offerDisplayName ?? cartItem.item.name}
          </div>
          {optionsSuffix ? (
            <div className="text-[14px] sm:text-[15px] md:text-[10px] xl:text-[12px] leading-tight text-obsidian/55 truncate">
              {optionsSuffix}
            </div>
          ) : null}
          <div className="text-[17px] sm:text-[18px] md:text-[11px] xl:text-[13px] leading-tight font-light text-obsidian/60 truncate">
            {fmt(cartItem.linePrice)} × {cartItem.quantity} ={' '}
            <span className="font-bold text-cyber-aqua">{fmt(cartItem.linePrice * cartItem.quantity)}</span>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0 md:gap-0 xl:gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity - 1)}
            className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-4 md:w-4 xl:h-7 xl:w-7 items-center justify-center rounded-md bg-white border border-black/5 text-[16px] sm:text-[17px] md:text-[11px] xl:text-[13px] leading-none font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft flex-shrink-0"
          >
            −
          </button>
          <span className="w-8 sm:w-9 md:w-4 xl:w-7 text-center text-[15px] sm:text-[16px] md:text-[11px] xl:text-[13px] leading-none font-bold text-obsidian whitespace-nowrap">
            {cartItem.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity + 1)}
            className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-4 md:w-4 xl:h-7 xl:w-7 items-center justify-center rounded-md bg-cyber-aqua text-[16px] sm:text-[17px] md:text-[11px] xl:text-[13px] leading-none font-bold text-white hover:bg-cyber-aqua/90 shadow-soft flex-shrink-0"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onRemove(cartItem.cartLineId)}
            className="rounded-md bg-red-50 border border-red-300 px-2 py-1.5 text-[14px] leading-tight font-bold text-red-700 hover:bg-red-100 flex-shrink-0 md:px-0 md:py-0 md:text-[11px] xl:px-1.5 xl:py-1 xl:text-[12px]"
            title={t('orders.deleteItemAria')}
          >
            ×
          </button>
        </div>
      </div>

      {!isDelivery && (
        <div className="flex items-center gap-3 pt-3 border-t border-black/5 md:pt-0 md:gap-0.5 xl:pt-2 xl:gap-2">
          <span className="text-[17px] sm:text-[18px] md:text-[11px] xl:text-[12px] leading-tight font-bold text-obsidian/70 whitespace-nowrap">
            {t('orders.cartTypeLabel')}
          </span>
          <div className="flex gap-2 rounded-soft-lg bg-white p-1.5 border border-black/5 md:p-0.5 md:gap-0.5 md:rounded-md xl:p-1 xl:gap-1 xl:rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateOrderType(cartItem.cartLineId, 'dine-in')}
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
              onClick={() => onUpdateOrderType(cartItem.cartLineId, 'pickup')}
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
