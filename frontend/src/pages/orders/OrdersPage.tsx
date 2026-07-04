import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import NotificationPanel from '../../components/dashboard/NotificationPanel';
import Footer from '../../components/layout/Footer';
import { ArchivedDineInOrderCard } from '../../components/orders/ArchivedDineInOrderCard';
import { ArchivedStatusFilter } from '../../components/orders/ArchivedStatusFilter';
import { PackageIcon, TruckIcon, TrashIcon, UtensilsIcon } from '../../components/icons';
import { PickupOrdersSection } from './PickupOrdersSection';
import { DeliveryOrdersSection } from './DeliveryOrdersSection';
import { useOrdersPage } from './useOrdersPage';
import { DineInOrdersSection } from './DineInOrdersSection';
import { TablesGrid } from './TablesGrid';

const OrderModal = lazy(() => import('../../components/orders/OrderModal'));
const PickupOrderModal = lazy(() => import('../../components/orders/PickupOrderModal'));
const DeliveryOrderModal = lazy(() => import('../../components/orders/DeliveryOrderModal'));

const OrderModalLoading = () => (
  <div className="flex min-h-[200px] items-center justify-center bg-obsidian/70 backdrop-blur-sm">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyber-aqua border-t-transparent" />
  </div>
);

export default function OrdersPage() {
  const { t } = useTranslation();
  const orders = useOrdersPage();
  const {
    halls,
    floors,
    selectedHall,
    tablesWithStatus,
    loading,
    error,
    activeTab,
    setActiveTab,
    dineInSubtab,
    setDineInSubtab,
    selectedFloorId,
    setSelectedFloorId,
    showOrderModal,
    orderTable,
    showPickupModal,
    setShowPickupModal,
    showDeliveryModal,
    setShowDeliveryModal,
    pickupOrderToEdit,
    setPickupOrderToEdit,
    deliveryOrderToEdit,
    setDeliveryOrderToEdit,
    loadingPickupOrders,
    loadingDeliveryOrders,
    loadingArchivedDineIn,
    pickupFilter,
    setPickupFilter,
    pickupArchivedFilter,
    setPickupArchivedFilter,
    deliveryFilter,
    setDeliveryFilter,
    deliverySubTab,
    setDeliverySubTab,
    deliveryArchivedFilter,
    setDeliveryArchivedFilter,
    dropTargetId,
    setDropTargetId,
    dragSourceRef,
    loadPickupOrders,
    loadDeliveryOrders,
    handleHallClick,
    handleMoveTable,
    handleTableClick,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    handlePrintKitchenOrder,
    handlePrintCustomerReceipt,
    handlePrintArchivedDineInReceipt,
    handleClearArchivedDineIn,
    handleClearArchived,
    handleCloseModal,
    pickupOrderCounts,
    deliveryOrderCounts,
    archivedDineInCounts,
    getFilteredPickupOrders,
    getFilteredDeliveryOrders,
    filteredArchivedDineInOrders,
    dineInArchivedFilter,
    setDineInArchivedFilter,
  } = orders;

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('orders.pageTitle')} actions={<NotificationPanel />} />

      <main className="flex-1 p-6 texture-surface">
        <section className="mx-auto max-w-7xl space-y-6">
          {error && (
            <div className="rounded-soft-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] leading-normal font-bold text-red-700 shadow-soft">
              {error}
            </div>
          )}

          <div className="mb-6 flex justify-center">
            <div className="inline-flex gap-2 rounded-soft-xl border-2 border-cyber-aqua/30 bg-white p-1 shadow-soft">
              {(['dine-in', 'pickup', 'delivery'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 rounded-soft-lg px-6 py-3 text-[15px] leading-normal font-bold ${
                    activeTab === tab ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft' : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
                  }`}
                >
                  {tab === 'dine-in' && <UtensilsIcon className="w-5 h-5" />}
                  {tab === 'pickup' && <PackageIcon className="w-5 h-5" />}
                  {tab === 'delivery' && <TruckIcon className="w-5 h-5" />}
                  <span>
                    {tab === 'dine-in' ? t('orders.tabDineIn') : tab === 'pickup' ? t('orders.tabPickup') : t('orders.tabDelivery')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'dine-in' && (
            <DineInOrdersSection
              halls={halls}
              floors={floors}
              selectedHall={selectedHall}
              selectedFloorId={selectedFloorId}
              onSelectFloor={setSelectedFloorId}
              onHallClick={handleHallClick}
              loading={loading}
              dineInSubtab={dineInSubtab}
              onSubtabChange={setDineInSubtab}
              archivedContent={
                <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
                  <div className="mb-6">
                    <h2 className="text-[20px] leading-tight font-semibold text-obsidian mb-2">{t('orders.archivedDineInTitle')}</h2>
                    <p className="text-[14px] leading-relaxed text-obsidian/70">{t('orders.archivedDineInSubtitle')}</p>
                  </div>
                  <ArchivedStatusFilter
                    activeFilter={dineInArchivedFilter}
                    onFilterChange={setDineInArchivedFilter}
                    completedCount={archivedDineInCounts.completed}
                    cancelledCount={archivedDineInCounts.cancelled}
                  />
                  {loadingArchivedDineIn ? (
                    <div className="flex h-32 items-center justify-center text-[15px] leading-normal font-light text-obsidian/60">{t('orders.loadingOrders')}</div>
                  ) : filteredArchivedDineInOrders.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
                      <div className="text-center">
                        <p>{t('orders.archivedDineInEmpty')}</p>
                        <p className="text-[13px] text-obsidian/40 mt-2">{t('orders.archivedDineInEmptyHint')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[18px] leading-tight font-semibold text-obsidian">
                          {t('orders.archivedDineInListTitle', { count: filteredArchivedDineInOrders.length })}
                        </h3>
                        <button
                          type="button"
                          onClick={handleClearArchivedDineIn}
                          className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-[14px] leading-normal font-bold shadow-soft"
                        >
                          <TrashIcon className="w-4 h-4" />
                          {t('orders.deleteAll')}
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredArchivedDineInOrders.map((order) => (
                          <ArchivedDineInOrderCard key={order.id} order={order as any} onPrintCustomer={handlePrintArchivedDineInReceipt} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              }
            >
              {selectedHall && (
                <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft mt-6">
                  <h2 className="text-[20px] leading-tight font-semibold text-obsidian flex items-center gap-2 flex-wrap mb-4">
                    <span>{t('orders.tablesTitle')}</span>
                    {tablesWithStatus.some((tb) => tb.orderStatus !== 'none') && (
                      <span className="text-[13px] font-normal text-obsidian/60">{t('orders.tablesDragHint')}</span>
                    )}
                    {selectedHall.floor && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[15px] font-medium tabular-nums"
                        style={{
                          backgroundColor: `${floors.find((f) => f.id === selectedHall.floor?.id) ? '#06b6d420' : '#64748b20'}`,
                          color: floors.find((f) => f.id === selectedHall.floor?.id) ? '#06b6d4' : '#64748b',
                        }}
                      >
                        {selectedHall.floor.number} · {selectedHall.number}
                      </span>
                    )}
                    <span className="text-obsidian/80 font-normal">— {selectedHall.name}</span>
                  </h2>
                  <TablesGrid
                    tables={tablesWithStatus}
                    loading={loading}
                    dropTargetId={dropTargetId}
                    moveInProgress={orders.moveInProgress}
                    dragSourceRef={dragSourceRef}
                    onTableClick={handleTableClick}
                    onMoveTable={handleMoveTable}
                    onDropTargetChange={setDropTargetId}
                  />
                </div>
              )}
            </DineInOrdersSection>
          )}

          {activeTab === 'pickup' && (
            <PickupOrdersSection
              pickupFilter={pickupFilter}
              onFilterChange={setPickupFilter}
              archivedFilter={pickupArchivedFilter}
              onArchivedFilterChange={setPickupArchivedFilter}
              pendingCount={pickupOrderCounts.pending}
              archivedCount={pickupOrderCounts.archived}
              completedCount={pickupOrderCounts.completed}
              cancelledCount={pickupOrderCounts.cancelled}
              orders={getFilteredPickupOrders}
              loading={loadingPickupOrders}
              onNewOrder={() => { setPickupOrderToEdit(null); setShowPickupModal(true); }}
              onComplete={handleCompleteOrder}
              onCancel={(id) => handleCancelOrder(id, 'pickup')}
              onEdit={handleEditOrder}
              onPrintKitchen={handlePrintKitchenOrder}
              onPrintCustomer={handlePrintCustomerReceipt}
              onClearArchived={handleClearArchived}
            />
          )}

          {activeTab === 'delivery' && (
            <DeliveryOrdersSection
              deliverySubTab={deliverySubTab}
              onDeliverySubTabChange={setDeliverySubTab}
              deliveryFilter={deliveryFilter}
              onFilterChange={setDeliveryFilter}
              archivedFilter={deliveryArchivedFilter}
              onArchivedFilterChange={setDeliveryArchivedFilter}
              pendingCount={deliveryOrderCounts.pending}
              archivedCount={deliveryOrderCounts.archived}
              completedCount={deliveryOrderCounts.completed}
              cancelledCount={deliveryOrderCounts.cancelled}
              orders={getFilteredDeliveryOrders}
              loading={loadingDeliveryOrders}
              onNewOrder={() => { setDeliveryOrderToEdit(null); setShowDeliveryModal(true); }}
              onComplete={handleCompleteOrder}
              onCancel={(id) => handleCancelOrder(id, 'delivery')}
              onEdit={handleEditOrder}
              onPrintKitchen={handlePrintKitchenOrder}
              onPrintCustomer={handlePrintCustomerReceipt}
              onClearArchived={handleClearArchived}
            />
          )}
        </section>
      </main>

      <Footer />

      {showOrderModal && orderTable && selectedHall && (
        <Suspense fallback={<OrderModalLoading />}>
          <OrderModal hall={selectedHall} table={orderTable} onClose={handleCloseModal} />
        </Suspense>
      )}

      {showPickupModal && (
        <Suspense fallback={<OrderModalLoading />}>
          <PickupOrderModal
            orderToEdit={pickupOrderToEdit}
            onClose={() => {
              setShowPickupModal(false);
              setPickupOrderToEdit(null);
              if (activeTab === 'pickup') void loadPickupOrders();
            }}
          />
        </Suspense>
      )}

      {showDeliveryModal && (
        <Suspense fallback={<OrderModalLoading />}>
          <DeliveryOrderModal
            orderToEdit={deliveryOrderToEdit}
            onClose={() => {
              setShowDeliveryModal(false);
              setDeliveryOrderToEdit(null);
              if (activeTab === 'delivery') void loadDeliveryOrders();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
