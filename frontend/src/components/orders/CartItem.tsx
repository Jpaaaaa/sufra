import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import { formatOptionsSuffix } from '../../lib/item-options';
import { trayUnitPrice } from '../../hooks/cart-item-utils';
import type { CartItem as CartItemData } from '../../hooks/useOrderModalTypes';

interface CartItemProps {
  cartItem: CartItemData;
  isDelivery: boolean;
  nested?: boolean;
  isActiveTray?: boolean;
  onSelectTray?: (cartLineId: string | null) => void;
  onUpdateQuantity: (cartLineId: string, quantity: number) => void;
  onRemove: (cartLineId: string) => void;
  onUpdateOrderType: (cartLineId: string, newOrderType: 'dine-in' | 'pickup') => void;
  onEditOptions?: (cartLineId: string) => void;
}

function QtyControls({
  quantity,
  onDec,
  onInc,
  onRemove,
}: {
  quantity: number;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={onDec}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white text-[15px] font-bold text-obsidian hover:bg-black/[0.03] active:scale-95"
        aria-label="−"
      >
        −
      </button>
      <span className="min-w-[1.75rem] text-center text-[15px] font-bold tabular-nums text-obsidian">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onInc}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyber-aqua text-[15px] font-bold text-white hover:bg-cyber-aqua/90 active:scale-95"
        aria-label="+"
      >
        +
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="mr-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-[16px] font-bold text-red-500/80 hover:bg-red-50 hover:text-red-600"
        title={t('orders.deleteItemAria')}
        aria-label={t('orders.deleteItemAria')}
      >
        ×
      </button>
    </div>
  );
}

function ServiceTypeToggle({
  value,
  onChange,
}: {
  value: 'dine-in' | 'pickup';
  onChange: (v: 'dine-in' | 'pickup') => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex rounded-lg bg-black/[0.04] p-0.5">
      <button
        type="button"
        onClick={() => onChange('dine-in')}
        className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
          value === 'dine-in' ? 'bg-white text-obsidian shadow-sm' : 'text-obsidian/45 hover:text-obsidian/70'
        }`}
      >
        {t('orders.serviceDineIn')}
      </button>
      <button
        type="button"
        onClick={() => onChange('pickup')}
        className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
          value === 'pickup' ? 'bg-white text-obsidian shadow-sm' : 'text-obsidian/45 hover:text-obsidian/70'
        }`}
      >
        {t('orders.servicePickup')}
      </button>
    </div>
  );
}

