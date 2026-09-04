'use client';

import { useEffect, useRef, memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useDeliveryOrderModal } from '../../hooks/useDeliveryOrderModal';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { useBarcodeListener } from '../../contexts/BarcodeListenerContext';
import { OrderModalMenu } from './OrderModalMenu';
import { OrderModalCart } from './OrderModalCart';
import { DeliveryPlatformModal } from './DeliveryPlatformModal';
import { DELIVERY_ORDER_MODAL_EMBEDDED_CSS } from './deliveryOrderModalEmbeddedStyles';
import { TruckIcon } from '../icons';

interface DeliveryOrderModalProps {
  onClose: () => void;
  orderToEdit?: ExistingOrder | null;
}

function DeliveryOrderModal({ onClose, orderToEdit }: DeliveryOrderModalProps) {
  const { t } = useTranslation();
  const orderModal = useDeliveryOrderModal();
  const { setPriorityHandler } = useBarcodeListener();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [deliveryPlatformModalOpen, setDeliveryPlatformModalOpen] = useState(false);

  const showDeliveryPlatformInHeader =
    orderModal.selectedItems.length > 0 || orderModal.mode === 'EDIT';

  const deliveryPlatformSummary = useMemo(() => {
    if (orderModal.selectedDeliveryPlatformId == null) return t('orders.noDeliveryPlatform');
    const p = orderModal.deliveryPlatforms?.find((o) => o.id === orderModal.selectedDeliveryPlatformId);
    return p ? `${p.name} (${p.commission_percent}%)` : t('orders.noDeliveryPlatform');
  }, [orderModal.selectedDeliveryPlatformId, orderModal.deliveryPlatforms, t]);

  // When delivery modal is open, scans add to this order instead of global shelf sale
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
      <style>{DELIVERY_ORDER_MODAL_EMBEDDED_CSS}</style>
      <div 
        ref={backdropRef}
        className="fixed z-50 bg-obsidian/70 xl:p-4"
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
          {/* Header — منصة التوصيل في الشريط العلوي (بعيداً عن قائمة الأصناف) */}
          <div className="flex flex-col gap-2 border-b border-black/5 bg-cloud-soft-white px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0 md:gap-1.5 md:px-2 md:py-1.5 xl:gap-2 xl:px-6 xl:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-1.5 xl:gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-soft-lg bg-cyber-aqua text-white md:h-7 md:w-7 xl:h-10 xl:w-10">
                  <TruckIcon className="h-6 w-6 md:h-3 md:w-3 xl:h-6 xl:w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[18px] font-bold leading-tight text-obsidian sm:text-[20px] xl:text-[20px]">{t('orders.deliveryTitle')}</h2>
                  <p className="text-[12px] leading-relaxed text-obsidian/70 sm:text-[13px] xl:text-[13px]">{t('orders.newDeliveryCta')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-soft-lg border border-black/5 bg-white px-3 py-1.5 text-[12px] font-bold leading-normal text-obsidian shadow-soft hover:bg-cloud-soft-white sm:px-4 sm:py-2 sm:text-[13px] xl:px-4 xl:py-2 xl:text-[13px] whitespace-nowrap"
              >
                {t('orders.btnClose')}
              </button>
            </div>
            {showDeliveryPlatformInHeader && (
              <button
                type="button"
                onClick={() => setDeliveryPlatformModalOpen(true)}
                className="flex w-full max-w-full items-center justify-between gap-2 rounded-soft-lg border border-cyber-aqua/40 bg-cyber-aqua/10 px-3 py-2 text-right shadow-sm transition-colors hover:bg-cyber-aqua/15 md:py-1.5 xl:px-4 xl:py-2.5"
              >
                <span className="text-[14px] font-bold text-cyber-aqua xl:text-[14px]">{t('orders.deliveryPlatformLabel')}</span>
                <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-obsidian/85 md:text-[10px] xl:text-[13px]">
                  {deliveryPlatformSummary}
                </span>
              </button>
            )}
          </div>

          <div data-order-modal-body className="flex flex-1 min-h-0 overflow-hidden md:gap-0 xl:gap-4">
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
              editingOrderType="delivery"
              animatedOrderId={orderModal.animatedOrderId}
              isDelivery={true}
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
              customerAddress={orderModal.customerAddress}
              onSetCustomerName={orderModal.setCustomerName}
              onSetCustomerPhone={orderModal.setCustomerPhone}
              onSetCustomerAddress={orderModal.setCustomerAddress}
              showDiscount={true}
              combinedSubtotal={orderModal.subtotal}
              combinedTotal={orderModal.total}
              tableDiscount={orderModal.orderDiscount}
              appliedDiscount={orderModal.appliedDiscount}
              onSetTableDiscount={orderModal.setOrderDiscount}
              onApplyDiscount={orderModal.handleApplyDiscount}
              discountButtonLabel={t('orders.discountCommissionShort')}
            />
          </div>
        </div>
      </div>
      {createPortal(
        <DeliveryPlatformModal
          isOpen={deliveryPlatformModalOpen}
          onClose={() => setDeliveryPlatformModalOpen(false)}
          options={orderModal.deliveryPlatforms}
          selectedId={orderModal.selectedDeliveryPlatformId ?? null}
          onApply={(id) => orderModal.handleDeliveryPlatformChange(id)}
        />,
        document.body,
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}

export default memo(DeliveryOrderModal);

