'use client';

import { useState, useEffect, useRef } from 'react';

export interface PasswordDialogOptions {
  title: string;
  message: string;
  onConfirm: (password: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

let passwordDialogResolve: ((value: boolean) => void) | null = null;
let passwordDialogOptions: PasswordDialogOptions | null = null;

export function showPasswordDialog(options: PasswordDialogOptions): Promise<boolean> {
  passwordDialogOptions = options;
  return new Promise<boolean>((resolve) => {
    passwordDialogResolve = resolve;
    // Trigger re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('password-dialog-show'));
  });
}

export default function PasswordDialog() {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShow = () => {
      setShow(true);
      setPassword('');
      setError('');
      setLoading(false);
      // Focus input after a short delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    };

    window.addEventListener('password-dialog-show', handleShow);
    return () => {
      window.removeEventListener('password-dialog-show', handleShow);
    };
  }, []);

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('الرجاء إدخال كلمة المرور');
      return;
    }

    if (!passwordDialogOptions) return;

    setLoading(true);
    setError('');

    try {
      const result = await passwordDialogOptions.onConfirm(password);
      if (result) {
        setShow(false);
        setPassword('');
        if (passwordDialogResolve) {
          passwordDialogResolve(true);
          passwordDialogResolve = null;
        }
      } else {
        setError('كلمة المرور غير صحيحة');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحقق من كلمة المرور');
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShow(false);
    setPassword('');
    setError('');
    if (passwordDialogResolve) {
      passwordDialogResolve(false);
      passwordDialogResolve = null;
    }
    if (passwordDialogOptions?.onCancel) {
      passwordDialogOptions.onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!show || !passwordDialogOptions) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-2 text-right text-[18px] leading-tight font-bold text-obsidian">
          {passwordDialogOptions.title}
        </h2>
        {passwordDialogOptions.message && (
          <p className="mb-4 text-right text-[15px] leading-normal text-slate-600">
            {passwordDialogOptions.message}
          </p>
        )}
        
        <div className="mb-4">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="كلمة المرور"
            className="w-full rounded-lg border-2 border-slate-300 px-4 py-3 text-right text-[15px] leading-normal focus:border-blue-500 focus:outline-none"
            disabled={loading}
            dir="rtl"
          />
          {error && (
            <p className="mt-2 text-right text-[14px] leading-normal text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-[15px] leading-normal font-bold text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : 'تأكيد'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

