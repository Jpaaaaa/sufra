import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Kitchen } from '../../utils';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import { ExistingOrder, CartItem } from '../../hooks/useOrderModal';
import { OrderSummary } from './OrderSummary';
import { CartItem as CartItemComponent } from './CartItem';
import { OrderActions } from './OrderActions';
import { DiscountModal } from './DiscountModal';

interface OrderModalCartProps {
  existingOrders: ExistingOrder[];
  selectedItems: CartItem[];
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
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onUpdateItemOrderType: (itemId: number, newOrderType: 'dine-in' | 'pickup') => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClearCart: () => void;
  // Customer info for delivery orders (required when isDelivery)
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  onSetCustomerName?: (name: string) => void;
  onSetCustomerPhone?: (phone: string) => void;
  onSetCustomerAddress?: (address: string) => void;
  /** When true, show optional name + phone fields for pickup (no address) */
  isPickup?: boolean;
  /** When true, show discount UI (for dine-in table modal) */
  showDiscount?: boolean;
  /** Combined subtotal (existing orders + new items) for discount calculation */
  combinedSubtotal?: number;
  /** Combined total after discount (when showDiscount) */
  combinedTotal?: number;
  /** Current discount amount (before apply) */
  tableDiscount?: number;
  /** Applied/locked discount after user clicks Apply */
  appliedDiscount?: { percent: number; amount: number } | null;
  onSetTableDiscount?: (amount: number) => void;
  onApplyDiscount?: () => void;
  /** Override discount button label (e.g. delivery commission) */
  discountButtonLabel?: string;
  /** Move orders to another table (dine-in only) */
  selectedOrderIds?: Set<number>;
  onToggleOrderSelect?: (orderId: number) => void;
  onMoveSelected?: () => void;
}

