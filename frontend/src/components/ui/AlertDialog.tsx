'use client';

import { useEffect, useState } from 'react';

export interface AlertDialogOptions {
  message: string;
  title?: string;
  buttonText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

type AlertDialogData = AlertDialogOptions & { resolve?: () => void };

let currentAlert: AlertDialogData | null = null;
let alertUpdateCallback: ((dialog: AlertDialogData | null) => void) | null = null;

export function showAlert(options: AlertDialogOptions): Promise<void> {
  return new Promise((resolve) => {
    const dialog: AlertDialogData = { ...options, resolve };
    currentAlert = dialog;
    if (alertUpdateCallback) {
      alertUpdateCallback(dialog);
    }
  });
}

export function AlertDialogContainer() {
  const [dialog, setDialog] = useState<AlertDialogData | null>(null);

  useEffect(() => {
    // Set the global callback
    alertUpdateCallback = (newDialog: AlertDialogData | null) => {
      setDialog(newDialog);
    };
    
    // Check if there's a pending dialog
    if (currentAlert) {
      setDialog(currentAlert);
    }
    
    return () => {
      alertUpdateCallback = null;
    };
  }, []);

  if (!dialog) return null;

  const handleClose = () => {
    if (dialog.resolve) dialog.resolve();
    currentAlert = null;
    setDialog(null);
  };

  const typeColors = {
    info: 'bg-graphite',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
    success: 'bg-green-600',
  };

  const iconColors = {
    info: 'text-graphite',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    success: 'text-green-600',
  };

  const icons = {
    info: 'ℹ',
    warning: '⚠',
    error: '✕',
    success: '✓',
  };

  const type = dialog.type || 'info';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-obsidian/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-soft-xl border border-black/5 bg-white shadow-soft texture-surface">
        {/* Header */}
        <div className="border-b border-black/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-soft-lg ${typeColors[type]}/10`}>
              <span className={`text-[20px] leading-tight font-bold ${iconColors[type]}`}>
                {icons[type]}
              </span>
            </div>
            <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
              {dialog.title || (type === 'error' ? 'خطأ' : type === 'warning' ? 'تحذير' : type === 'success' ? 'نجح' : 'معلومة')}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-[15px] leading-normal font-medium text-obsidian/80 leading-relaxed">
            {dialog.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end border-t border-black/5 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className={`rounded-soft-lg px-5 py-2.5 text-[15px] leading-normal font-bold text-white shadow-soft ${typeColors[type]} hover:opacity-90`}
          >
            {dialog.buttonText || 'حسناً'}
          </button>
        </div>
      </div>
    </div>
  );
}

