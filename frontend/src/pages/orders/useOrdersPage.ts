import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { getServerUrl, Hall, TableEntity, fetchJson, Kitchen } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/ui/Toast';
import { showConfirm } from '../../components/ui/ConfirmDialog';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { useHallStore } from '../../../stores/hallStore';
import { createOrdersPagePrintHandlers } from './useOrdersPagePrint';
import { useOrdersPageData } from './useOrdersPageData';
import { createOrdersPageHandlers } from './useOrdersPageHandlers';

export function useOrdersPage() {
  const { user } = useAuth();
  const { subscribeToOrders } = useOrderSocket();
  const { halls, floors, selectedHall, tables, loading, error, selectHall, loadTablesForHall } = useOrders();
  const activeHallId = useHallStore((s) => s.activeHallId);
  const setActiveHallId = useHallStore((s) => s.setActiveHallId);
  const data = useOrdersPageData();

  const [activeTab, setActiveTab] = useState<'dine-in' | 'pickup' | 'delivery'>('dine-in');
  const [dineInSubtab, setDineInSubtab] = useState<'active' | 'archived'>('active');
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderTable, setOrderTable] = useState<TableEntity | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [pickupOrderToEdit, setPickupOrderToEdit] = useState<ExistingOrder | null>(null);
  const [deliveryOrderToEdit, setDeliveryOrderToEdit] = useState<ExistingOrder | null>(null);
  const [pickupFilter, setPickupFilter] = useState<'pending' | 'archived'>('pending');
  const [deliveryFilter, setDeliveryFilter] = useState<'pending' | 'archived'>('pending');
  const [deliverySubTab, setDeliverySubTab] = useState<'orders' | 'platforms'>('orders');
  const [pickupArchivedFilter, setPickupArchivedFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [deliveryArchivedFilter, setDeliveryArchivedFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [dineInArchivedFilter, setDineInArchivedFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [moveInProgress, setMoveInProgress] = useState(false);
  const dragSourceRef = useRef<number | null>(null);

  const printHandlers = useMemo(
    () => createOrdersPagePrintHandlers(user, kitchens),
    [user, kitchens]
  );

  const tablesWithStatus = useMemo(
    () =>
      tables.map((t) => ({
        ...t,
        orderStatus: (t.orderStatus === 'pending' ? 'pending' : t.orderStatus === 'printed' ? 'printed' : 'none') as 'pending' | 'printed' | 'none',
      })),
    [tables]
  );

  const handleHallClick = useCallback(
    (hall: Hall) => {
      selectHall(hall);
      void loadTablesForHall(hall.id);
    },
    [selectHall, loadTablesForHall]
  );

  const { loadPickupOrders, loadDeliveryOrders, loadArchivedDineInOrders, pickupOrderCounts, deliveryOrderCounts, archivedDineInCounts, getFilteredPickupOrders: getFilteredPickupOrdersFn, getFilteredDeliveryOrders: getFilteredDeliveryOrdersFn, getFilteredArchivedDineInOrders, allPickupOrders, allDeliveryOrders, archivedDineInOrders, loadingPickupOrders, loadingDeliveryOrders, loadingArchivedDineIn } = data;
  const getFilteredPickupOrders = getFilteredPickupOrdersFn(pickupFilter, pickupArchivedFilter);
  const getFilteredDeliveryOrders = getFilteredDeliveryOrdersFn(deliveryFilter, deliveryArchivedFilter);
  const filteredArchivedDineInOrders = getFilteredArchivedDineInOrders(dineInArchivedFilter);

  const handleMoveTable = useCallback(
    async (sourceTableId: number, targetTableId: number) => {
      if (sourceTableId === targetTableId) return;
      setMoveInProgress(true);
      try {
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ movedCount: number }>(`${serverUrl}/orders/dine-in/move-table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_table_id: sourceTableId, target_table_id: targetTableId }),
        });
        if (result?.movedCount && result.movedCount > 0) {
          showToast(`تم نقل ${result.movedCount} طلب إلى الطاولة الجديدة`, 'success');
          window.dispatchEvent(new CustomEvent('refresh-tables'));
          if (selectedHall) void loadTablesForHall(selectedHall.id);
        }
      } catch (err: any) {
        showToast(err?.message || 'فشل نقل الطاولة', 'error');
      } finally {
        setMoveInProgress(false);
        setDropTargetId(null);
      }
    },
    [selectedHall, loadTablesForHall]
  );

  const handleCompleteOrder = useCallback(
    async (orderId: number) => {
      const orderType = activeTab === 'pickup' ? 'pickup' : 'delivery';
      try {
        const serverUrl = getServerUrl();
        const endpoint =
          orderType === 'pickup'
            ? `${serverUrl}/orders/pickup/${orderId}/status`
            : `${serverUrl}/orders/delivery/${orderId}/status`;
        await fetchJson(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        });
        showToast('تم تحديث حالة الطلب بنجاح', 'success');
        if (orderType === 'pickup') void loadPickupOrders();
        else void loadDeliveryOrders();
      } catch {
        showToast('حدث خطأ أثناء تحديث حالة الطلب', 'error');
      }
    },
    [activeTab, loadPickupOrders, loadDeliveryOrders]
  );

  const handleCancelOrder = useCallback(
    async (orderId: number, orderType: 'dine-in' | 'pickup' | 'delivery') => {
      const confirmed = await showConfirm({
        title: 'إلغاء الطلب',
        message: 'هل أنت متأكد من إلغاء هذا الطلب؟',
        confirmText: 'إلغاء الطلب',
        cancelText: 'تراجع',
        confirmColor: 'danger',
      });
      if (!confirmed) return;
      try {
        const serverUrl = getServerUrl();
        const endpoint =
          orderType === 'dine-in'
            ? `${serverUrl}/orders/dine-in/${orderId}/status`
            : orderType === 'pickup'
            ? `${serverUrl}/orders/pickup/${orderId}/status`
            : `${serverUrl}/orders/delivery/${orderId}/status`;
        await fetchJson(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        });
        showToast('تم إلغاء الطلب', 'success');
        if (orderType === 'dine-in') {
          window.dispatchEvent(new CustomEvent('refresh-tables'));
          if (selectedHall) void loadTablesForHall(selectedHall.id);
        } else if (orderType === 'pickup') void loadPickupOrders();
        else void loadDeliveryOrders();
      } catch {
        showToast('حدث خطأ أثناء إلغاء الطلب', 'error');
      }
    },
    [selectedHall, loadTablesForHall, loadPickupOrders, loadDeliveryOrders]
  );

  const handleEditOrder = useCallback((order: ExistingOrder) => {
    if (activeTab === 'pickup') {
      setPickupOrderToEdit(order);
      setShowPickupModal(true);
    } else {
      setDeliveryOrderToEdit(order);
      setShowDeliveryModal(true);
    }
  }, [activeTab]);

  const handlePrintKitchenOrder = useCallback(
    (order: ExistingOrder) => {
      const orderType = activeTab === 'pickup' ? 'pickup' : 'delivery';
      void printHandlers.printKitchenOrder(order, orderType);
    },
    [activeTab, printHandlers]
  );

  const handlePrintCustomerReceipt = useCallback(
    (order: ExistingOrder) => {
      const orderType = activeTab === 'pickup' ? 'pickup' : 'delivery';
      void printHandlers.printCustomerReceipt(order, orderType);
    },
    [activeTab, printHandlers]
  );

  const handlePrintArchivedDineInReceipt = useCallback(
    (order: ExistingOrder) => void printHandlers.printArchivedDineInReceipt(order),
    [printHandlers]
  );

  const handleOrderSubmitted = useCallback(() => {
    if (selectedHall) void loadTablesForHall(selectedHall.id);
  }, [selectedHall, loadTablesForHall]);

  const tableHandlers = useMemo(
    () =>
      createOrdersPageHandlers(
        user,
        activeTab,
        {
          setOrderTable,
          setShowOrderModal,
          setPickupOrderToEdit,
          setShowPickupModal,
          setDeliveryOrderToEdit,
          setShowDeliveryModal,
        },
        { handleOrderSubmitted, loadPickupOrders, loadDeliveryOrders, loadArchivedDineInOrders },
        { archivedDineInOrders, allPickupOrders, allDeliveryOrders }
      ),
    [user, activeTab, archivedDineInOrders, allPickupOrders, allDeliveryOrders, handleOrderSubmitted, loadPickupOrders, loadDeliveryOrders, loadArchivedDineInOrders]
  );

  const { handleTableClick, handleCloseModal, handleClearArchivedDineIn, handleClearArchived } = tableHandlers;

  useEffect(() => {
    const loadKitchens = async () => {
      try {
        const kitchensData = await fetchJson<Kitchen[]>(`${getServerUrl()}/kitchens`);
        setKitchens(kitchensData);
      } catch {
        /* ignore */
      }
    };
    void loadKitchens();
  }, []);

  useEffect(() => {
    if (selectedFloorId == null || activeHallId == null) return;
    const activeHall = halls.find((h) => h.id === activeHallId);
    if (activeHall && activeHall.floor_id !== selectedFloorId) setActiveHallId(null);
  }, [selectedFloorId, halls, activeHallId, setActiveHallId]);

  useEffect(() => {
    if (activeTab === 'pickup') void loadPickupOrders();
    else if (activeTab === 'delivery') void loadDeliveryOrders();
    else if (activeTab === 'dine-in' && dineInSubtab === 'archived') void loadArchivedDineInOrders();
  }, [activeTab, dineInSubtab]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.orderType === 'pickup' && ['created', 'updated'].includes(event.eventType) && activeTab === 'pickup') void loadPickupOrders();
        else if (event.orderType === 'delivery' && ['created', 'updated'].includes(event.eventType) && activeTab === 'delivery') void loadDeliveryOrders();
      },
      ['pickup', 'delivery']
    );
    return unsubscribe;
  }, [subscribeToOrders, activeTab]);

  return {
    user,
    halls,
    floors,
    selectedHall,
    tables,
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
    setShowOrderModal,
    orderTable,
    setOrderTable,
    showPickupModal,
    setShowPickupModal,
    showDeliveryModal,
    setShowDeliveryModal,
    pickupOrderToEdit,
    setPickupOrderToEdit,
    deliveryOrderToEdit,
    setDeliveryOrderToEdit,
    allPickupOrders,
    allDeliveryOrders,
    archivedDineInOrders,
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
    dineInArchivedFilter,
    setDineInArchivedFilter,
    kitchens,
    dropTargetId,
    setDropTargetId,
    moveInProgress,
    dragSourceRef,
    selectHall,
    loadTablesForHall,
    loadPickupOrders,
    loadDeliveryOrders,
    loadArchivedDineInOrders,
    handleHallClick,
    handleMoveTable,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    handlePrintKitchenOrder,
    handlePrintCustomerReceipt,
    handlePrintArchivedDineInReceipt,
    handleClearArchivedDineIn,
    handleClearArchived,
    handleOrderSubmitted,
    handleTableClick,
    handleCloseModal,
    pickupOrderCounts,
    deliveryOrderCounts,
    getFilteredPickupOrders,
    getFilteredDeliveryOrders,
    filteredArchivedDineInOrders,
    archivedDineInCounts,
    subscribeToOrders,
    activeHallId,
    setActiveHallId,
  };
}
