'use client';

import { useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Hall, TableEntity } from '../../utils';
import { useOrderModal } from '../../hooks/useOrderModal';
import { useOrderMoney } from '../../hooks/useOrderMoney';
import { useBarcodeListener } from '../../contexts/BarcodeListenerContext';
import { OrderModalHeader } from './OrderModalHeader';
import { OrderModalMenu } from './OrderModalMenu';
import { OrderModalCart } from './OrderModalCart';
import { MoveToTableModal } from './MoveToTableModal';

interface OrderModalProps {
  hall: Hall;
  table: TableEntity;
  onClose: () => void;
}

function OrderModal({ hall, table, onClose }: OrderModalProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const orderModal = useOrderModal(table);
  const { setPriorityHandler } = useBarcodeListener();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // When order modal is open, scans add to this table's order instead of global shelf sale
  useEffect(() => {
    setPriorityHandler(orderModal.addShelfItemByBarcode);
    return () => setPriorityHandler(null);
  }, [setPriorityHandler, orderModal.addShelfItemByBarcode]);

  // Memoize combined total calculation (includes discount for table)
  const combinedTotal = useMemo(() => {
    const hasExistingOrders = orderModal.existingOrders.length > 0;
    const hasNewOrder = orderModal.selectedItems.length > 0;

    if (!hasExistingOrders && !hasNewOrder) return null;

    const combinedSubtotal = orderModal.tableSubtotal + orderModal.subtotal;
    const discountToApply = orderModal.appliedDiscount?.amount ?? orderModal.tableDiscount;
    const total = Math.max(0, combinedSubtotal - discountToApply);

    if (total === 0 && combinedSubtotal === 0) return null;

    return { total, subtotal: combinedSubtotal };
  }, [orderModal.tableSubtotal, orderModal.subtotal, orderModal.tableDiscount, orderModal.appliedDiscount]);

  // INSTANT RENDERING - NO DELAYS
  useEffect(() => {
    // Block body scroll INSTANTLY - no delays
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    window.scrollTo(0, 0);
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    // Reset scroll positions INSTANTLY
    if (modalContainerRef.current) {
      const scrollableElements = modalContainerRef.current.querySelectorAll('[data-scrollable]');
      scrollableElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0;
        }
      });
    }

    return () => {
      // Restore styles INSTANTLY
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

  // Prevent backdrop scrolling - INSTANT, NO DELAYS
  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-scrollable]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-scrollable]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    backdrop.addEventListener('wheel', handleWheel, { passive: false });
    backdrop.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      backdrop.removeEventListener('wheel', handleWheel);
      backdrop.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const modalContent = (
    <>
      <style>{`
        /* Performance optimizations for Electron */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        [data-scrollable] {
          /* Optimized scrolling - no expensive properties */
        }
        /* NO ANIMATIONS - POS SPEED ONLY */
        /* Custom scrollbar styles for modal scrollable areas */
        [data-scrollable]::-webkit-scrollbar {
          width: 8px;
        }
        [data-scrollable]::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        [data-scrollable]::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        [data-scrollable]::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        /* Tablet PORTRAIT: vertical - menu on top, cart below (height > width) */
        @media (min-width: 768px) and (max-width: 1279px) and (max-aspect-ratio: 1/1) {
          [data-order-modal] {
            height: 85svh !important;
            max-height: 85svh !important;
          }
          [data-order-modal-body] {
            flex-direction: column !important;
            gap: 0 !important;
          }
          [data-order-modal] [data-order-menu] {
            width: 100% !important;
            min-width: unset !important;
            max-width: unset !important;
            flex: 0 0 auto !important;
            max-height: 45% !important;
            border-left: none !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
            padding: 8px !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 100% !important;
            min-width: unset !important;
            max-width: unset !important;
            flex: 1 1 auto !important;
            border-left: none !important;
            border-top: 1px solid rgba(0,0,0,0.05) !important;
            padding: 8px !important;
          }
          [data-order-modal] [data-order-item-grid] {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)) !important;
            gap: 6px !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child {
            flex: 1 !important;
            min-width: 0 !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            width: 140px !important;
            flex-shrink: 0 !important;
          }
        }
        /* Tablet LANDSCAPE: horizontal - menu left, cart right (width >= height) */
        @media (min-width: 768px) and (max-width: 1279px) and (min-aspect-ratio: 1/1) {
          [data-order-modal] {
            height: 85svh !important;
            max-height: 85svh !important;
          }
          [data-order-modal-body] {
            flex-direction: row !important;
            gap: 0.5rem !important;
          }
          [data-order-modal] [data-order-menu] {
            width: auto !important;
            min-width: unset !important;
            max-width: unset !important;
            max-height: none !important;
            flex: 1 1 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-bottom: none !important;
            padding: 6px !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 28% !important;
            min-width: 180px !important;
            max-width: 280px !important;
            flex: 0 0 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-top: none !important;
            padding: 6px !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child,
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            flex: none !important;
            min-width: unset !important;
            width: auto !important;
          }
          [data-order-modal] [data-order-item-grid] {
            grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)) !important;
            gap: 4px !important;
          }
        }
        /* Desktop: horizontal layout (1280px+) */
        @media (min-width: 1280px) {
          [data-order-modal-body] {
            flex-direction: row !important;
            gap: 1rem !important;
          }
          [data-order-modal] [data-order-menu] {
            width: auto !important;
            min-width: unset !important;
            max-width: unset !important;
            max-height: none !important;
            flex: 1 1 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-bottom: none !important;
            padding: 1rem !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 30% !important;
            min-width: 260px !important;
            max-width: 360px !important;
            flex: 0 0 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-top: none !important;
            padding: 0.625rem 1rem !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child,
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            flex: none !important;
            min-width: unset !important;
            width: auto !important;
          }
        }
      `}</style>
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden overscroll-contain bg-obsidian/70 p-2 md:bg-obsidian/80 md:p-1 lg:p-2"
        style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          width: '100vw',
          height: '100svh',
          margin: 0,
          zIndex: 9998,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          ref={modalContainerRef}
          data-order-modal
          className="flex flex-col rounded-soft-xl border border-black/5 bg-white shadow-soft texture-surface h-[95svh] max-h-[95svh] md:!h-[85svh] md:!max-h-[85svh] md:rounded-soft-md xl:!h-[95svh] xl:!max-h-[95svh] xl:rounded-soft-xl"
          style={{
            width: '100%',
            maxWidth: '98vw',
            margin: '0',
            position: 'relative',
            flexShrink: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Total Display */}
          {combinedTotal && (
            <div className="relative bg-gradient-to-r from-cyber-aqua/8 via-cyber-aqua/12 to-cyber-aqua/8 border-b border-cyber-aqua/20 flex-shrink-0 md:py-0 xl:py-3.5">
              <div className="flex items-center justify-center px-5 py-3.5 md:px-1 md:py-0 xl:px-5 xl:py-3.5">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 md:gap-3 lg:gap-6">
                  {combinedTotal.subtotal > combinedTotal.total ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] leading-normal font-medium text-obsidian/60 md:text-[11px] xl:text-[15px]">
                          {t('orders.totalBeforeDiscount')}
                        </span>
                        <span className="text-[18px] leading-normal font-semibold text-obsidian/80 line-through md:text-[11px] xl:text-[18px]">
                          {fmt(combinedTotal.subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] leading-normal font-medium text-obsidian/70 md:text-[11px] xl:text-[17px]">
                          {t('orders.totalAfterDiscount')}
                        </span>
                        <span className="text-[24px] sm:text-[26px] md:text-[11px] xl:text-[26px] leading-none font-black text-cyber-aqua">
                          {fmt(combinedTotal.total)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-4">
                      <span className="text-[17px] leading-normal font-medium text-obsidian/70 md:text-[11px] xl:text-[17px]">
                        {t('orders.totalGrand')}
                      </span>
                      <span className="text-[24px] sm:text-[26px] md:text-[10px] xl:text-[26px] leading-none font-black text-cyber-aqua">
                        {fmt(combinedTotal.total)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <OrderModalHeader
            hall={hall}
            table={table}
            existingOrders={orderModal.existingOrders}
            onClose={onClose}
            onPrintKitchen={() => orderModal.handlePrintAllKitchen()}
            onPrintInvoice={() =>
              orderModal.handlePrintReceipt(
                hall.name,
                table.name || t('orders.tableDefaultName', { number: table.number }),
              )
            }
            onClearTable={() => orderModal.handleClearTable(onClose)}
          />


          {/* Main content: horizontal on desktop, vertical on tablet */}
          <div data-order-modal-body className="flex flex-1 min-h-0 overflow-hidden gap-3 md:gap-0 xl:gap-4">
            <OrderModalMenu
              items={orderModal.items}
              allMenuItems={orderModal.allMenuItems}
              kitchens={orderModal.kitchens}
              categories={orderModal.categories}
              selectedCategory={orderModal.selectedCategory}
              searchQuery={orderModal.searchQuery}
              loadingItems={orderModal.loadingItems}
              editingOrder={orderModal.editingOrder}
              onSetSelectedCategory={orderModal.setSelectedCategory}
              onSetSearchQuery={orderModal.setSearchQuery}
              onAddItem={orderModal.addItemToOrder}
              onAddShelfItemByBarcode={orderModal.addShelfItemByBarcode}
              onCancelEdit={orderModal.handleCancelEdit}
            />

            <OrderModalCart
              existingOrders={orderModal.existingOrders}
              selectedItems={orderModal.selectedItems}
              ordersExpanded={orderModal.ordersExpanded}
              editingOrder={orderModal.editingOrder}
              editingOrderType={orderModal.editingOrderType}
              animatedOrderId={orderModal.animatedOrderId}
              isDelivery={orderModal.isDelivery}
              kitchens={orderModal.kitchens}
              subtotal={orderModal.subtotal}
              total={orderModal.total}
              note={orderModal.note}
              editingNote={orderModal.editingNote}
              onSetNote={orderModal.setNote}
              onSetEditingNote={orderModal.setEditingNote}
              onSetOrdersExpanded={orderModal.setOrdersExpanded}
              onEditOrder={orderModal.handleEditOrder}
              onPrintOrder={orderModal.handlePrintOrder}
              onCancelOrder={orderModal.handleCancelOrder}
              onUpdateOrderType={orderModal.handleUpdateOrderType}
              onUpdateQuantity={orderModal.updateQuantity}
              onRemoveItem={orderModal.removeItemFromOrder}
              onUpdateItemOrderType={orderModal.updateItemOrderType}
              onUpdateCartLineOptions={orderModal.updateCartLineOptions}
              onSubmit={orderModal.editingOrder ? orderModal.handleSaveEditedOrder : orderModal.handleSubmitOrder}
              onCancel={orderModal.handleCancelEdit}
              onClearCart={orderModal.clearCart}
              showDiscount={true}
              combinedSubtotal={orderModal.tableSubtotal + orderModal.subtotal}
              combinedTotal={Math.max(0, orderModal.tableSubtotal + orderModal.subtotal - (orderModal.appliedDiscount?.amount ?? orderModal.tableDiscount))}
              tableDiscount={orderModal.tableDiscount}
              appliedDiscount={orderModal.appliedDiscount}
              onSetTableDiscount={orderModal.setTableDiscount}
              onApplyDiscount={orderModal.handleApplyDiscount}
              selectedOrderIds={orderModal.selectedOrderIds}
              onToggleOrderSelect={orderModal.toggleOrderSelect}
              onMoveSelected={() => orderModal.setShowMoveToTableModal(true)}
            />
          </div>
        </div>
      </div>
      {orderModal.showMoveToTableModal && (
        <MoveToTableModal
          currentTableId={table.id}
          selectedCount={orderModal.selectedOrderIds.size}
          onSelectTable={orderModal.handleMoveOrders}
          onClose={() => orderModal.setShowMoveToTableModal(false)}
        />
      )}
    </>
  );

  // INSTANT RENDERING - render immediately
  return createPortal(modalContent, document.body);
}

// Memoize the component to prevent unnecessary re-renders when parent re-renders
export default memo(OrderModal, (prevProps, nextProps) => {
  return (
    prevProps.hall.id === nextProps.hall.id &&
    prevProps.table.id === nextProps.table.id &&
    prevProps.onClose === nextProps.onClose
  );
});
