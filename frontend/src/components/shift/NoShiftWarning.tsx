'use client';

import { useShift } from '../../contexts/ShiftContext';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Play } from 'lucide-react';
import Button from '../ui/Button';
import { showAlert } from '../ui/AlertDialog';
import { showToast } from '../ui/Toast';

interface NoShiftWarningProps {
  /** Show as overlay blocking the entire content */
  overlay?: boolean;
  /** Show as inline banner */
  inline?: boolean;
  /** Callback when shift is opened */
  onShiftOpened?: () => void;
}

/**
 * Warning component shown when no shift is open.
 * Prevents order creation and prompts user to open a shift first.
 */
export default function NoShiftWarning({ overlay = false, inline = false, onShiftOpened }: NoShiftWarningProps) {
  const { isShiftOpen, isLoading, openShift } = useShift();
  const { user } = useAuth();
  
  // Don't show if shift is open or still loading
  if (isShiftOpen || isLoading) {
    return null;
  }

  const canOpenShift = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier');

  const handleOpenShift = async () => {
    try {
      await openShift();
      showToast('تم فتح الوردية بنجاح', 'success');
      onShiftOpened?.();
    } catch (error: any) {
      showAlert({
        title: 'خطأ',
        message: error.message || 'فشل فتح الوردية.',
        type: 'error',
      });
    }
  };

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-40 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">لا توجد وردية مفتوحة</h2>
          <p className="text-gray-600 mb-6">يجب فتح وردية قبل إضافة الطلبات</p>
          {canOpenShift ? (
            <Button variant="primary" size="lg" onClick={handleOpenShift} className="flex items-center gap-2 mx-auto">
              <Play className="w-5 h-5" />
              <span>فتح وردية</span>
            </Button>
          ) : (
            <p className="text-sm text-gray-500">اطلب من المدير فتح وردية</p>
          )}
        </div>
      </div>
    );
  }

  if (inline) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-amber-800">لا توجد وردية مفتوحة</p>
            <p className="text-sm text-amber-600">يجب فتح وردية قبل إضافة الطلبات</p>
          </div>
        </div>
        {canOpenShift && (
          <Button variant="primary" size="sm" onClick={handleOpenShift} className="flex items-center gap-2">
            <Play className="w-4 h-4" />
            <span>فتح وردية</span>
          </Button>
        )}
      </div>
    );
  }

  // Default: small banner
  return (
    <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
      <AlertTriangle className="w-4 h-4" />
      <span>لا توجد وردية مفتوحة - لا يمكن إضافة طلبات</span>
      {canOpenShift && (
        <button 
          onClick={handleOpenShift} 
          className="mr-2 text-amber-800 underline text-sm hover:text-amber-900"
        >
          فتح وردية
        </button>
      )}
    </div>
  );
}

/**
 * Hook version for conditionally rendering components
 */
export function useShiftRequired(): { isShiftOpen: boolean; isLoading: boolean; NoShiftWarning: typeof NoShiftWarning } {
  const { isShiftOpen, isLoading } = useShift();
  return { isShiftOpen, isLoading, NoShiftWarning };
}
