'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../../hooks/useItems';

export type ComboLine = { product_id: number; quantity: number };

interface ComboContentsPickerProps {
  items: Item[];
  value: ComboLine[];
  onChange: (next: ComboLine[]) => void;
  formatPrice: (n: number) => string;
}

/** Combo tray contents: selected lines with qty steppers + catalog to add. */
export function ComboContentsPicker({
  items,
  value,
  onChange,
  formatPrice,
}: ComboContentsPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const selectedIds = useMemo(() => new Set(value.map((r) => r.product_id)), [value]);

  const selectedLines = useMemo(() => {
    return value
      .map((row) => {
        const item = byId.get(row.product_id);
        if (!item) return null;
        return { row, item, lineTotal: item.price * row.quantity };
      })
      .filter(Boolean) as Array<{ row: ComboLine; item: Item; lineTotal: number }>;
  }, [value, byId]);

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (selectedIds.has(i.id)) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q);
    });
  }, [items, selectedIds, search]);

  const setQty = (productId: number, quantity: number) => {
    const qty = Math.max(1, Math.floor(quantity) || 1);
    onChange(value.map((r) => (r.product_id === productId ? { ...r, quantity: qty } : r)));
  };

  const removeLine = (productId: number) => {
    onChange(value.filter((r) => r.product_id !== productId));
  };

  const addProduct = (productId: number) => {
    if (selectedIds.has(productId)) {
      setQty(productId, (value.find((r) => r.product_id === productId)?.quantity ?? 1) + 1);
      return;
    }
    onChange([...value, { product_id: productId, quantity: 1 }]);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-obsidian">
            {t('offers.comboContentsTitle', { defaultValue: 'محتويات الصينية' })}
          </h3>
          <span className="rounded-md bg-cyber-aqua/10 px-2 py-0.5 text-[11px] font-bold text-cyber-aqua">
            {t('offers.comboContentsCount', {
              defaultValue: '{{count}} صنف',
              count: selectedLines.length,
            })}
          </span>
        </div>

        {selectedLines.length === 0 ? (
          <div className="rounded-soft-lg border border-dashed border-black/15 bg-slate-50/80 px-4 py-6 text-center text-[13px] text-obsidian/50">
            {t('offers.comboContentsEmpty', {
              defaultValue: 'أضف منتجات من القائمة أدناه. يمكنك زيادة الكمية لكل منتج.',
            })}
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedLines.map(({ row, item, lineTotal }) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-soft-lg border border-cyber-aqua/25 bg-gradient-to-l from-cyber-aqua/[0.06] to-white px-3 py-2.5 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-obsidian">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-obsidian/55">
                    {formatPrice(item.price)}
                    <span className="mx-1 text-obsidian/30">·</span>
                    {t('offers.comboLineTotal', {
                      defaultValue: 'المجموع {{amount}}',
                      amount: formatPrice(lineTotal),
                    })}
                  </p>
                </div>

                <div
                  className="flex flex-shrink-0 items-center gap-0 overflow-hidden rounded-lg border border-black/10 bg-white"
                  role="group"
                  aria-label={t('offers.comboItemQty')}
                >
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-[18px] font-bold text-obsidian/70 transition hover:bg-black/[0.04] disabled:opacity-40"
                    disabled={row.quantity <= 1}
                    onClick={() => setQty(item.id, row.quantity - 1)}
                    aria-label="−"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-9 w-11 border-x border-black/10 bg-transparent text-center text-[14px] font-bold text-obsidian outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={row.quantity}
                    onChange={(e) => setQty(item.id, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-[18px] font-bold text-cyber-aqua transition hover:bg-cyber-aqua/10"
                    onClick={() => setQty(item.id, row.quantity + 1)}
                    aria-label="+"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(item.id)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-obsidian/40 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={t('offers.comboRemoveItem', { defaultValue: 'إزالة' })}
                  title={t('offers.comboRemoveItem', { defaultValue: 'إزالة' })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-bold text-obsidian">
          {t('offers.pickProducts')}
        </h3>
        <div className="relative mb-2">
          <input
            className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] outline-none ring-cyber-aqua/30 focus:ring-2"
            placeholder={t('offers.searchProduct', { defaultValue: 'بحث منتج...' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-soft-lg border border-black/8 bg-slate-50/50 p-1.5">
          {catalog.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-obsidian/45">
              {t('offers.comboNoMoreProducts', {
                defaultValue: 'لا توجد منتجات إضافية مطابقة',
              })}
            </p>
          ) : (
            catalog.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addProduct(item.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white px-3 py-2.5 text-start shadow-sm transition hover:border-cyber-aqua/30 hover:bg-cyber-aqua/[0.04]"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyber-aqua/10 text-[16px] font-bold text-cyber-aqua">
                  +
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-obsidian">
                  {item.name}
                </span>
                <span className="flex-shrink-0 text-[12px] font-semibold text-obsidian/55">
                  {formatPrice(item.price)}
                </span>
              </button>
            ))
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-obsidian/45">
          {t('offers.comboQtyHint', {
            defaultValue: 'اضغط + لإضافة المنتج، ثم زد الكمية من أزرار الكمية أعلاه إن احتجت أكثر من قطعة.',
          })}
        </p>
      </div>
    </div>
  );
}