export const CartItem = memo(function CartItem({
  cartItem,
  isDelivery,
  nested = false,
  isActiveTray = false,
  onSelectTray,
  onUpdateQuantity,
  onRemove,
  onUpdateOrderType,
  onEditOptions,
}: CartItemProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();

  if (cartItem.lineKind === 'tray') {
    const children = cartItem.children ?? [];
    const unit = trayUnitPrice(children);
    const effectiveOrderType = cartItem.order_type || 'dine-in';
    const total = unit * cartItem.quantity;

    return (
      <div
        className={`overflow-hidden rounded-xl border ${
          isActiveTray
            ? 'border-cyber-aqua/50 bg-cyber-aqua/[0.04]'
            : 'border-black/[0.08] bg-white'
        }`}
      >
        <div
          className={`flex items-center gap-2 border-b border-black/[0.06] px-3 py-2.5 ${
            isActiveTray ? 'bg-cyber-aqua/[0.08]' : 'bg-black/[0.02]'
          }`}
        >
          <div className="h-8 w-1 shrink-0 rounded-full bg-cyber-aqua" aria-hidden />
          <button
            type="button"
            className="min-w-0 flex-1 text-right"
            onClick={() => onSelectTray?.(cartItem.cartLineId)}
            title={isActiveTray ? t('orders.trayDeselectHint') : t('orders.traySelectHint')}
          >
            <div className="flex items-center justify-end gap-2">
              <span className="truncate text-[14px] font-bold text-obsidian">
                {cartItem.trayName || cartItem.item.name}
              </span>
              <span className="shrink-0 rounded-md bg-obsidian px-1.5 py-0.5 text-[10px] font-bold text-white">
                {t('orders.trayBadge')}
              </span>
            </div>
            <div className="mt-0.5 text-[12px] text-obsidian/50">
              {children.length === 0 ? (
                t('orders.trayEmpty')
              ) : (
                <>
                  {t('orders.trayItemsCount', { count: children.length })}
                  <span className="mx-1 text-obsidian/25">·</span>
                  <span className="font-semibold text-cyber-aqua">{fmt(total)}</span>
                </>
              )}
              {isActiveTray ? (
                <span className="mr-1.5 font-semibold text-cyber-aqua"> · {t('orders.trayActive')}</span>
              ) : null}
            </div>
          </button>
          <QtyControls
            quantity={cartItem.quantity}
            onDec={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity - 1)}
            onInc={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity + 1)}
            onRemove={() => onRemove(cartItem.cartLineId)}
          />
        </div>

        {!isDelivery && (
          <div className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-3 py-1.5">
            <ServiceTypeToggle
              value={effectiveOrderType}
              onChange={(v) => onUpdateOrderType(cartItem.cartLineId, v)}
            />
            {isActiveTray ? (
              <button
                type="button"
                onClick={() => onSelectTray?.(null)}
                className="text-[12px] font-semibold text-cyber-aqua hover:underline"
              >
                {t('orders.trayExitToSingle')}
              </button>
            ) : null}
          </div>
        )}

        <div className="divide-y divide-black/[0.04]">
          {children.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-obsidian/35">{t('orders.trayEmptyHint')}</div>
          ) : (
            children.map((child) => (
              <CartItem
                key={child.cartLineId}
                cartItem={{ ...child, order_type: cartItem.order_type }}
                isDelivery
                nested
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemove}
                onUpdateOrderType={onUpdateOrderType}
                onEditOptions={onEditOptions}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  const effectiveOrderType = cartItem.order_type || 'dine-in';
  const optionsSuffix = formatOptionsSuffix(cartItem.selectedOptions);
  const canEditOptions =
    onEditOptions && cartItem.selectedOptions.length > 0 && !cartItem.shelfItem;
  const displayName = cartItem.offerDisplayName ?? cartItem.item.name;
  const lineTotal = cartItem.linePrice * cartItem.quantity;

  if (nested) {
    return (
      <div className="flex items-center gap-2 bg-white py-2 pr-3 pl-5">
        <button
          type="button"
          className={`min-w-0 flex-1 text-right ${canEditOptions ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => canEditOptions && onEditOptions?.(cartItem.cartLineId)}
        >
          <div className="truncate text-[13px] font-semibold text-obsidian">{displayName}</div>
          {optionsSuffix ? (
            <div className="truncate text-[11px] text-obsidian/45">{optionsSuffix}</div>
          ) : null}
          <div className="text-[12px] tabular-nums text-obsidian/50">
            {fmt(cartItem.linePrice)}
            <span className="mx-1 text-obsidian/25">·</span>
            <span className="font-semibold text-cyber-aqua">{fmt(lineTotal)}</span>
          </div>
        </button>
        <QtyControls
          quantity={cartItem.quantity}
          onDec={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity - 1)}
          onInc={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity + 1)}
          onRemove={() => onRemove(cartItem.cartLineId)}
        />
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className={`min-w-0 flex-1 text-right ${canEditOptions ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => canEditOptions && onEditOptions?.(cartItem.cartLineId)}
          title={canEditOptions ? t('orders.optionsEditLine') : undefined}
        >
          <div className="truncate text-[14px] font-bold leading-snug text-obsidian">{displayName}</div>
          {optionsSuffix ? (
            <div className="mt-0.5 truncate text-[12px] text-obsidian/45">{optionsSuffix}</div>
          ) : null}
          <div className="mt-0.5 text-[12px] tabular-nums text-obsidian/50">
            {fmt(cartItem.linePrice)}
            <span className="mx-1 text-obsidian/25">×</span>
            {cartItem.quantity}
            <span className="mx-1 text-obsidian/25">=</span>
            <span className="font-bold text-cyber-aqua">{fmt(lineTotal)}</span>
          </div>
        </button>
        <QtyControls
          quantity={cartItem.quantity}
          onDec={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity - 1)}
          onInc={() => onUpdateQuantity(cartItem.cartLineId, cartItem.quantity + 1)}
          onRemove={() => onRemove(cartItem.cartLineId)}
        />
      </div>
      {!isDelivery && (
        <div className="mt-2">
          <ServiceTypeToggle
            value={effectiveOrderType}
            onChange={(v) => onUpdateOrderType(cartItem.cartLineId, v)}
          />
        </div>
      )}
    </div>
  );
});
