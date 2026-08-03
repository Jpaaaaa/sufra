import { useState, useMemo, useCallback } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import type { Item } from './useItems';
import type { ShelfItem } from './useShelves';
import { showToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useOffers } from './useOffers';
import { useOrderModalData } from './useOrderModalData';
import { createOrderModalPrintHandlers } from './useOrderModalPrint';
import { createOrderModalHandlers } from './useOrderModalHandlers';
import {
  type AddItemExtras,
  buildCartItem,
  cartSubtotal,
  getCartLineKey,
  updateCartLine,
} from './cart-item-utils';

export type { Category, ExistingOrder, CartItem } from './useOrderModalTypes';
import type { CartItem, ExistingOrder } from './useOrderModalTypes';
import type { TableEntity } from '../utils';

export function useOrderModal(table: TableEntity) {
  const { user } = useAuth();
  const offers = useOffers();

  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [editingOrder, setEditingOrder] = useState<ExistingOrder | null>(null);
  const [editingOrderType, setEditingOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('dine-in');
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [editingCustomerPhone, setEditingCustomerPhone] = useState('');
  const [editingCustomerLocation, setEditingCustomerLocation] = useState('');
  const [editingNote, setEditingNote] = useState('');
  const [animatedOrderId, setAnimatedOrderId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [note, setNote] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [showMoveToTableModal, setShowMoveToTableModal] = useState(false);

  const data = useOrderModalData(table, selectedCategory, searchQuery, offers);
  const {
    items,
    categories,
    kitchens,
    loadingItems,
    loadingOrders,
    existingOrders,
    setExistingOrders,
    filteredItems,
    appliedDiscount,
    setAppliedDiscount,
    tableDiscount,
    setTableDiscount,
  } = data;

  const subtotal = useMemo(() => cartSubtotal(selectedItems), [selectedItems]);
  const total = subtotal;
  const tableSubtotal = useMemo(() => {
    let t = 0;
    for (const order of existingOrders) {
      for (const item of order.items) {
        t += (item.price || 0) * (item.quantity || 0);
      }
    }
    return t;
  }, [existingOrders]);
  const tableTotal = useMemo(
    () => Math.max(0, tableSubtotal - (appliedDiscount ? appliedDiscount.amount : tableDiscount)),
    [tableSubtotal, tableDiscount, appliedDiscount]
  );

  const printHandlers = useMemo(
    () =>
      createOrderModalPrintHandlers(
        table,
        existingOrders,
        kitchens,
        setExistingOrders,
        appliedDiscount,
        tableTotal,
        user ?? undefined
      ),
    [table, existingOrders, kitchens, setExistingOrders, appliedDiscount, tableTotal, user]
  );

  const orderHandlers = useMemo(
    () =>
      createOrderModalHandlers(table, {
        selectedItems,
        note,
        editingNote,
        existingOrders,
        appliedDiscount,
        tableSubtotal,
        subtotal,
        items,
        editingOrder,
        user: user ?? undefined,
        setSelectedItems,
        setExistingOrders,
        setEditingOrder,
        setEditingOrderType,
        setEditingCustomerName,
        setEditingCustomerPhone,
        setEditingCustomerLocation,
        setEditingNote,
        setNote,
        setAppliedDiscount,
        setTableDiscount,
        setAnimatedOrderId,
        setOrdersExpanded,
      }),
    [
      table,
      selectedItems,
      setSelectedItems,
      note,
      editingNote,
      existingOrders,
      appliedDiscount,
      tableSubtotal,
      subtotal,
      items,
      editingOrder,
      user,
      setExistingOrders,
    ]
  );

  const addItemToOrder = useCallback((item: Item, extras?: AddItemExtras) => {
    const s = extras?.shelfItem;
    setSelectedItems((prev) => {
      const next = buildCartItem(item, extras ?? {}, 'dine-in');
      const key = getCartLineKey(next.item.id, next.shelfItem?.id, next.selectedOptions);
      const existing = prev.find(
        (si) => getCartLineKey(si.item.id, si.shelfItem?.id, si.selectedOptions) === key,
      );
      if (existing) {
        if (s && existing.quantity + 1 > s.quantity) {
          showToast(`الكمية المتوفرة: ${s.quantity}`, 'error');
          return prev;
        }
        return prev.map((si) =>
          si.cartLineId === existing.cartLineId ? { ...si, quantity: si.quantity + 1 } : si,
        );
      }
      if (s && s.quantity === 0) {
        showToast('نفذت الكمية', 'error');
        return prev;
      }
      return [...prev, next];
    });
    if (ordersExpanded && existingOrders.length > 0) setOrdersExpanded(false);
  }, [ordersExpanded, existingOrders.length]);

  const updateCartLineOptions = useCallback(
    (cartLineId: string, selectedOptions: import('../lib/item-options').SelectedItemOptions, linePrice: number) => {
      setSelectedItems((prev) =>
        prev.map((si) =>
          si.cartLineId === cartLineId ? { ...si, selectedOptions, linePrice } : si,
        ),
      );
    },
    [],
  );

  const addShelfItemByBarcode = useCallback(
    async (barcode: string) => {
      try {
        const shelfItem = await fetchJson<ShelfItem>(`${getServerUrl()}/shelves/barcode/${barcode}`);
        if (shelfItem.quantity === 0) {
          showToast('نفذت الكمية', 'error');
          return;
        }
        const existing = selectedItems.find((si) => si.shelfItem?.barcode === barcode);
        if (existing) {
          if (existing.quantity + 1 > shelfItem.quantity) {
            showToast(`الكمية المتوفرة: ${shelfItem.quantity}`, 'error');
            return;
          }
          setSelectedItems((prev) =>
            prev.map((si) =>
              si.shelfItem?.barcode === barcode ? { ...si, quantity: si.quantity + 1 } : si
            )
          );
          showToast(`تم زيادة الكمية: ${shelfItem.name} (${existing.quantity + 1})`, 'success');
          return;
        }
        const virtualItem: Item = {
          id: shelfItem.id + 1000000,
          name: shelfItem.name,
          price: shelfItem.price,
          categoryId: null,
          kitchen_id: null,
        };
        addItemToOrder(virtualItem, { shelfItem });
        showToast(`تم إضافة ${shelfItem.name}`, 'success');
      } catch {
        showToast('لم يتم العثور على المنتج بهذا الباركود', 'error');
      }
    },
    [addItemToOrder, selectedItems]
  );

  const updateItemOrderType = useCallback((cartLineId: string, newOrderType: 'dine-in' | 'pickup') => {
    setSelectedItems((prev) => updateCartLine(prev, cartLineId, { order_type: newOrderType }));
  }, []);

  const removeItemFromOrder = useCallback((cartLineId: string) => {
    setSelectedItems((prev) => prev.filter((si) => si.cartLineId !== cartLineId));
  }, []);

  const updateQuantity = useCallback((cartLineId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems((prev) => prev.filter((si) => si.cartLineId !== cartLineId));
    } else {
      setSelectedItems((prev) => {
        const line = prev.find((si) => si.cartLineId === cartLineId);
        if (line?.shelfItem && quantity > line.shelfItem.quantity) {
          showToast(`الكمية المتوفرة: ${line.shelfItem.quantity}`, 'error');
          return prev;
        }
        return updateCartLine(prev, cartLineId, { quantity });
      });
    }
  }, []);

  const handleApplyDiscount = useCallback(
    () => orderHandlers.handleApplyDiscount(tableDiscount),
    [orderHandlers, tableDiscount]
  );

  const toggleOrderSelect = useCallback((orderId: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleMoveOrders = useCallback(
    async (targetTableId: number) => {
      const ids = Array.from(selectedOrderIds);
      if (ids.length === 0) return;
      setShowMoveToTableModal(false);
      setSelectedOrderIds(new Set());
      try {
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ movedCount: number }>(
          `${serverUrl}/orders/dine-in/move-orders`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: ids, target_table_id: targetTableId }),
          }
        );
        if (result?.movedCount && result.movedCount > 0) {
          showToast(`تم نقل ${result.movedCount} طلب بنجاح`, 'success');
          setExistingOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
          window.dispatchEvent(new CustomEvent('refresh-tables'));
        }
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'فشل نقل الطلبات', 'error');
      }
    },
    [selectedOrderIds, setExistingOrders]
  );

  return {
    items: filteredItems,
    allMenuItems: items,
    categories,
    kitchens,
    existingOrders,
    selectedItems,
    loadingItems,
    loadingOrders,
    selectedCategory,
    searchQuery,
    ordersExpanded,
    editingOrder,
    editingOrderType,
    animatedOrderId,
    isDelivery: false,
    customerName,
    customerPhone,
    customerLocation,
    editingCustomerName,
    editingCustomerPhone,
    editingCustomerLocation,
    note,
    editingNote,
    setNote,
    setEditingNote,
    subtotal,
    total,
    tableSubtotal,
    tableTotal,
    tableDiscount,
    appliedDiscount,
    setSelectedCategory,
    setSearchQuery,
    setOrdersExpanded,
    setCustomerName,
    setCustomerPhone,
    setCustomerLocation,
    setEditingCustomerName,
    setEditingCustomerPhone,
    setEditingCustomerLocation,
    setTableDiscount,
    handleApplyDiscount,
    addItemToOrder,
    addShelfItemByBarcode,
    updateItemOrderType,
    removeItemFromOrder,
    updateQuantity,
    updateCartLineOptions,
    clearCart: () => {
      setSelectedItems([]);
      setNote('');
    },
    handleSubmitOrder: orderHandlers.handleSubmitOrder,
    handlePrintOrder: printHandlers.handlePrintOrder,
    handlePrintAllKitchen: printHandlers.handlePrintAllKitchen,
    handlePrintReceipt: printHandlers.handlePrintReceipt,
    handleClearTable: orderHandlers.handleClearTable,
    handleEditOrder: orderHandlers.handleEditOrder,
    handleCancelEdit: orderHandlers.handleCancelEdit,
    handleSaveEditedOrder: orderHandlers.handleSaveEditedOrder,
    handleUpdateOrderType: orderHandlers.handleUpdateOrderType,
    handleCancelOrder: orderHandlers.handleCancelOrder,
    selectedOrderIds,
    toggleOrderSelect,
    showMoveToTableModal,
    setShowMoveToTableModal,
    handleMoveOrders,
  };
}
