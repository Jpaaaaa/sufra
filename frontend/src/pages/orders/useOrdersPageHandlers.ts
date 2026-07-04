import { getServerUrl, TableEntity, fetchJson } from '../../utils';
import { showPasswordDialog } from '../../components/ui/PasswordDialog';
import { showToast } from '../../components/ui/Toast';
import { showConfirm } from '../../components/ui/ConfirmDialog';
import type { ExistingOrder } from '../../hooks/useOrderModal';

export function createOrdersPageHandlers(
  user: { id: number; role?: string; require_captain_approval?: boolean } | null,
  activeTab: 'pickup' | 'delivery' | 'dine-in',
  setters: {
    setOrderTable: (t: TableEntity | null) => void;
    setShowOrderModal: (v: boolean) => void;
    setPickupOrderToEdit: (o: ExistingOrder | null) => void;
    setShowPickupModal: (v: boolean) => void;
    setDeliveryOrderToEdit: (o: ExistingOrder | null) => void;
    setShowDeliveryModal: (v: boolean) => void;
  },
  callbacks: {
    handleOrderSubmitted: () => void;
    loadPickupOrders: () => void;
    loadDeliveryOrders: () => void;
    loadArchivedDineInOrders: () => Promise<void>;
  },
  data: { archivedDineInOrders: ExistingOrder[]; allPickupOrders: ExistingOrder[]; allDeliveryOrders: ExistingOrder[] }
) {
  const handleTableClick =
    async (table: TableEntity) => {
      if (user?.role === 'customer' && user?.require_captain_approval) {
        const passwordConfirmed = await showPasswordDialog({
          title: 'فتح الطاولة',
          message: 'الرجاء إدخال كلمة مرور الكابتن/المدير لفتح الطاولة',
          onConfirm: async (password: string) => {
            try {
              const serverUrl = getServerUrl();
              const verifyResponse = await fetchJson<{ valid: boolean }>(`${serverUrl}/auth/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
                body: JSON.stringify({ password }),
              });
              if (!verifyResponse.valid) return false;
              const isUnlockedResponse = await fetchJson<{ unlocked: boolean }>(`${serverUrl}/tables/${table.id}/is-unlocked`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
              });
              if (!isUnlockedResponse.unlocked) {
                const unlockResponse = await fetchJson<{ success: boolean }>(`${serverUrl}/tables/${table.id}/unlock`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
                  body: JSON.stringify({ password }),
                });
                return unlockResponse.success;
              }
              return true;
            } catch (err: any) {
              showToast(err.message || 'فشل فتح الطاولة', 'error');
              return false;
            }
          },
        });
        if (!passwordConfirmed) return;
        try {
          const serverUrl = getServerUrl();
          const lockedTableResponse = await fetchJson<{ table_id: number | null }>(`${serverUrl}/tables/customer/locked-table`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
          });
          if (lockedTableResponse.table_id !== null && lockedTableResponse.table_id !== table.id) {
            await fetchJson(`${serverUrl}/tables/customer/unlock`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
              body: JSON.stringify({ user_id: user.id }),
            });
          }
          if (lockedTableResponse.table_id !== table.id) {
            await fetchJson<{ success: boolean }>(`${serverUrl}/tables/customer/lock`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
              body: JSON.stringify({ user_id: user.id, table_id: table.id }),
            });
          }
        } catch { /* continue */ }
      }
      setters.setOrderTable(table);
      setters.setShowOrderModal(true);
    };

  const handleCloseModal = async () => {
    if (user?.role === 'customer' && user?.require_captain_approval) {
      let verifiedPassword = '';
      const passwordConfirmed = await showPasswordDialog({
        title: 'إغلاق الطاولة',
        message: 'الرجاء إدخال كلمة مرور الكابتن/المدير لإغلاق الطاولة',
        onConfirm: async (password: string) => {
          try {
            const response = await fetchJson<{ valid: boolean }>(`${getServerUrl()}/auth/verify-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
              body: JSON.stringify({ password }),
            });
            if (response.valid) verifiedPassword = password;
            return response.valid;
          } catch (err: any) {
            showToast(err.message || 'فشل التحقق من كلمة المرور', 'error');
            return false;
          }
        },
      });
      if (!passwordConfirmed) return;
      try {
        await fetchJson(`${getServerUrl()}/tables/customer/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sufra_auth_token')}` },
          body: JSON.stringify({ user_id: user.id, password: verifiedPassword }),
        });
      } catch { /* ignore */ }
    }
    setters.setShowOrderModal(false);
    setters.setOrderTable(null);
    callbacks.handleOrderSubmitted();
  };

  const handleClearArchivedDineIn = async () => {
    if (data.archivedDineInOrders.length === 0) {
      showToast('لا توجد طلبات مؤرشفة للحذف', 'info');
      return;
    }
    const confirmed = await showConfirm({
      title: 'حذف جميع الطلبات المؤرشفة',
      message: `هل أنت متأكد من حذف جميع الطلبات المؤرشفة لطلبات الصالة؟ سيتم حذف ${data.archivedDineInOrders.length} طلب نهائياً.`,
      confirmText: 'حذف الكل',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;
    try {
      const result = await fetchJson<{ deletedCount: number }>(`${getServerUrl()}/orders/dine-in/archived`, { method: 'DELETE' });
      if (result?.deletedCount) {
        showToast(`تم حذف ${result.deletedCount} طلب مؤرشف بنجاح`, 'success');
        await callbacks.loadArchivedDineInOrders();
      } else showToast('لم يتم حذف أي طلب', 'warning');
    } catch {
      showToast('حدث خطأ أثناء حذف الطلبات المؤرشفة', 'error');
    }
  };

  const handleClearArchived = async () => {
    const orderType = activeTab === 'pickup' ? 'pickup' : 'delivery';
    const orderTypeText = orderType === 'pickup' ? 'السفري' : 'التوصيل';
    const archivedOrders = orderType === 'pickup'
      ? data.allPickupOrders.filter((o: any) => o.status === 'archived')
      : data.allDeliveryOrders.filter((o: any) => o.status === 'archived');
    if (archivedOrders.length === 0) {
      showToast('لا توجد طلبات مؤرشفة للحذف', 'info');
      return;
    }
    const confirmed = await showConfirm({
      title: 'حذف جميع الطلبات المؤرشفة',
      message: `هل أنت متأكد من حذف جميع الطلبات المؤرشفة لطلبات ${orderTypeText}؟ سيتم حذف ${archivedOrders.length} طلب نهائياً.`,
      confirmText: 'حذف الكل',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;
    try {
      const endpoint = orderType === 'pickup' ? `${getServerUrl()}/orders/pickup/archived` : `${getServerUrl()}/orders/delivery/archived`;
      const response = await fetchJson<{ deletedCount: number }>(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      showToast(`تم حذف ${response.deletedCount} طلب مؤرشف بنجاح`, 'success');
      if (orderType === 'pickup') void callbacks.loadPickupOrders();
      else void callbacks.loadDeliveryOrders();
    } catch {
      showToast('حدث خطأ أثناء حذف الطلبات المؤرشفة', 'error');
    }
  };

  return { handleTableClick, handleCloseModal, handleClearArchivedDineIn, handleClearArchived };
}
