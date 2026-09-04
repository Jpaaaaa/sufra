import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Kitchen } from '../../utils';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import { ExistingOrder, CartItem } from '../../hooks/useOrderModal';
import { findCartLine } from '../../utils/order-trays';
import { OrderSummary } from './OrderSummary';
import { CartItem as CartItemComponent } from './CartItem';
import { OrderActions } from './OrderActions';
import { DiscountModal } from './DiscountModal';
import { ItemOptionsModal } from './ItemOptionsModal';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface OrderModalCartProps {
  existingOrders: ExistingOrder[];
  selectedItems: CartItem[];
  activeTrayId?: string | null;
  onAddTray?: () => void;
  onSelectTray?: (cartLineId: string | null) => void;
  ordersExpanded: boolean;
  editingOrder: ExistingOrder | null;
  editingOrderType: 'dine-in' | 'pickup' | 'delivery';
  animatedOrderId: number | null;
  isDelivery: boolean;
  kitchens: Kitchen[];
  subtotal: number;
  total: number;
  note: string;
  editingNote: string;
  onSetNote: (note: string) => void;
  onSetEditingNote: (note: string) => void;
  onSetOrdersExpanded: (expanded: boolean) => void;
  onEditOrder: (order: any) => void;
  onPrintOrder: (orderId: number) => void;
  onCancelOrder?: (orderId: number) => void;
  onUpdateOrderType?: (orderId: number, newOrderType: 'dine-in' | 'pickup' | 'delivery') => void;
  onUpdateQuantity: (cartLineId: string, quantity: number) => void;
  onRemoveItem: (cartLineId: string) => void;
  onUpdateItemOrderType: (cartLineId: string, newOrderType: 'dine-in' | 'pickup') => void;
  onUpdateCartLineOptions?: (
    cartLineId: string,
    selected: import('../../lib/item-options').SelectedItemOptions,
    linePrice: number,
  ) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClearCart: () => void;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  onSetCustomerName?: (name: string) => void;
  onSetCustomerPhone?: (phone: string) => void;
  onSetCustomerAddress?: (address: string) => void;
  isPickup?: boolean;
  showDiscount?: boolean;
  combinedSubtotal?: number;
  combinedTotal?: number;
  tableDiscount?: number;
  appliedDiscount?: { percent: number; amount: number } | null;
  onSetTableDiscount?: (amount: number) => void;
  onApplyDiscount?: () => void;
  discountButtonLabel?: string;
  selectedOrderIds?: Set<number>;
  onToggleOrderSelect?: (orderId: number) => void;
  onMoveSelected?: () => void;
}

