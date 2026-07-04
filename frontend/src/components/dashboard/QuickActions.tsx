'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getServerUrl, fetchJson } from '../../utils';
import { Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { showAlert } from '../ui/AlertDialog';
import { showConfirm } from '../ui/ConfirmDialog';
import { showToast } from '../ui/Toast';

export default function QuickActions() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleClearAllTables = async () => {
    const confirmed = await showConfirm({
      title: 'تفريغ جميع الطاولات',
      message: 'هل أنت متأكد من تفريغ جميع الطاولات؟ سيتم إلغاء جميع الطلبات النشطة.',
      confirmText: 'تفريغ',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/clear-all`, {
        method: 'PATCH',
      });
      
      showToast('تم تفريغ جميع الطاولات بنجاح', 'success');
      
      // Reload the page to refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to clear all tables:', error);
      showAlert({ 
        title: 'خطأ', 
        message: 'فشل تفريغ الطاولات. ' + (error.message || ''), 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Only show for admin/manager
  const isAdminOrManager = user && (user.role === 'admin' || user.role === 'manager');

  if (!isAdminOrManager) {
    return null;
  }

  return (
    <div className="mb-6">
      <Button
        variant="outline"
        size="md"
        onClick={handleClearAllTables}
        disabled={isLoading}
        className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
      >
        <Trash2 className="w-4 h-4" />
        <span className="text-[14px] leading-relaxed font-normal">
          تفريغ جميع الطاولات
        </span>
      </Button>
    </div>
  );
}