function OrderModalCartComponent({
  existingOrders,
  selectedItems,
  ordersExpanded,
  editingOrder,
  editingOrderType,
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
}: OrderModalCartProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const resolvedDiscountLabel = discountButtonLabel ?? t('orders.tableDiscount');
  // Use editingNote when editing, otherwise use note
  const currentNote = editingOrder ? editingNote : note;
  const setCurrentNote = editingOrder ? onSetEditingNote : onSetNote;
  
  // Customer info handlers for delivery orders
  // The hook uses the same state variables for both create and edit modes
  const currentCustomerName = customerName || '';
  const currentCustomerPhone = customerPhone || '';
  const currentCustomerAddress = customerAddress || '';
  const setCurrentCustomerName = onSetCustomerName || (() => {});
  const setCurrentCustomerPhone = onSetCustomerPhone || (() => {});
  const setCurrentCustomerAddress = onSetCustomerAddress || (() => {});
  
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  return (
    <div data-order-cart className="w-[32%] min-w-[280px] max-w-[440px] flex-shrink-0 flex flex-col bg-cloud-soft-white border-l border-black/5 p-4 overflow-hidden min-h-0 md:min-w-[160px] md:max-w-[220px] md:p-1 md:w-[26%] xl:min-w-[260px] xl:max-w-[360px] xl:p-2.5 xl:w-[30%]">
      {/* Existing Orders */}
      {existingOrders.length > 0 && (
        <div className={selectedItems.length > 0 ? 'mb-4 flex-shrink-0 md:mb-1 xl:mb-4' : 'flex-1 min-h-0 flex flex-col'}>
          <div 
            data-scrollable
            className={selectedItems.length > 0 ? 'overflow-y-auto overflow-x-hidden pr-3 max-h-[240px] md:max-h-[110px] md:pr-0.5 xl:max-h-[240px] xl:pr-3' : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 md:pr-0.5 xl:pr-3'}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
            }}
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

      {/* Discount button when we have existing orders only (no new items) */}
      {showDiscount && combinedSubtotal > 0 && selectedItems.length === 0 && onSetTableDiscount && onApplyDiscount && (
        <div className="flex-shrink-0 mb-4 md:mb-1 xl:mb-4">
          <button
            type="button"
            onClick={() => setDiscountModalOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-cyber-aqua/30 bg-cyber-aqua/10 px-4 py-3 text-[16px] font-bold text-cyber-aqua hover:bg-cyber-aqua/20 transition-colors md:px-1.5 md:py-1 md:text-[11px] md:rounded-md xl:px-3 xl:py-2 xl:text-[14px]"
          >
            <span>{resolvedDiscountLabel}</span>
            {appliedDiscount ? (
              <span className="rounded-lg bg-green-500/20 px-2 py-1 text-[14px] font-semibold text-green-700 md:px-1 md:py-0.5 md:text-[11px] xl:px-2 xl:py-1 xl:text-[14px]">
                -{fmt(appliedDiscount.amount)} ✓
              </span>
            ) : (
              <span className="text-obsidian/60">+</span>
            )}
          </button>
        </div>
      )}

      {/* New Order Being Created or Editing */}
      {selectedItems.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-[18px] sm:text-[19px] md:text-[11px] xl:text-[15px] leading-tight font-semibold text-obsidian mb-3 flex-shrink-0 md:mb-0 xl:mb-2">
            {editingOrder
              ? t('orders.menuModalEditing', { id: editingOrder.id })
              : t('orders.cartNewOrder')}{' '}
            ({selectedItems.length})
          </h3>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Customer info for delivery (all optional) */}
            {isDelivery && (
              <div className="mb-4 rounded-xl border border-cyber-aqua/20 bg-cyber-aqua/5 p-4 flex-shrink-0 md:mb-0.5 md:p-0.5 md:rounded-md xl:mb-4 xl:p-4 xl:rounded-xl">
                <h4 className="text-[17px] leading-normal font-bold text-cyber-aqua mb-1 md:text-[11px] md:mb-0 xl:text-[17px]">
                  {t('orders.customerInfoHeading')}
                </h4>
                <p className="text-[13px] leading-relaxed text-obsidian/60 mb-3 md:text-[11px] md:mb-0.5 xl:text-[13px] xl:mb-3">
                  {t('orders.optionalTag')}
                </p>
                <div className="space-y-3 md:space-y-0.5">
                  <div className="grid grid-cols-2 gap-3 md:gap-0.5">
                    <input
                      type="text"
                      placeholder={t('orders.placeholderCustomerName')}
                      value={currentCustomerName}
                      onChange={(e) => setCurrentCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:text-[16px]"
                    />
                    <input
                      type="tel"
                      placeholder={t('orders.placeholderPhone')}
                      value={currentCustomerPhone}
                      onChange={(e) => setCurrentCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:text-[16px]"
                    />
                  </div>
                  <textarea
                    placeholder={t('orders.placeholderAddress')}
                    value={currentCustomerAddress}
                    onChange={(e) => setCurrentCustomerAddress(e.target.value)}
                    rows={1}
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua resize-none md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:text-[16px]"
                  />
                </div>
              </div>
            )}
            {/* Optional name + phone for pickup orders */}
            {isPickup && !isDelivery && (
              <div className="mb-4 rounded-xl border border-black/10 bg-white/80 p-4 flex-shrink-0 md:mb-0.5 md:p-0.5 md:rounded-md xl:mb-4 xl:p-4 xl:rounded-xl">
                <h4 className="text-[17px] leading-normal font-bold text-obsidian mb-1 md:text-[11px] md:mb-0 xl:text-[17px]">
                  {t('orders.pickupNamePhoneHeading')}
                </h4>
                <p className="text-[13px] leading-relaxed text-obsidian/60 mb-3 md:text-[11px] md:mb-0.5 xl:text-[13px] xl:mb-3">
                  {t('orders.optionalTag')}
                </p>
                <div className="grid grid-cols-2 gap-3 md:gap-0.5">
                  <input
                    type="text"
                    placeholder={t('orders.placeholderCustomerName')}
                    value={currentCustomerName}
                    onChange={(e) => setCurrentCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:text-[16px]"
                  />
                  <input
                    type="tel"
                    placeholder={t('orders.placeholderPhone')}
                    value={currentCustomerPhone}
                    onChange={(e) => setCurrentCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:text-[16px]"
                  />
                </div>
              </div>
            )}
            {/* Cart Items */}
            <div 
              data-scrollable
              className="flex-1 min-h-0 space-y-3 rounded-xl border border-black/5 bg-white p-3 mb-4 overflow-y-auto overflow-x-hidden md:space-y-0 md:p-0.5 md:mb-0.5 md:rounded-md xl:space-y-2 xl:p-2 xl:mb-3 xl:rounded-xl"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
              }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {selectedItems.map((si) => (
                <CartItemComponent
                  key={si.item.id}
                  cartItem={si}
                  index={0}
                  isDelivery={isDelivery}
                  editingOrderType={editingOrderType}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                  onUpdateOrderType={onUpdateItemOrderType}
                />
              ))}
            </div>

            {/* Note Input */}
            <div className="flex-shrink-0 mb-4 md:mb-1 xl:mb-2">
              <label className="block mb-2 text-[17px] leading-normal font-bold text-obsidian md:text-[11px] md:mb-0 xl:text-[14px] xl:mb-1">
                {t('orders.cartNoteLabel')}
              </label>
              <textarea
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                placeholder={t('orders.cartNotePlaceholder')}
                rows={1}
                className="w-full rounded-xl border border-black/5 bg-white px-4 py-3 text-[16px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10 resize-none md:px-1.5 md:py-0.5 md:text-[11px] md:rounded-md xl:px-3 xl:py-2 xl:text-[14px]"
              />
            </div>

            {/* Discount button (for dine-in table modal) */}
            {showDiscount && combinedSubtotal > 0 && onSetTableDiscount && onApplyDiscount && (
              <div className="flex-shrink-0 mb-4 md:mb-1">
                <button
                  type="button"
                  onClick={() => setDiscountModalOpen(true)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-cyber-aqua/30 bg-cyber-aqua/10 px-4 py-3 text-[16px] font-bold text-cyber-aqua hover:bg-cyber-aqua/20 transition-colors md:px-1.5 md:py-1 md:text-[11px] md:rounded-md xl:px-3 xl:py-2 xl:text-[14px]"
                >
                  <span>{resolvedDiscountLabel}</span>
                  {appliedDiscount ? (
                    <span className="rounded-lg bg-green-500/20 px-2 py-1 text-[14px] font-semibold text-green-700 md:px-0.5 md:py-0 md:text-[11px] xl:px-2 xl:py-1 xl:text-[14px]">
                      -{fmt(appliedDiscount.amount)} ✓
                    </span>
                  ) : (
                    <span className="text-obsidian/60">+</span>
                  )}
                </button>
              </div>
            )}

            {/* OrderActions with Submit Button - Fixed, Always Visible */}
            <div className="flex-shrink-0 mt-auto pb-[env(safe-area-inset-bottom)]">
              <OrderActions
                subtotal={showDiscount && combinedSubtotal > 0 ? combinedSubtotal : subtotal}
                total={showDiscount && combinedSubtotal > 0 ? combinedTotal : total}
                discountAmount={showDiscount && combinedSubtotal > 0 ? (combinedSubtotal - combinedTotal) : 0}
                isEditing={!!editingOrder}
                hasItems={selectedItems.length > 0}
                onSubmit={onSubmit}
                onCancel={editingOrder ? onCancel : onClearCart}
              />
            </div>
          </div>
        </div>
      )}

      {/* Discount modal (portaled to body so it overlays above order modal) */}
      {showDiscount && combinedSubtotal > 0 && onSetTableDiscount && onApplyDiscount &&
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
          document.body
        )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const OrderModalCart = memo(OrderModalCartComponent);

