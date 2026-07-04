'use client';

import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ShelfSellBarcodeInputProps {
  onBarcodeScanned: (barcode: string) => void;
  loading?: boolean;
}

export default function ShelfSellBarcodeInput({
  onBarcodeScanned,
  loading = false,
}: ShelfSellBarcodeInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = inputRef.current?.value.trim();
    if (barcode) {
      onBarcodeScanned(barcode);
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          placeholder={t('shelves.barcodeScanPlaceholder')}
          disabled={loading}
          className="flex-1 rounded-soft-xl border-2 border-cyber-aqua bg-white px-6 py-4 text-[20px] leading-normal font-bold text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-4 focus:ring-cyber-aqua/20 disabled:opacity-50 disabled:cursor-not-allowed"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-soft-xl bg-cyber-aqua px-8 py-4 text-[18px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-soft"
        >
          {loading ? t('shelves.searching') : t('shelves.search')}
        </button>
      </form>
    </div>
  );
}

