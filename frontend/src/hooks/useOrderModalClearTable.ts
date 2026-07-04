import { fetchJson, getServerUrl } from '../utils';
import { showToast } from '../components/ui/Toast';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showPasswordDialog } from '../components/ui/PasswordDialog';
import type { ExistingOrder, CartItem } from './useOrderModalTypes';

interface UserRole {
  role?: string;
  require_captain_approval?: boolean;
}

export function createClearTableHandler(
  existingOrders: ExistingOrder[],
  user: UserRole | undefined,
  setExistingOrders: (v: ExistingOrder[]) => void,
  setSelectedItems: (v: CartItem[] | ((p: CartItem[]) => CartItem[])) => void
) {
  return async (onClose: () => void) => {
    if (user?.role === 'customer' && user?.require_captain_approval) {
      const ok = await showPasswordDialog({
        title: 'تنظيف الطاولة',
        message: 'الرجاء إدخال كلمة مرور الكابتن/المدير لتنظيف الطاولة',
        onConfirm: async (password: string) => {
          const serverUrl = getServerUrl();
          const r = await fetchJson<{ valid: boolean }>(`${serverUrl}/auth/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sufra_auth_token')}` },
            body: JSON.stringify({ password }),
          });
          return r.valid;
        },
      });
      if (!ok) return;
    }

    const confirmed = await showConfirm({
      message: 'هل تريد تنظيف هذه الطاولة؟ سيتم إغلاق جميع الطلبات النشطة.',
      title: 'تنظيف الطاولة',
      confirmText: 'تنظيف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    try {
      const serverUrl = getServerUrl();
      const archiveResults = await Promise.allSettled(
        existingOrders.map(async (order) => {
          try {
            const result = await fetchJson<any>(`${serverUrl}/orders/dine-in/${order.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' }),
            });
            if (result?.status === 'completed' || result?.status === 'archived') {
              return { success: true, orderId: order.id, status: result.status };
            }
            return { success: false, orderId: order.id, status: result?.status, error: 'Unexpected status' };
          } catch (err: any) {
            return { success: false, orderId: order.id, error: err.message || 'Archive failed' };
          }
        })
      );

      const failed = archiveResults.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );
      const ordersCount = existingOrders.length;
      if (failed.length > 0) {
        const stillPending = failed.filter(
          (f) => f.status === 'fulfilled' && (f.value as any).status === 'pending'
        );
        const msg = stillPending.length > 0
          ? `تم إكمال ${ordersCount - failed.length} من ${ordersCount} طلب. ${stillPending.length} طلب ما زال في حالة انتظار!`
          : `تم إكمال ${ordersCount - failed.length} من ${ordersCount} طلب. فشل إكمال ${failed.length} طلب.`;
        showToast(msg, 'error');
      } else {
        showToast(`تم تنظيف الطاولة بنجاح (${ordersCount} طلب تم إكماله)`, 'success');
      }

      await new Promise((r) => setTimeout(r, 200));
      setExistingOrders([]);
      setSelectedItems([]);
      onClose();
    } catch (e: any) {
      showToast('حدث خطأ أثناء تنظيف الطاولة: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  };
}