function OrderModalCartComponent({
  existingOrders,
  selectedItems,
  activeTrayId = null,
  onAddTray,
  onSelectTray,
  ordersExpanded,
  editingOrder,
  editingOrderType: _editingOrderType,
  animatedOrderId,
  isDelivery,
  kitchens,
  subtotal,
  total,
  note,
  editingNote,
  onSetNote,
  onSetEditingNote,
  onSetOrdersExpanded,
  onEditOrder,
  onPrintOrder,
  onCancelOrder,
  onUpdateOrderType,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemOrderType,
  onSubmit,
  onCancel,
  onClearCart,
  customerName,
  customerPhone,
  customerAddress,
  onSetCustomerName,
  onSetCustomerPhone,
  onSetCustomerAddress,
  isPickup = false,
  showDiscount = false,
  combinedSubtotal = 0,
  combinedTotal = 0,
  tableDiscount = 0,
  appliedDiscount = null,
  onSetTableDiscount,
  onApplyDiscount,
  discountButtonLabel,
  selectedOrderIds,
  onToggleOrderSelect,
  onMoveSelected,
  onUpdateCartLineOptions,
}: OrderModalCartProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const [editingCartLineId, setEditingCartLineId] = useState<string | null>(null);
  const editingCartLine = editingCartLineId
    ? findCartLine(selectedItems, editingCartLineId)
    : null;
  const resolvedDiscountLabel = discountButtonLabel ?? t('orders.tableDiscount');
  const currentNote = editingOrder ? editingNote : note;
  const setCurrentNote = editingOrder ? onSetEditingNote : onSetNote;

  const currentCustomerName = customerName || '';
  const currentCustomerPhone = customerPhone || '';
  const currentCustomerAddress = customerAddress || '';
  const setCurrentCustomerName = onSetCustomerName || (() => {});
  const setCurrentCustomerPhone = onSetCustomerPhone || (() => {});
  const setCurrentCustomerAddress = onSetCustomerAddress || (() => {});

  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const hasCart = selectedItems.length > 0;
  const cartTitle = editingOrder
    ? t('orders.menuModalEditing', { id: orderDisplayNumber(editingOrder) })
    : t('orders.cartNewOrder');

  return (
    <div
      data-order-cart
      className="flex w-[40%] min-w-[320px] max-w-[520px] flex-shrink-0 flex-col overflow-hidden border-l border-black/[0.06] bg-[#F7F8F9] min-h-0 md:min-w-[260px] md:max-w-[400px] md:w-[38%] xl:min-w-[360px] xl:max-w-[500px] xl:w-[40%]"
    >
      {/* Existing table orders */}
      {existingOrders.length > 0 && (
        <div
          className={
            hasCart
              ? 'max-h-[28%] flex-shrink-0 overflow-hidden border-b border-black/[0.06]'
              : 'flex min-h-0 flex-1 flex-col'
          }
        >
          <div
            data-scrollable
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.18) transparent' }}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <OrderSummary
              orders={existingOrders}
              expanded={ordersExpanded}
              onToggleExpanded={() => onSetOrdersExpanded(!ordersExpanded)}
              editingOrderId={editingOrder?.id || null}
              animatedOrderId={animatedOrderId}
              isDelivery={isDelivery}
              kitchens={kitchens}
              onEditOrder={onEditOrder}
              onPrintOrder={onPrintOrder}
              onCancelOrder={onCancelOrder}
              onUpdateOrderType={onUpdateOrderType}
              selectedOrderIds={selectedOrderIds}
              onToggleOrderSelect={onToggleOrderSelect}
              onMoveSelected={onMoveSelected}
            />
          </div>
        </div>
      )}

      {!hasCart && existingOrders.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-center text-[14px] leading-relaxed text-obsidian/40">
            {t('orders.cartEmptyHint')}
          </p>
          {onAddTray ? (
            <button
              type="button"
              onClick={onAddTray}
              className="rounded-lg border border-dashed border-cyber-aqua/40 bg-cyber-aqua/[0.06] px-4 py-2.5 text-[13px] font-bold text-cyber-aqua hover:bg-cyber-aqua/10"
            >
              + {t('orders.addTray')}
            </button>
          ) : null}
        </div>
      )}

      {!hasCart && existingOrders.length > 0 && onAddTray ? (
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-b border-black/[0.06] bg-white px-3 py-2.5">
          <button
            type="button"
            onClick={onAddTray}
            className="shrink-0 rounded-lg border border-dashed border-cyber-aqua/40 bg-cyber-aqua/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-cyber-aqua hover:bg-cyber-aqua/10"
          >
            + {t('orders.addTray')}
          </button>
        </div>
      ) : null}

      {hasCart && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Cart header */}
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-obsidian">{cartTitle}</div>
              <div className="text-[12px] text-obsidian/45">
                {t('orders.cartLinesCount', {
                  count: selectedItems.length,
                  defaultValue: `${selectedItems.length} أصناف`,
                })}
              </div>
            </div>
            {onAddTray ? (
              <button
                type="button"
                onClick={onAddTray}
                className="shrink-0 rounded-lg border border-dashed border-cyber-aqua/40 bg-cyber-aqua/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-cyber-aqua hover:bg-cyber-aqua/10"
              >
                + {t('orders.addTray')}
              </button>
            ) : null}
            {activeTrayId ? (
              <button
                type="button"
                onClick={() => onSelectTray?.(null)}
                className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-obsidian/70 hover:bg-black/[0.03]"
              >
                {t('orders.trayExitToSingle')}
              </button>
            ) : null}
          </div>

          {activeTrayId ? (
            <div className="flex-shrink-0 bg-cyber-aqua/[0.08] px-3 py-1.5 text-center text-[12px] font-semibold text-cyber-aqua">
              {t('orders.trayAddHint')}
            </div>
          ) : null}

          {/* Customer fields */}
          {isDelivery && (
            <div className="flex-shrink-0 space-y-2 border-b border-black/[0.05] bg-white px-3 py-2.5">
              <div className="text-[12px] font-semibold text-obsidian/55">
                {t('orders.customerInfoHeading')}{' '}
                <span className="font-normal text-obsidian/35">{t('orders.optionalTag')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t('orders.placeholderCustomerName')}
                  value={currentCustomerName}
                  onChange={(e) => setCurrentCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none focus:border-cyber-aqua"
                />
                <input
                  type="tel"
                  placeholder={t('orders.placeholderPhone')}
                  value={currentCustomerPhone}
                  onChange={(e) => setCurrentCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none focus:border-cyber-aqua"
                />
              </div>
              <textarea
                placeholder={t('orders.placeholderAddress')}
                value={currentCustomerAddress}
                onChange={(e) => setCurrentCustomerAddress(e.target.value)}
                rows={1}
                className="w-full resize-none rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none focus:border-cyber-aqua"
              />
            </div>
          )}

          {isPickup && !isDelivery && (
            <div className="flex-shrink-0 space-y-2 border-b border-black/[0.05] bg-white px-3 py-2.5">
              <div className="text-[12px] font-semibold text-obsidian/55">
                {t('orders.pickupNamePhoneHeading')}{' '}
                <span className="font-normal text-obsidian/35">{t('orders.optionalTag')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t('orders.placeholderCustomerName')}
                  value={currentCustomerName}
                  onChange={(e) => setCurrentCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none focus:border-cyber-aqua"
                />
                <input
                  type="tel"
                  placeholder={t('orders.placeholderPhone')}
                  value={currentCustomerPhone}
                  onChange={(e) => setCurrentCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none focus:border-cyber-aqua"
                />
              </div>
            </div>
          )}

          {/* Line items — single list surface */}
          <div
            data-scrollable
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.18) transparent' }}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className="divide-y divide-black/[0.05]">
              {selectedItems.map((si) => (
                <CartItemComponent
                  key={si.cartLineId}
                  cartItem={si}
                  isDelivery={isDelivery}
                  isActiveTray={si.lineKind === 'tray' && si.cartLineId === activeTrayId}
                  onSelectTray={onSelectTray}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                  onUpdateOrderType={onUpdateItemOrderType}
                  onEditOptions={onUpdateCartLineOptions ? (id) => setEditingCartLineId(id) : undefined}
                />
              ))}
            </div>
          </div>

          {/* Compact footer tools + checkout */}
          <div className="flex-shrink-0 space-y-2 border-t border-black/[0.08] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.04)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                placeholder={t('orders.cartNotePlaceholder')}
                className="min-w-0 flex-1 rounded-lg border border-black/8 bg-[#F7F8F9] px-3 py-2 text-[13px] text-obsidian outline-none placeholder:text-obsidian/35 focus:border-cyber-aqua/40"
              />
              {showDiscount && combinedSubtotal > 0 && onSetTableDiscount && onApplyDiscount && (
                <button
                  type="button"
                  onClick={() => setDiscountModalOpen(true)}
                  className="shrink-0 rounded-lg border border-black/8 bg-[#F7F8F9] px-3 py-2 text-[12px] font-bold text-obsidian/70 hover:border-cyber-aqua/30 hover:text-cyber-aqua"
                >
                  {appliedDiscount ? (
                    <span className="text-green-600">−{fmt(appliedDiscount.amount)}</span>
                  ) : (
                    resolvedDiscountLabel
                  )}
                </button>
              )}
            </div>

            <OrderActions
              subtotal={showDiscount && combinedSubtotal > 0 ? combinedSubtotal : subtotal}
              total={showDiscount && combinedSubtotal > 0 ? combinedTotal : total}
              discountAmount={
                showDiscount && combinedSubtotal > 0 ? combinedSubtotal - combinedTotal : 0
              }
              isEditing={!!editingOrder}
              hasItems={hasCart}
              onSubmit={onSubmit}
              onCancel={editingOrder ? onCancel : onClearCart}
            />
          </div>
        </div>
      )}

      {onUpdateCartLineOptions &&
        createPortal(
          <ItemOptionsModal
            isOpen={!!editingCartLine}
            item={editingCartLine?.item ?? null}
            initialSelections={editingCartLine?.selectedOptions}
            onClose={() => setEditingCartLineId(null)}
            confirmLabel={t('orders.optionsSaveLine')}
            onConfirm={(selected, linePrice) => {
              if (editingCartLineId) {
                onUpdateCartLineOptions(editingCartLineId, selected, linePrice);
              }
              setEditingCartLineId(null);
            }}
          />,
          document.body,
        )}

      {showDiscount &&
        combinedSubtotal > 0 &&
        onSetTableDiscount &&
        onApplyDiscount &&
        createPortal(
          <DiscountModal
            isOpen={discountModalOpen}
            onClose={() => setDiscountModalOpen(false)}
            tableSubtotal={combinedSubtotal}
            tableDiscount={tableDiscount}
            appliedDiscount={appliedDiscount}
            onDiscountChange={onSetTableDiscount}
            onApplyDiscount={onApplyDiscount}
          />,
          document.body,
        )}
    </div>
  );
}

export const OrderModalCart = memo(OrderModalCartComponent);
