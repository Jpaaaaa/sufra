'use client';

import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShelfItem } from '../../hooks/useShelves';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';
import ShelfInventoryTable from './ShelfInventoryTable';

interface ShelvesManagementProps {
  shelves: ShelfItem[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
    barcode: string;
    price: string;
    quantity: string;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
    barcode: string;
    price: string;
    quantity: string;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (item: ShelfItem) => void;
  handleDelete: (item: ShelfItem) => Promise<void>;
}

export default function ShelvesManagement({
  shelves,
  loading,
  error,
  formState,
  setFormState,
  isFormOpen,
  setIsFormOpen,
  resetForm,
  handleSubmit,
  handleEdit,
  handleDelete,
}: ShelvesManagementProps) {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const shelfPriceField = useGlobalNumericField(formState.price, (next) =>
    setFormState((prev) => ({ ...prev, price: next })),
  );
  const shelfQtyField = useGlobalNumericField(formState.quantity, (next) =>
    setFormState((prev) => ({ ...prev, quantity: next })),
  );

  // Auto-focus name input when form opens with barcode pre-filled but no name
  useEffect(() => {
    if (isFormOpen && formState.barcode && !formState.name && nameInputRef.current) {
      // Small delay to ensure form is fully rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isFormOpen, formState.barcode, formState.name]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('shelves.stockTitle')}
          </h2>
          <p className="text-[15px] leading-normal font-light text-obsidian/70">
            {t('shelves.stockSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 hover:shadow-soft"
        >
          {t('shelves.addShelfItem')}
        </button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft md:grid-cols-4"
        >
          <div>
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('shelves.itemName')}
            </label>
            <input
              ref={nameInputRef}
              type="text"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('shelves.barcode')}
            </label>
            <input
              type="text"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.barcode}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  barcode: e.target.value,
                }))
              }
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('shelves.price')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              min="0"
              step="1"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.price}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  price: e.target.value,
                }))
              }
              onFocus={shelfPriceField.onFocus}
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('shelves.quantity')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="1"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.quantity}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  quantity: e.target.value,
                }))
              }
              onFocus={shelfQtyField.onFocus}
              required
            />
          </div>
          <div className="flex items-end gap-3 md:col-span-4 md:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50 hover:shadow-soft"
            >
              {formState.id ? t('halls.update') : t('halls.save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-soft-lg border border-black/5 bg-white px-5 py-3 text-[15px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft"
            >
              {t('halls.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-soft-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] leading-normal font-bold text-red-700 shadow-soft">
          {error}
        </div>
      )}

      <ShelfInventoryTable
        shelves={shelves}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

