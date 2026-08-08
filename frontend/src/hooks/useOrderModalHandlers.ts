import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { showConfirm } from '../components/ui/ConfirmDialog';
import type { ExistingOrder, CartItem } from './useOrderModalTypes';
import type { Item } from './useItems';
import type { TableEntity } from '../utils';
import { parseDiscountFromOrder, getOrdersWithDiscount } from './useOrderModalDiscountUtils';
import { createClearTableHandler } from './useOrderModalClearTable';
import { mapCartItemToOrderPayload } from './cart-item-utils';
import { orderItemsToCartLines } from '../utils/order-trays';
import { withOrderCreator } from '../utils/order-payload';

interface UserRole {
  id?: number;
  role?: string;
  require_captain_approval?: boolean;
}

export function createOrderModalHandlers(
  table: TableEntity,
  deps: {
    selectedItems: CartItem[];
    note: string;
    editingNote: string;
    existingOrders: ExistingOrder[];
    appliedDiscount: { percent: number; amount: number } | null;
    tableSubtotal: number;
    subtotal: number;
    items: Item[];
    editingOrder: ExistingOrder | null;
    user: UserRole | undefined;
    setSelectedItems: (v: CartItem[] | ((p: CartItem[]) => CartItem[])) => void;
    setExistingOrders: (v: ExistingOrder[]) => void;
    setEditingOrder: (v: ExistingOrder | null) => void;
    setEditingOrderType: (v: 'dine-in' | 'pickup' | 'delivery') => void;
    setEditingCustomerName: (v: string) => void;
    setEditingCustomerPhone: (v: string) => void;
    setEditingCustomerLocation: (v: string) => void;
    setEditingNote: (v: string) => void;
    setNote: (v: string) => void;
    setAppliedDiscount: (v: { percent: number; amount: number } | null) => void;
    setTableDiscount: (v: number) => void;
    setAnimatedOrderId: (v: number | null) => void;
    setOrdersExpanded: (v: boolean) => void;
  }
) {
  const {
    selectedItems,
    note,
    editingNote,
    existingOrders,
    appliedDiscount,
    tableSubtotal,
    subtotal,
    items,
    editingOrder,
    user,
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
  } = deps;

  const handleApplyDiscount = async (tableDiscountVal: number) => {
    const combinedSubtotal = tableSubtotal + subtotal;
    if (combinedSubtotal === 0) return;
    const discountToApply = tableDiscountVal === 0 ? null : {
      percent: Math.round((tableDiscountVal / combinedSubtotal) * 100 * 10) / 10,
      amount: Math.round(tableDiscountVal),
    };
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/table/${table.id}/global-discount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalDiscount: discountToApply }),
      });
      setAppliedDiscount(discountToApply);
      const ordersData = await fetchJson<any[]>(`${serverUrl}/orders/dine-in/table/${table.id}`);
      const updated = ordersData.filter((o: any) => o.status === 'pending' || o.status === 'printed');
      updated.forEach((o: any) => {
        if (o.globalDiscount && typeof o.globalDiscount === 'string') {
          try {
            o.globalDiscount = JSON.parse(o.globalDiscount);
          } catch {
            o.globalDiscount = null;
          }
        }
      });
      setExistingOrders(updated);
      showToast(discountToApply ? 'تم تطبيق الخصم بنجاح' : 'تم إلغاء الخصم بنجاح', 'success');
    } catch (e: any) {
      showToast('حدث خطأ أثناء تطبيق الخصم: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  };

  const handleSubmitOrder = async () => {
    if (selectedItems.length === 0) return;
    if (selectedItems.some((si) => si.lineKind === 'tray' && !(si.children?.length))) {
      showToast('المجموعة يجب أن تحتوي على منتج واحد على الأقل', 'error');
      return;
    }
    if (!table.hall_id) {
      showToast('خطأ: الطاولة لا تحتوي على معرف الصالة', 'error');
      return;
    }
    try {
      const payload = withOrderCreator(
        {
          table_id: table.id,
          hall_id: table.hall_id,
          items: selectedItems.map(mapCartItemToOrderPayload),
          note: note?.trim() || null,
        },
        user,
      );

      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/dine-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (appliedDiscount) {
        await fetchJson(`${serverUrl}/orders/table/${table.id}/global-discount`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalDiscount: appliedDiscount }),
        });
      }

      await new Promise((r) => setTimeout(r, 100));
      const previousIds = new Set(existingOrders.map((o) => o.id));
      const ordersData = await fetchJson<any[]>(`${serverUrl}/orders/dine-in/table/${table.id}`);
      const newOrders = ordersData.filter((o: any) => o.status === 'pending' || o.status === 'printed');
      setExistingOrders(newOrders);

      const withDiscount = getOrdersWithDiscount(newOrders);
      if (withDiscount.length > 0) {
        const d = parseDiscountFromOrder(withDiscount[0]);
        if (d) {
          setAppliedDiscount({ percent: d.percent, amount: d.amount });
          setTableDiscount(d.amount);
        }
      }

      const newlyCreated = newOrders.filter((o) => !previousIds.has(o.id));
      if (newlyCreated.length > 0) {
        setAnimatedOrderId(newlyCreated[0].id);
        setTimeout(() => setAnimatedOrderId(null), 2000);
        setOrdersExpanded(true);
      }
      setSelectedItems([]);
      setNote('');
      showToast(`تم إنشاء الطلب بنجاح (${selectedItems.length} صنف)`, 'success');
    } catch (e: any) {
      showToast('حدث خطأ أثناء إنشاء الطلب: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  };

  const handleClearTable = createClearTableHandler(
    existingOrders,
    user,
    setExistingOrders,
    setSelectedItems
  );

  const handleEditOrder = (order: ExistingOrder) => {
    const orderItems: CartItem[] = orderItemsToCartLines(order.items ?? [], items);
    setSelectedItems(orderItems);
    setEditingOrder(order);
    setEditingOrderType(order.order_type);
    const discount = parseDiscountFromOrder(order);
    if (discount) {
      setAppliedDiscount(discount);
      setTableDiscount(discount.amount);
    } else {
      setAppliedDiscount(null);
      setTableDiscount(0);
    }
    if (order.order_type === 'delivery') {
      const o = order as any;
      setEditingCustomerName(o.customer_name || '');
      setEditingCustomerPhone(o.customer_phone || '');
      setEditingCustomerLocation(o.customer_location || '');
    }
    setEditingNote(order.note || '');
    setNote(order.note || '');
    setOrdersExpanded(false);
  };

  const handleCancelEdit = () => {
    setSelectedItems([]);
    setEditingOrder(null);
    setEditingOrderType('dine-in');
    setEditingCustomerName('');
    setEditingCustomerPhone('');
    setEditingCustomerLocation('');
    setEditingNote('');
    setNote('');
    setAppliedDiscount(null);
    setTableDiscount(0);
  };

  const handleSaveEditedOrder = async () => {
    if (selectedItems.length === 0) {
      showToast('يجب إضافة صنف واحد على الأقل', 'error');
      return;
    }
    if (selectedItems.some((si) => si.lineKind === 'tray' && !(si.children?.length))) {
      showToast('المجموعة يجب أن تحتوي على منتج واحد على الأقل', 'error');
      return;
    }
    if (!editingOrder || !table.hall_id) return;

    try {
      const noteToSave = (editingNote?.trim() || note?.trim() || '').trim();
      const payload: any = {
        items: selectedItems.map(mapCartItemToOrderPayload),
        note: noteToSave || null,
      };

      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/dine-in/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (appliedDiscount) {
        await fetchJson(`${serverUrl}/orders/table/${table.id}/global-discount`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalDiscount: appliedDiscount }),
        });
      }

      const ordersData = await fetchJson<any[]>(`${serverUrl}/orders/dine-in/table/${table.id}`);
      setExistingOrders(ordersData.filter((o: any) => o.status === 'pending' || o.status === 'printed'));
      setAnimatedOrderId(editingOrder.id);
      setTimeout(() => setAnimatedOrderId(null), 2000);
      setOrdersExpanded(true);
      setAppliedDiscount(null);
      setTableDiscount(0);
      handleCancelEdit();
      showToast(`تم تحديث الطلب بنجاح (${selectedItems.length} صنف)`, 'success');
    } catch (e: any) {
      showToast('حدث خطأ أثناء تحديث الطلب: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  };

  const handleUpdateOrderType = () => {
    showToast('لا يمكن تغيير نوع طلب الصالة', 'info');
  };

  const handleCancelOrder = async (orderId: number) => {
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
      await fetchJson(`${serverUrl}/orders/dine-in/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setExistingOrders(existingOrders.filter((o) => o.id !== orderId));
      if (editingOrder?.id === orderId) handleCancelEdit();
      window.dispatchEvent(new CustomEvent('refresh-tables'));
      showToast('تم إلغاء الطلب', 'success');
    } catch (e: any) {
      showToast('حدث خطأ أثناء إلغاء الطلب: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  };

  return {
    handleApplyDiscount,
    handleSubmitOrder,
    handleClearTable,
    handleEditOrder,
    handleCancelEdit,
    handleSaveEditedOrder,
    handleUpdateOrderType,
    handleCancelOrder,
  };
}
