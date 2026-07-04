'use client';

import { useEffect, useState } from 'react';

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'primary' | 'warning';
}

type ConfirmDialogData = ConfirmDialogOptions & { resolve?: (value: boolean) => void };

let currentDialog: ConfirmDialogData | null = null;
let dialogUpdateCallback: ((dialog: ConfirmDialogData | null) => void) | null = null;

export function showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog: ConfirmDialogData = { ...options, resolve };
    currentDialog = dialog;
    if (dialogUpdateCallback) {
      dialogUpdateCallback(dialog);
    }
  });
}

export function ConfirmDialogContainer() {
  const [dialog, setDialog] = useState<ConfirmDialogData | null>(null);

  useEffect(() => {
    // Set the global callback
    dialogUpdateCallback = (newDialog: ConfirmDialogData | null) => {
      setDialog(newDialog);
    };
    
    // Check if there's a pending dialog
    if (currentDialog) {
      setDialog(currentDialog);
    }
    
    return () => {
      dialogUpdateCallback = null;
    };
  }, []);

  if (!dialog) return null;

  const handleConfirm = () => {
    if (dialog.resolve) dialog.resolve(true);
    currentDialog = null;
    setDialog(null);
  };

  const handleCancel = () => {
    if (dialog.resolve) dialog.resolve(false);
    currentDialog = null;
    setDialog(null);
  };

  const confirmButtonColor =
    dialog.confirmColor === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : dialog.confirmColor === 'warning'
      ? 'bg-yellow-600 hover:bg-yellow-700'
      : 'bg-cyber-aqua hover:bg-cyber-aqua/90';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-obsidian/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-soft-xl border border-black/5 bg-white shadow-soft texture-surface">
        {/* Header */}
        <div className="border-b border-black/5 px-6 py-4">
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
            {dialog.title || 'تأكيد العملية'}
          </h3>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-[15px] leading-normal font-medium text-obsidian/80 leading-relaxed">
            {dialog.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-black/5 px-6 py-4">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-soft-lg border border-black/5 bg-white px-5 py-2.5 text-[15px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft"
          >
            {dialog.cancelText || 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-soft-lg px-5 py-2.5 text-[15px] leading-normal font-bold text-white shadow-soft ${confirmButtonColor}`}
          >
            {dialog.confirmText || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

