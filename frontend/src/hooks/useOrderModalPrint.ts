import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { showPasswordDialog } from '../components/ui/PasswordDialog';
import { getOrderReceiptTotals } from '../utils/order-totals';
import { APP_BRAND_NAME } from '../lib/brand';
import type { ExistingOrder } from './useOrderModalTypes';
import type { TableEntity } from '../utils';
import type { Kitchen } from '../utils';

interface UserRole {
  role?: string;
  require_captain_approval?: boolean;
}

async function withPrintPasswordCheck(user: UserRole | undefined, fn: () => Promise<void>) {
  if (user?.role === 'customer' && user?.require_captain_approval) {
    const passwordConfirmed = await showPasswordDialog({
      title: 'طلب كلمة المرور للطباعة',
      message: 'الرجاء إدخال كلمة مرور الكابتن/المدير للطباعة',
      onConfirm: async (password: string) => {
        const serverUrl = getServerUrl();
        const response = await fetchJson<{ valid: boolean }>(`${serverUrl}/auth/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        return response.valid;
      },
    });
    if (!passwordConfirmed) return;
  }
  await fn();
}

async function printKitchenOrder(
  kitchenPrintData: any,
  kitchenId: number,
  kitchens: Kitchen[],
  items: any[]
) {
  const kitchen = kitchens.find((k) => k.id === kitchenId);
  const kitchenName = kitchen?.name || 'المطبخ العام';
  const itemsText = items.map((i: any) => `${i.quantity}× ${i.item_name}`).join('، ');

  if (window.sufra?.print?.order) {
    const result = await window.sufra.print.order(kitchenPrintData, kitchenId);
    if (result.success) {
      showToast(`✓ تم الطباعة إلى ${kitchenName}: ${itemsText}`, 'success', 4000);
    } else {
      showToast(`✕ فشل الطباعة إلى ${kitchenName}${result.error ? `: ${result.error}` : ''}`, 'error');
    }
    return result.success;
  }

  const serverUrl = getServerUrl();
  const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderData: kitchenPrintData, kitchenId }),
  });
  if (result.success) {
    showToast(`✓ تم الطباعة إلى ${kitchenName}: ${itemsText}`, 'success', 4000);
  } else {
    showToast(`✕ فشل الطباعة إلى ${kitchenName}${result.error ? `: ${result.error}` : ''}`, 'error');
  }
  return result.success;
}

export function createOrderModalPrintHandlers(
  table: TableEntity,
  existingOrders: ExistingOrder[],
  kitchens: Kitchen[],
  setExistingOrders: (orders: ExistingOrder[]) => void,
  appliedDiscount: { percent: number; amount: number } | null,
  tableTotal: number,
  user: UserRole | undefined
) {
  const executePrintOrder = async (orderId: number) => {
    try {
      const order = existingOrders.find((o) => o.id === orderId);
      if (!order) {
        showToast('الطلب غير موجود', 'error');
        return;
      }

      let hallName = 'القاعة';
      if (table.hall_id) {
        try {
          const serverUrl = getServerUrl();
          if (window.sufra?.halls?.findOne) {
            const hall = await window.sufra.halls.findOne(table.hall_id);
            hallName = hall?.name || 'القاعة';
          } else {
            const hall = await fetchJson<any>(`${serverUrl}/halls/${table.hall_id}`);
            hallName = hall?.name || 'القاعة';
          }
        } catch {
          /* use default */
        }
      }

      const receiptTotals = getOrderReceiptTotals(order);

      const basePrintData = {
        orderId: order.id,
        table: table.number || table.id || 0,
        hall: hallName,
        totals: receiptTotals,
        timestamp: order.created_at || new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        note: order.note || null,
      };

      const kitchenGroups = new Map<number | null, any[]>();
      order.items.forEach((item: any) => {
        const kid = item.kitchen_id ?? null;
        if (!kitchenGroups.has(kid)) kitchenGroups.set(kid, []);
        kitchenGroups.get(kid)!.push(item);
      });

      let printedCount = 0;
      for (const [kitchenId, items] of kitchenGroups) {
        if (kitchenId === null) continue;
        printedCount++;
        const mappedItems = items.map((item: any) => ({
          id: item.id,
          item_name: item.item_name || item.name || 'صنف',
          quantity: item.quantity || 1,
          price: item.price || 0,
          kitchen_id: item.kitchen_id ?? null,
          service_type: item.service_type || order.order_type || 'dine-in',
          options_json: item.options_json ?? null,
        }));
        const kitchenPrintData = {
          ...basePrintData,
          items: mappedItems,
          kitchenName: kitchens.find((k) => k.id === kitchenId)?.name || `المطبخ ${kitchenId}`,
        };
        await printKitchenOrder(kitchenPrintData, kitchenId, kitchens, items);
      }
      if (printedCount === 0) {
        showToast('لا توجد طابعات مُعدّة للمطابخ. راجع الإعدادات', 'warning');
      }

      if (order.status === 'pending') {
        if (window.sufra?.orders?.updateStatus) {
          await window.sufra.orders.updateStatus(orderId, 'printed');
        } else {
          const serverUrl = getServerUrl();
          await fetchJson(`${serverUrl}/orders/dine-in/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'printed' }),
          });
        }
      }

      const ordersData = window.sufra?.orders?.findByTable
        ? await window.sufra.orders.findByTable(table.id)
        : await fetchJson<any[]>(`${getServerUrl()}/orders/dine-in/table/${table.id}`);
      setExistingOrders(ordersData.filter((o: any) => o.status === 'pending' || o.status === 'printed'));

      if (table.hall_id) {
        window.dispatchEvent(new CustomEvent('refresh-tables', { detail: { hallId: table.hall_id } }));
      }
    } catch (e: any) {
      console.error('Failed to print order:', e);
      showToast('حدث خطأ أثناء طباعة الطلب', 'error');
    }
  };

  const handlePrintOrder = async (orderId: number) => {
    await withPrintPasswordCheck(user, () => executePrintOrder(orderId));
  };

  const handlePrintAllKitchen = async () => {
    if (existingOrders.length === 0) {
      showToast('لا توجد طلبات للطباعة', 'warning');
      return;
    }
    await withPrintPasswordCheck(user, async () => {
      for (const order of existingOrders) {
        await executePrintOrder(order.id);
      }
    });
  };

  const handlePrintReceipt = async (hallName: string, tableName: string) => {
    await withPrintPasswordCheck(user, async () => {
      try {
      const totalItems = existingOrders.reduce((sum, o) => sum + o.items.length, 0);
      const subtotalBeforeDiscount = existingOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum: number, item: any) => itemSum + (item.price || 0) * (item.quantity || 1), 0);
      }, 0);

      const receiptItems = existingOrders.flatMap((order: any) =>
        order.items.map((item: any) => ({
          order_id: order.id,
          item_name: item.item_name || item.name || 'صنف',
          quantity: item.quantity || 1,
          price: item.price || 0,
          service_type: item.service_type || order.order_type || 'dine-in',
        }))
      );

      const printData = {
        orderId: existingOrders[0]?.id || 0,
        table: parseInt(tableName) || table.id || 0,
        hall: hallName || 'القاعة',
        items: receiptItems,
        totals: {
          subtotal: subtotalBeforeDiscount,
          globalDiscount: appliedDiscount ? { percent: appliedDiscount.percent, amount: appliedDiscount.amount } : null,
          total: tableTotal,
        },
        timestamp: new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
      };

      if (window.sufra?.print?.receipt) {
        const result = await window.sufra.print.receipt(printData);
        if (result.success) {
          const discountText = appliedDiscount ? ` | خصم: ${appliedDiscount.percent}% (${appliedDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${tableTotal} د.ع (${totalItems} صنف)${discountText}`, 'success', 4000);
        } else {
          showToast('فشل طباعة الفاتورة', 'error');
        }
      } else {
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptData: printData }),
        });
        if (result.success) {
          const discountText = appliedDiscount ? ` | خصم: ${appliedDiscount.percent}% (${appliedDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${tableTotal} د.ع (${totalItems} صنف)${discountText}`, 'success', 4000);
        } else {
          showToast(`فشل طباعة الفاتورة${result.error ? `: ${result.error}` : ''}`, 'error');
        }
      }
      } catch (e: any) {
        console.error('Failed to print receipt:', e);
        showToast('حدث خطأ أثناء طباعة الفاتورة', 'error');
      }
    });
  };

  return { handlePrintOrder, handlePrintAllKitchen, handlePrintReceipt };
}
