import { useTranslation } from 'react-i18next';
import { TruckIcon, TrashIcon } from '../../components/icons';
import { OrderCard } from '../../components/orders/OrderCard';
import { OrderStatusTabs } from '../../components/orders/OrderStatusTabs';
import { ArchivedStatusFilter, type ArchivedFilterValue } from '../../components/orders/ArchivedStatusFilter';
import type { ExistingOrder } from '../../hooks/useOrderModal';
import { DeliveryPlatformsSection } from './DeliveryPlatformsSection';

interface DeliveryOrdersSectionProps {
  deliverySubTab: 'orders' | 'platforms';
  onDeliverySubTabChange: (t: 'orders' | 'platforms') => void;
  deliveryFilter: 'pending' | 'archived';
  onFilterChange: (f: 'pending' | 'archived') => void;
  archivedFilter?: ArchivedFilterValue;
  onArchivedFilterChange?: (f: ArchivedFilterValue) => void;
  pendingCount: number;
  archivedCount: number;
  completedCount?: number;
  cancelledCount?: number;
  orders: ExistingOrder[];
  loading: boolean;
  onNewOrder: () => void;
  onComplete: (orderId: number) => void;
  onCancel: (orderId: number) => void;
  onEdit: (order: ExistingOrder) => void;
  onPrintKitchen: (order: ExistingOrder) => void;
  onPrintCustomer: (order: ExistingOrder) => void;
  onClearArchived: () => void;
}

export function DeliveryOrdersSection({
  deliverySubTab,
  onDeliverySubTabChange,
  deliveryFilter,
  onFilterChange,
  archivedFilter = 'all',
  onArchivedFilterChange,
  pendingCount,
  archivedCount,
  completedCount = 0,
  cancelledCount = 0,
  orders,
  loading,
  onNewOrder,
  onComplete,
  onCancel,
  onEdit,
  onPrintKitchen,
  onPrintCustomer,
  onClearArchived,
}: DeliveryOrdersSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
      <div className="mb-6">
        <h2 className="text-[20px] leading-tight font-semibold text-obsidian mb-2">{t('orders.deliveryTitle')}</h2>
        <p className="text-[14px] leading-relaxed text-obsidian/70">{t('orders.deliverySubtitle')}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDeliverySubTabChange('orders')}
          className={`rounded-soft-lg px-4 py-2 text-[14px] font-bold shadow-soft transition-colors ${
            deliverySubTab === 'orders'
              ? 'bg-cyber-aqua text-white'
              : 'border border-black/10 bg-white text-obsidian/80 hover:bg-black/5'
          }`}
        >
          {t('orders.subtabOrders')}
        </button>
        <button
          type="button"
          onClick={() => onDeliverySubTabChange('platforms')}
          className={`rounded-soft-lg px-4 py-2 text-[14px] font-bold shadow-soft transition-colors ${
            deliverySubTab === 'platforms'
              ? 'bg-cyber-aqua text-white'
              : 'border border-black/10 bg-white text-obsidian/80 hover:bg-black/5'
          }`}
        >
          {t('orders.subtabPlatforms')}
        </button>
      </div>

      {deliverySubTab === 'platforms' ? (
        <DeliveryPlatformsSection />
      ) : (
        <>
      <OrderStatusTabs activeFilter={deliveryFilter} onFilterChange={onFilterChange} pendingCount={pendingCount} archivedCount={archivedCount} />
      {deliveryFilter === 'archived' && onArchivedFilterChange && (
        <ArchivedStatusFilter
          activeFilter={archivedFilter}
          onFilterChange={onArchivedFilterChange}
          completedCount={completedCount}
          cancelledCount={cancelledCount}
        />
      )}
      {deliveryFilter === 'pending' && (
        <button
          type="button"
          onClick={onNewOrder}
          className="flex items-center justify-center gap-3 rounded-soft-xl border-2 border-cyber-aqua bg-cyber-aqua/10 p-8 shadow-soft hover:bg-cyber-aqua/20 w-full mb-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-soft-lg bg-cyber-aqua text-white shadow-soft">
            <TruckIcon className="w-10 h-10" />
          </div>
          <div className="text-right">
            <h3 className="text-[20px] leading-tight font-bold text-obsidian">{t('orders.newDeliveryCta')}</h3>
            <p className="text-[14px] leading-relaxed text-obsidian/70">{t('orders.newDeliveryHint')}</p>
          </div>
        </button>
      )}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-[15px] leading-normal font-light text-obsidian/60">{t('orders.loadingOrders')}</div>
      ) : orders.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {deliveryFilter === 'pending' ? t('orders.emptyNoPending') : t('orders.emptyNoArchived')}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] leading-tight font-semibold text-obsidian">
              {deliveryFilter === 'pending'
                ? t('orders.listTitlePending', { count: orders.length })
                : t('orders.listTitleArchived', { count: orders.length })}
            </h3>
            {deliveryFilter === 'archived' && orders.length > 0 && (
              <button type="button" onClick={onClearArchived} className="flex items-center justify-center gap-1.5 rounded-soft-lg bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-[14px] leading-normal font-bold shadow-soft">
                <TrashIcon className="w-4 h-4" />
                {t('orders.deleteAll')}
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} orderType="delivery" onComplete={onComplete} onCancel={onCancel} onEdit={onEdit} onPrintKitchen={onPrintKitchen} onPrintCustomer={onPrintCustomer} />
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
