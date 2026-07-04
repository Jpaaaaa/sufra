'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../../hooks/useItems';
import type { Category } from '../../hooks/useCategories';
import { sortItemsAdminDisplay } from '../../utils/admin-catalog-sort';
import { SearchIcon } from '../icons';
import NumericKeypad from '../ui/NumericKeypad';

interface FastPricingTableProps {
  items: Item[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  updateItemPrice: (itemId: number, price: number) => Promise<void>;
}

export default function FastPricingTable({
  items,
  categories,
  loading,
  error,
  updateItemPrice,
}: FastPricingTableProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [draftById, setDraftById] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<number | null>(null);

  const getCategoryName = (categoryId?: number | null) => {
    if (!categoryId) return '—';
    return categories.find((c) => c.id === categoryId)?.name ?? '—';
  };

  const sorted = useMemo(() => sortItemsAdminDisplay(items), [items]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((item) => {
      const name = item.name.toLowerCase();
      const cat = getCategoryName(item.categoryId).toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [sorted, searchQuery, categories]);

  const displayPrice = (item: Item) =>
    draftById[item.id] !== undefined ? draftById[item.id]! : String(item.price);

  const onDraftChange = (item: Item, value: string) => {
    setDraftById((prev) => ({ ...prev, [item.id]: value }));
  };

  const saveRow = async (item: Item) => {
    const raw = displayPrice(item).trim();
    if (raw === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return;
    }
    if (n === item.price && draftById[item.id] === undefined) {
      return;
    }
    setSavingId(item.id);
    try {
      await updateItemPrice(item.id, n);
      setDraftById((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  const rowDirty = (item: Item) => {
    const raw = displayPrice(item).trim();
    if (raw === '') return false;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n !== item.price;
  };

  const focusedItem =
    focusedItemId != null ? items.find((i) => i.id === focusedItemId) : null;
  const keypadValue = focusedItem ? displayPrice(focusedItem) : '';
  const keypadSaving = focusedItemId != null && savingId === focusedItemId;
  const keypadDisabled = focusedItem == null || keypadSaving;

  const onKeypadChange = (next: string) => {
    if (focusedItemId == null) return;
    setDraftById((prev) => ({ ...prev, [focusedItemId]: next }));
  };

  const onKeypadConfirm = () => {
    if (focusedItem) void saveRow(focusedItem);
  };

  return (
    <div
      dir="ltr"
      data-skip-global-keypad
      className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6"
    >
      <div className="w-full shrink-0 xl:sticky xl:top-4 xl:w-[260px] xl:self-start">
        <NumericKeypad
          value={keypadValue}
          onChange={onKeypadChange}
          onConfirm={onKeypadConfirm}
          disabled={keypadDisabled}
          title={
            focusedItem
              ? t('catalog.keypadEditPrice', { name: focusedItem.name })
              : t('catalog.keypadPickCell')
          }
        />
      </div>

      <div dir="rtl" className="min-w-0 flex-1 space-y-4">
        <p className="text-[14px] leading-normal text-obsidian/70">
          {t('catalog.fastPricingHint')}
        </p>

        {error && (
          <div className="rounded-soft-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </div>
        )}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-obsidian/35" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('catalog.fastPricingSearch')}
            className="w-full rounded-soft-lg border border-black/10 bg-white py-3 pl-4 pr-11 text-[15px] text-obsidian shadow-sm placeholder:text-obsidian/40 focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/25"
          />
        </div>

        {loading && items.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] text-obsidian/60">
            {t('catalog.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] text-obsidian/60">
            {t('catalog.fastPricingEmpty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-soft-xl border border-black/5 bg-white shadow-soft">
            <table className="min-w-full border-collapse text-right text-[14px]">
              <thead>
                <tr className="border-b border-black/10 bg-cloud-soft-white">
                  <th className="px-4 py-3 font-bold text-obsidian">{t('catalog.colItem')}</th>
                  <th className="px-4 py-3 font-bold text-obsidian">{t('catalog.colCategory')}</th>
                  <th className="px-4 py-3 font-bold text-obsidian whitespace-nowrap">
                    {t('catalog.colPrice', { currency: t('orders.currency') })}
                  </th>
                  <th className="px-4 py-3 font-bold text-obsidian w-[120px]"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const dirty = rowDirty(item);
                  const isSaving = savingId === item.id;
                  const isFocused = focusedItemId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setFocusedItemId(item.id)}
                      className={`cursor-pointer border-b border-black/5 last:border-0 ${
                        item.hidden_from_menu || item.is_out_of_stock ? 'bg-amber-50/50' : ''
                      } ${isFocused ? 'bg-cyber-aqua/10 ring-1 ring-inset ring-cyber-aqua/30' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-obsidian align-middle">
                        <span className="line-clamp-2">{item.name}</span>
                      </td>
                      <td className="px-4 py-3 text-obsidian/80 align-middle whitespace-nowrap">
                        {getCategoryName(item.categoryId)}
                      </td>
                      <td className="px-4 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isSaving}
                          value={displayPrice(item)}
                          onChange={(e) => onDraftChange(item, e.target.value)}
                          onFocus={(e) => {
                            setFocusedItemId(item.id);
                            e.currentTarget.select();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRow(item);
                          }}
                          className="w-full min-w-[120px] rounded-soft border border-black/15 bg-white px-3 py-2 text-left font-mono text-[15px] tabular-nums text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/20 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={isSaving || !dirty}
                          onClick={() => void saveRow(item)}
                          className="rounded-soft-lg bg-cyber-aqua px-4 py-2 text-[13px] font-bold text-charcoal-graphite shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isSaving ? t('catalog.savePriceSaving') : t('catalog.savePrice')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
