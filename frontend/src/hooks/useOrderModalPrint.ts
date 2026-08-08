import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { showPasswordDialog } from '../components/ui/PasswordDialog';
import { getOrderReceiptTotals } from '../utils/order-totals';
import { expandOrdersForCustomerReceipt } from '../utils/map-receipt-print-items';
import { groupExpandedItemsByKitchen } from '../utils/order-trays';
import { mapKitchenPrintItems } from '../utils/map-kitchen-print-items';
import { orderDisplayNumber } from '../utils/order-display-number';
import { APP_BRAND_NAME } from '../lib/brand';
import type { ExistingOrder } from './useOrderModalTypes';
import type { TableEntity } from '../utils';
import type { Kitchen } from '../utils';

interface UserRole {
  role?: string;
  username?: string;
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
  user: UserRole | undefined,
  hall?: { name?: string; floor_id?: number | null; floor?: { name?: string; number?: number } | null } | null,
) {
  const executePrintOrder = async (orderId: number) => {
    try {
      const order = existingOrders.find((o) => o.id === orderId);
      if (!order) {
        showToast('الطلب غير موجود', 'error');
        return;
      }

      let hallName = hall?.name || 'القاعة';
      let floorName: string | null = null;

      // Prefer floor already attached to the open hall (Orders page has it)
      if (hall?.floor?.name) {
        floorName = hall.floor.name;
      } else if (hall?.floor?.number != null) {
        floorName = `الطابق ${hall.floor.number}`;
      }

      const hallId = table.hall_id ?? null;
      if (hallId) {
        try {
          const serverUrl = getServerUrl();
          const hallRow = window.sufra?.halls?.findOne
            ? await window.sufra.halls.findOne(hallId)
            : await fetchJson<any>(`${serverUrl}/halls/${hallId}`);
          if (hallRow?.name) hallName = hallRow.name;

          if (!floorName) {
            if (hallRow?.floor?.name) {
              floorName = hallRow.floor.name;
            } else if (hallRow?.floor?.number != null || hallRow?.floor?.floor_number != null) {
              floorName = `الطابق ${hallRow.floor.number ?? hallRow.floor.floor_number}`;
            } else {
              const floorId = hallRow?.floor_id ?? hall?.floor_id ?? null;
              if (floorId) {
                const floorRow = window.sufra?.floors?.findOne
                  ? await window.sufra.floors.findOne(floorId)
                  : await fetchJson<any>(`${serverUrl}/floors/${floorId}`);
                if (floorRow?.name) {
                  floorName = floorRow.name;
                } else if (floorRow?.floor_number != null || floorRow?.number != null) {
                  floorName = `الطابق ${floorRow.floor_number ?? floorRow.number}`;
                }
              }
            }
          }
        } catch {
          /* keep resolved values */
        }
      }

      // Last resort: floor_id on the hall prop without nested floor
      if (!floorName && hall?.floor_id) {
        try {
          const serverUrl = getServerUrl();
          const floorRow = window.sufra?.floors?.findOne
            ? await window.sufra.floors.findOne(hall.floor_id)
            : await fetchJson<any>(`${serverUrl}/floors/${hall.floor_id}`);
          if (floorRow?.name) {
            floorName = floorRow.name;
          } else if (floorRow?.floor_number != null || floorRow?.number != null) {
            floorName = `الطابق ${floorRow.floor_number ?? floorRow.number}`;
          }
        } catch {
          /* ignore */
        }
      }

      const receiptTotals = getOrderReceiptTotals(order);

      const basePrintData = {
        orderId: order.id,
        displayNumber: orderDisplayNumber(order),
        table: table.number || table.id || 0,
        hall: hallName,
        floor: floorName,
        totals: receiptTotals,
        timestamp: order.created_at || new Date().toISOString(),
        printTime: new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        note: order.note || null,
        service_type: 'dine-in' as const,
        cashier: user?.username,
      };

      const kitchenGroups = groupExpandedItemsByKitchen(order.items ?? []);

      const kitchenJobs: Array<{
        kitchenId: number;
        kitchenPrintData: any;
        items: any[];
      }> = [];

      for (const [kitchenId, items] of kitchenGroups) {
        if (kitchenId === null) continue;
        const mappedItems = mapKitchenPrintItems(items, order.order_type || 'dine-in');
        kitchenJobs.push({
          kitchenId,
          items,
          kitchenPrintData: {
            ...basePrintData,
            items: mappedItems,
            kitchenName: kitchens.find((k) => k.id === kitchenId)?.name || `المطبخ ${kitchenId}`,
          },
        });
      }

      if (kitchenJobs.length === 0) {
        showToast('لا توجد طابعات مُعدّة للمطابخ. راجع الإعدادات', 'warning');
      } else {
        // Fire kitchen prints in parallel — do not block order-status update on spooler
        void Promise.allSettled(
          kitchenJobs.map(({ kitchenId, kitchenPrintData, items }) =>
            printKitchenOrder(kitchenPrintData, kitchenId, kitchens, items),
          ),
        );
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

  const handlePrintReceipt = async (hallName: string, _tableName: string) => {
    await withPrintPasswordCheck(user, async () => {
      try {
      const totalItems = existingOrders.reduce(
        (sum, o) => sum + (o.items ?? []).filter((i: any) => i.parent_order_item_id == null).length,
        0,
      );
      const subtotalBeforeDiscount = existingOrders.reduce((sum, order) => {
        return (
          sum +
          (order.items ?? []).reduce((itemSum: number, item: any) => {
            if (item.parent_order_item_id != null) return itemSum;
            return itemSum + (item.price || 0) * (item.quantity || 1);
          }, 0)
        );
      }, 0);

      const receiptItems = expandOrdersForCustomerReceipt(existingOrders);

      const orderIds = existingOrders
        .map((o) => o.id)
        .filter((id): id is number => id != null && Number.isFinite(Number(id)));
      const displayNums = existingOrders.map((o) => orderDisplayNumber(o));
      const invoiceNumber = displayNums.length > 0 ? displayNums.join(' + ') : '0';

      const printData = {
        orderId: orderIds.length === 1 ? orderIds[0] : undefined,
        displayNumber: displayNums.length === 1 ? displayNums[0] : undefined,
        invoiceNumber,
        // Use table.number (display number), not table.id or parseInt(name)
        table: table.number || table.id || 0,
        hall: hallName || 'القاعة',
        items: receiptItems,
        totals: {
          subtotal: subtotalBeforeDiscount,
          globalDiscount: appliedDiscount ? { percent: appliedDiscount.percent, amount: appliedDiscount.amount } : null,
          total: tableTotal,
        },
        timestamp: new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        service_type: 'dine-in' as const,
        thankYouMessage: 'شكراً لزيارتكم',
        cashier: user?.username,
      };

      if (window.sufra?.print?.receipt) {
        // Background print — UI continues; toast when done
        void window.sufra.print.receipt(printData).then((result) => {
          if (result.success) {
            const discountText = appliedDiscount ? ` | خصم: ${appliedDiscount.percent}% (${appliedDiscount.amount} د.ع)` : '';
            showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${tableTotal} د.ع (${totalItems} صنف)${discountText}`, 'success', 4000);
          } else {
            showToast('فشل طباعة الفاتورة', 'error');
          }
        });
      } else {
        const serverUrl = getServerUrl();
        void fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptData: printData }),
        }).then((result) => {
          if (result.success) {
            const discountText = appliedDiscount ? ` | خصم: ${appliedDiscount.percent}% (${appliedDiscount.amount} د.ع)` : '';
            showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${tableTotal} د.ع (${totalItems} صنف)${discountText}`, 'success', 4000);
          } else {
            showToast(`فشل طباعة الفاتورة${result.error ? `: ${result.error}` : ''}`, 'error');
          }
        });
      }
      } catch (e: any) {
        console.error('Failed to print receipt:', e);
        showToast('حدث خطأ أثناء طباعة الفاتورة', 'error');
      }
    });
  };

  return { handlePrintOrder, handlePrintAllKitchen, handlePrintReceipt };
}
