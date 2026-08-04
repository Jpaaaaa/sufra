import { getServerUrl, fetchJson, type Kitchen } from '../../utils';
import { showToast } from '../../components/ui/Toast';
import { showPasswordDialog } from '../../components/ui/PasswordDialog';
import { getOrderReceiptTotals } from '../../utils/order-totals';
import { APP_BRAND_NAME } from '../../lib/brand';
import type { ExistingOrder } from '../../hooks/useOrderModal';

type OrderType = 'pickup' | 'delivery';

export function createOrdersPagePrintHandlers(
  user: { role?: string; require_captain_approval?: boolean } | null,
  kitchens: Kitchen[]
) {
  const requestPasswordIfNeeded = async (title: string, message: string): Promise<boolean> => {
    if (user?.role !== 'customer' || !user?.require_captain_approval) return true;
    const confirmed = await showPasswordDialog({
      title,
      message,
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
    return !!confirmed;
  };

  const printKitchenOrder = async (order: ExistingOrder, orderType: OrderType) => {
    const passwordOk = await requestPasswordIfNeeded(
      'طلب كلمة المرور للطباعة',
      'الرجاء إدخال كلمة مرور الكابتن/المدير للطباعة'
    );
    if (!passwordOk) return;

    try {
      const receiptTotals = getOrderReceiptTotals(order);

      const basePrintData = {
        orderId: order.id,
        table: 0,
        hall: orderType === 'pickup' ? 'سفري' : 'توصيل',
        totals: receiptTotals,
        timestamp: order.created_at || new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        note: order.note || null,
        ...(orderType === 'delivery' && {
          customer_name: order.customer_name || null,
          customer_phone: order.customer_phone || null,
          customer_address: order.customer_address || null,
        }),
      };

      const kitchenGroups = new Map<number | null, any[]>();
      order.items.forEach((item: any) => {
        const kitchenId = item.kitchen_id ?? null;
        if (!kitchenGroups.has(kitchenId)) kitchenGroups.set(kitchenId, []);
        kitchenGroups.get(kitchenId)!.push(item);
      });

      const results: { kitchen_id: number; success: boolean }[] = [];
      for (const [kitchenId, items] of kitchenGroups) {
        if (kitchenId === null) continue;
        const mappedItems = items.map((item: any) => ({
          id: item.id,
          item_name: item.item_name || item.name || 'صنف',
          quantity: item.quantity || 1,
          price: item.price || 0,
          kitchen_id: item.kitchen_id ?? null,
          service_type: item.service_type || orderType,
          options_json: item.options_json ?? null,
        }));
        const kitchenPrintData = {
          ...basePrintData,
          items: mappedItems,
          kitchenName: kitchens.find((k) => k.id === kitchenId)?.name || `المطبخ ${kitchenId}`,
          service_type: orderType,
        };

        if (window.sufra?.print?.order) {
          try {
            const result = await window.sufra.print.order(kitchenPrintData, kitchenId);
            const printSuccess = result?.success === true;
            results.push({ kitchen_id: kitchenId, success: printSuccess });
            const kitchen = kitchens.find((k) => k.id === kitchenId);
            const kitchenName = kitchen?.name || 'المطبخ العام';
            const itemsText = items.map((i: any) => `${i.quantity}× ${i.item_name}`).join('، ');
            if (printSuccess) showToast(`✓ تم الطباعة إلى ${kitchenName}: ${itemsText}`, 'success', 4000);
            else showToast(`✕ فشل الطباعة إلى ${kitchenName}${result?.error ? `: ${result.error}` : ''}`, 'error');
          } catch (printError: any) {
            results.push({ kitchen_id: kitchenId, success: false });
            const kitchen = kitchens.find((k) => k.id === kitchenId);
            showToast(`✕ فشل الطباعة إلى ${kitchen?.name || 'المطبخ'}: ${printError?.message || 'خطأ'}`, 'error');
          }
        } else {
          try {
            const serverUrl = getServerUrl();
            const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderData: kitchenPrintData, kitchenId }),
            });
            const printSuccess = result.success === true;
            results.push({ kitchen_id: kitchenId, success: printSuccess });
            const kitchen = kitchens.find((k) => k.id === kitchenId);
            const kitchenName = kitchen?.name || 'المطبخ العام';
            const itemsText = items.map((i: any) => `${i.quantity}× ${i.item_name}`).join('، ');
            if (printSuccess) showToast(`✓ تم الطباعة إلى ${kitchenName}: ${itemsText}`, 'success', 4000);
            else showToast(`✕ فشل الطباعة إلى ${kitchenName}${result.error ? `: ${result.error}` : ''}`, 'error');
          } catch (httpError: any) {
            results.push({ kitchen_id: kitchenId, success: false });
            const kitchen = kitchens.find((k) => k.id === kitchenId);
            showToast(`✕ فشل الطباعة إلى ${kitchen?.name || 'المطبخ'}: ${httpError?.message || 'خطأ'}`, 'error');
          }
        }
      }

      if (results.length === 0) showToast('لا توجد طابعات مُعدّة للمطابخ. راجع الإعدادات', 'warning');
      else {
        const successCount = results.filter((r) => r.success).length;
        const totalCount = results.length;
        if (successCount === totalCount) showToast(`✓ تم طباعة الطلب إلى ${totalCount} مطبخ`, 'success', 3000);
        else showToast(`⚠ تم الطباعة إلى ${successCount}/${totalCount} مطبخ`, 'warning', 3000);
      }

      if (order?.status === 'pending') {
        const serverUrl = getServerUrl();
        const endpoint = orderType === 'pickup'
          ? `${serverUrl}/orders/pickup/${order.id}/status`
          : `${serverUrl}/orders/delivery/${order.id}/status`;
        await fetchJson(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'printed' }),
        });
      }
    } catch (error: any) {
      showToast('حدث خطأ أثناء طباعة الطلب', 'error');
    }
  };

  const printCustomerReceipt = async (order: ExistingOrder, orderType: OrderType) => {
    const passwordOk = await requestPasswordIfNeeded(
      'طلب كلمة المرور للطباعة',
      'الرجاء إدخال كلمة مرور الكابتن/المدير للطباعة'
    );
    if (!passwordOk) return;

    try {
      const receiptTotals = getOrderReceiptTotals(order);
      const receiptItems = order.items.map((item: any) => ({
        order_id: order.id,
        item_name: item.item_name || item.name || 'صنف',
        quantity: item.quantity || 1,
        price: item.price || 0,
        service_type: item.service_type || orderType,
      }));
      const receiptData = {
        orderId: order.id,
        table: 0,
        hall: orderType === 'pickup' ? 'سفري' : 'توصيل',
        items: receiptItems,
        totals: receiptTotals,
        timestamp: order.created_at || new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        service_type: orderType,
        ...(orderType === 'delivery' && {
          customer_name: order.customer_name || null,
          customer_phone: order.customer_phone || null,
          customer_address: order.customer_address || null,
        }),
      };

      if (window.sufra?.print?.receipt) {
        const result = await window.sufra.print.receipt(receiptData);
        const printSuccess = result?.success === true;
        if (printSuccess) {
          const globalDiscount = receiptTotals.globalDiscount;
          const discountText = globalDiscount ? ` | خصم: ${globalDiscount.percent}% (${globalDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${receiptTotals.total} د.ع (${order.items.length} صنف)${discountText}`, 'success', 4000);
        } else showToast(`✕ فشل طباعة الفاتورة${result?.error ? `: ${result.error}` : ''}`, 'error');
      } else {
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptData }),
        });
        if (result.success) {
          const globalDiscount = receiptTotals.globalDiscount;
          const discountText = globalDiscount ? ` | خصم: ${globalDiscount.percent}% (${globalDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${receiptTotals.total} د.ع (${order.items.length} صنف)${discountText}`, 'success', 4000);
        } else showToast(`✕ فشل طباعة الفاتورة${result.error ? `: ${result.error}` : ''}`, 'error');
      }
    } catch (error: any) {
      showToast(`حدث خطأ أثناء طباعة الفاتورة: ${error?.message || 'خطأ'}`, 'error');
    }
  };

  const printArchivedDineInReceipt = async (order: ExistingOrder) => {
    const passwordOk = await requestPasswordIfNeeded(
      'طلب كلمة المرور للطباعة',
      'الرجاء إدخال كلمة مرور الكابتن/المدير للطباعة'
    );
    if (!passwordOk) return;

    try {
      const receiptTotals = getOrderReceiptTotals(order);
      const receiptItems = order.items.map((item: any) => ({
        order_id: order.id,
        item_name: item.item_name || item.name || 'صنف',
        quantity: item.quantity || 1,
        price: item.price || 0,
        service_type: item.service_type || 'dine-in',
      }));
      const receiptData = {
        orderId: order.id,
        table: (order as any).table_id || 0,
        hall: (order as any).hall_name || 'الصالة',
        items: receiptItems,
        totals: receiptTotals,
        timestamp: order.created_at || new Date().toISOString(),
        restaurantName: APP_BRAND_NAME,
        service_type: 'dine-in',
      };

      if (window.sufra?.print?.receipt) {
        const result = await window.sufra.print.receipt(receiptData);
        const printSuccess = result?.success === true;
        if (printSuccess) {
          const globalDiscount = receiptTotals.globalDiscount;
          const discountText = globalDiscount ? ` | خصم: ${globalDiscount.percent}% (${globalDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${receiptTotals.total} د.ع (${order.items.length} صنف)${discountText}`, 'success', 4000);
        } else showToast(`✕ فشل طباعة الفاتورة${result?.error ? `: ${result.error}` : ''}`, 'error');
      } else {
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/api/print/receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptData }),
        });
        if (result.success) {
          const globalDiscount = receiptTotals.globalDiscount;
          const discountText = globalDiscount ? ` | خصم: ${globalDiscount.percent}% (${globalDiscount.amount} د.ع)` : '';
          showToast(`✓ تم طباعة الفاتورة للعميل | المجموع: ${receiptTotals.total} د.ع (${order.items.length} صنف)${discountText}`, 'success', 4000);
        } else showToast(`✕ فشل طباعة الفاتورة${result.error ? `: ${result.error}` : ''}`, 'error');
      }
    } catch (error: any) {
      showToast(`حدث خطأ أثناء طباعة الفاتورة: ${error?.message || 'خطأ'}`, 'error');
    }
  };

  return { printKitchenOrder, printCustomerReceipt, printArchivedDineInReceipt };
}
