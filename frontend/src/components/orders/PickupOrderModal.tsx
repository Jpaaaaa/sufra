'use client';

import { useEffect, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { usePickupOrderModal } from '../../hooks/usePickupOrderModal';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { useBarcodeListener } from '../../contexts/BarcodeListenerContext';
import { OrderModalMenu } from './OrderModalMenu';
import { OrderModalCart } from './OrderModalCart';
import { PackageIcon } from '../icons';

interface PickupOrderModalProps {
  onClose: () => void;
  orderToEdit?: ExistingOrder | null;
}

function PickupOrderModal({ onClose, orderToEdit }: PickupOrderModalProps) {
  const { t } = useTranslation();
  const orderModal = usePickupOrderModal();
  const { setPriorityHandler } = useBarcodeListener();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // When pickup modal is open, scans add to this order instead of global shelf sale
  useEffect(() => {
    setPriorityHandler(orderModal.addShelfItemByBarcode);
    return () => setPriorityHandler(null);
  }, [setPriorityHandler, orderModal.addShelfItemByBarcode]);

  // Reset modal state when it opens - only if CREATE mode
  useEffect(() => {
    if (orderToEdit) {
      // EDIT mode: load order data
      orderModal.handleEditOrder(orderToEdit);
    } else {
      // CREATE mode: reset to empty state
      orderModal.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderToEdit]);

  useEffect(() => {
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
    
    if (modalContainerRef.current) {
      const scrollableElements = modalContainerRef.current.querySelectorAll('[data-scrollable]');
      scrollableElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0;
        }
      });
    }
    
    return () => {
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
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
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
        /* Tablet PORTRAIT: vertical - menu on top, cart below */
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
        /* Tablet LANDSCAPE: horizontal - menu left, cart right */
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
            width: 38% !important;
            min-width: 260px !important;
            max-width: 400px !important;
            flex: 0 0 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-top: none !important;
            padding: 8px !important;
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
            width: 40% !important;
            min-width: 340px !important;
            max-width: 480px !important;
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
        className="fixed z-50 bg-obsidian/70 md:p-0.5 xl:p-4"
        style={{ 
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          width: '100vw',
          height: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overscrollBehavior: 'contain',
          margin: 0,
          padding: '1rem',
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
          className="flex flex-col rounded-soft-xl border border-black/5 bg-white shadow-soft texture-surface h-[90svh] max-h-[90svh] md:h-[85svh] md:max-h-[85svh] xl:h-[90svh] xl:max-h-[90svh]"
          style={{
            width: '100%',
            maxWidth: '95vw',
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
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/5 bg-cloud-soft-white flex-shrink-0 md:px-1 md:py-0 xl:px-6 xl:py-4">
            <div className="flex items-center gap-3 md:gap-0.5 xl:gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-soft-lg bg-cyber-aqua text-white md:h-5 md:w-5 xl:h-10 xl:w-10">
                <PackageIcon className="w-6 h-6 md:w-3 md:h-3 xl:w-6 xl:h-6" />
              </div>
              <div>
                <h2 className="text-[18px] sm:text-[20px] md:text-[11px] xl:text-[20px] leading-tight font-bold text-obsidian">{t('orders.pickupTitle')}</h2>
                <p className="text-[12px] sm:text-[13px] md:text-[11px] xl:text-[13px] leading-relaxed text-obsidian/70">{t('orders.newPickupCta')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-soft-lg border border-black/5 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] md:rounded-md md:px-1 md:py-0 md:text-[11px] xl:px-4 xl:py-2 xl:text-[13px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft whitespace-nowrap"
            >
              {t('orders.btnClose')}
            </button>
          </div>

          <div data-order-modal-body className="flex flex-1 min-h-0 overflow-hidden md:gap-0.5 xl:gap-4">
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
              activeTrayId={orderModal.activeTrayId}
              onAddTray={orderModal.addTrayToOrder}
              onSelectTray={orderModal.selectTray}
              ordersExpanded={orderModal.ordersExpanded}
              editingOrder={orderModal.editingOrder}
              editingOrderType="pickup"
              animatedOrderId={orderModal.animatedOrderId}
              isDelivery={false}
              isPickup={true}
              kitchens={orderModal.kitchens}
              subtotal={orderModal.subtotal}
              total={orderModal.total}
              note={orderModal.note}
              editingNote={orderModal.note}
              onSetNote={orderModal.setNote}
              onSetEditingNote={orderModal.setNote}
              onSetOrdersExpanded={orderModal.setOrdersExpanded}
              onEditOrder={orderModal.handleEditOrder}
              onPrintOrder={orderModal.handlePrintOrder}
              onUpdateOrderType={() => {}}
              onUpdateQuantity={orderModal.updateQuantity}
              onRemoveItem={orderModal.removeItemFromOrder}
              onUpdateItemOrderType={() => {}}
              onUpdateCartLineOptions={orderModal.updateCartLineOptions}
              onSubmit={orderModal.handleSubmitOrder}
              onCancel={orderModal.editingOrder ? orderModal.handleCancelEdit : orderModal.clearCart}
              onClearCart={orderModal.clearCart}
              customerName={orderModal.customerName}
              customerPhone={orderModal.customerPhone}
              onSetCustomerName={orderModal.setCustomerName}
              onSetCustomerPhone={orderModal.setCustomerPhone}
              showDiscount={true}
              combinedSubtotal={orderModal.subtotal}
              combinedTotal={orderModal.total}
              tableDiscount={orderModal.orderDiscount}
              appliedDiscount={orderModal.appliedDiscount}
              onSetTableDiscount={orderModal.setOrderDiscount}
              onApplyDiscount={orderModal.handleApplyDiscount}
            />
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}

export default memo(PickupOrderModal);

