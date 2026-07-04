'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useShift } from '../../contexts/ShiftContext';

export default function ActionButtonsRow() {
  const { user } = useAuth();
  const { activeShift, isLoading: isCheckingShift } = useShift();

  const isAdminOrManager = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier');

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (isCheckingShift) {
    return (
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6 items-center">
      {isAdminOrManager && activeShift && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>يوم العمل مفتوح منذ {formatTime(activeShift.start_time)}</span>
        </div>
      )}
    </div>
  );
}
