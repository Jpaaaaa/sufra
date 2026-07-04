'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastCallbacks: ((toast: ToastMessage) => void)[] = [];

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const toast: ToastMessage = {
    id: Date.now().toString() + Math.random(),
    message,
    type,
    duration,
  };
  toastCallbacks.forEach((cb) => cb(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const callback = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration || 3000);
    };
    toastCallbacks.push(callback);
    return () => {
      toastCallbacks = toastCallbacks.filter((cb) => cb !== callback);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[99999] flex -translate-x-1/2 flex-col gap-2" style={{ zIndex: 99999 }}>
      {toasts.map((toast) => {
        const bgColor =
          toast.type === 'success'
            ? 'bg-green-600'
            : toast.type === 'error'
            ? 'bg-red-600'
            : toast.type === 'warning'
            ? 'bg-yellow-600'
            : 'bg-blue-600';

        const icon =
          toast.type === 'success'
            ? '✓'
            : toast.type === 'error'
            ? '✕'
            : toast.type === 'warning'
            ? '⚠'
            : 'ℹ';

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-xl ${bgColor} px-6 py-3 text-white shadow-2xl`}
            style={{
              pointerEvents: 'auto',
              zIndex: 99999
            }}
          >
            <span className="text-[20px] leading-tight font-bold">{icon}</span>
            <span className="text-[15px] leading-normal font-medium">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

