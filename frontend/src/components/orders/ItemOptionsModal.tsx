'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../../hooks/useItems';
import {
  calculateLinePrice,
  getDefaultSelections,
  isSelectionValid,
  type SelectedItemOptions,
} from '../../lib/item-options';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface ItemOptionsModalProps {
  isOpen: boolean;
  item: Item | null;
  initialSelections?: SelectedItemOptions;
  onClose: () => void;
  onConfirm: (selections: SelectedItemOptions, linePrice: number) => void;
  confirmLabel?: string;
}

export const ItemOptionsModal = memo(function ItemOptionsModal({
  isOpen,
  item,
  initialSelections,
  onClose,
  onConfirm,
  confirmLabel,
}: ItemOptionsModalProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const groups = item?.option_groups ?? [];

  const [selected, setSelected] = useState<SelectedItemOptions>([]);

  useEffect(() => {
    if (!isOpen || !item) return;
    if (initialSelections?.length) {
      setSelected(initialSelections);
    } else {
      setSelected(getDefaultSelections(groups));
    }
  }, [isOpen, item, initialSelections, groups]);

  const linePrice = useMemo(() => {
    if (!item) return 0;
    return calculateLinePrice(item.price, groups, selected);
  }, [item, groups, selected]);

  const valid = useMemo(() => isSelectionValid(groups, selected), [groups, selected]);

  if (!isOpen || !item) return null;

  const toggleOption = (
    groupId: number,
    groupName: string,
    pricingMode: 'replace' | 'inherit' | 'add',
    option: { id?: number; name: string; price: number; is_out_of_stock?: boolean },
    maxSelect: number,
  ) => {
    if (!option.id || option.is_out_of_stock) return;
    setSelected((prev) => {
      const inGroup = prev.filter((s) => s.group_id === groupId);
      const isSelected = inGroup.some((s) => s.option_id === option.id);
      const entry = {
        group_id: groupId,
        group_name: groupName,
        option_id: option.id!,
        option_name: option.name,
        pricing_mode: pricingMode,
        price: option.price,
      };

      if (maxSelect === 1) {
        return [...prev.filter((s) => s.group_id !== groupId), entry];
      }
      if (isSelected) {
        return prev.filter((s) => !(s.group_id === groupId && s.option_id === option.id));
      }
      if (inGroup.length >= maxSelect) return prev;
      return [...prev, entry];
    });
  };

  const isOptionSelected = (groupId: number, optionId: number) =>
    selected.some((s) => s.group_id === groupId && s.option_id === optionId);

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-obsidian/50" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-1/2 top-1/2 z-[10000] w-[min(520px,95vw)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[90vh] overflow-y-auto p-5 space-y-4">
          <h3 className="text-[20px] font-bold text-obsidian">{item.name}</h3>

          {groups.map((group) => (
            <div key={group.id ?? group.name} className="space-y-2">
              <div className="text-[15px] font-bold text-obsidian">
                {group.name}
                {group.min_select > 0 && <span className="text-red-500 ms-1">*</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const selectedPill = isOptionSelected(group.id!, opt.id!);
                  const disabled = opt.is_out_of_stock;
                  let priceLabel = '';
                  if (group.pricing_mode === 'replace') {
                    priceLabel = fmt(opt.price);
                  } else if (group.pricing_mode === 'add' && opt.price > 0) {
                    priceLabel = `+${fmt(opt.price)}`;
                  }
                  return (
                    <button
                      key={opt.id ?? opt.name}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        toggleOption(
                          group.id!,
                          group.name,
                          group.pricing_mode,
                          opt,
                          group.max_select,
                        )
                      }
                      className={`rounded-full px-4 py-2 text-[14px] font-bold border transition-colors ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed border-black/10 bg-gray-100'
                          : selectedPill
                            ? 'bg-cyber-aqua text-white border-cyber-aqua'
                            : 'bg-white text-obsidian border-black/10 hover:border-cyber-aqua/50'
                      }`}
                    >
                      {opt.name}
                      {priceLabel ? ` · ${priceLabel}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-black/10 pt-4">
            <span className="text-[17px] font-bold text-obsidian">
              {t('orders.optionsTotal')}: {fmt(linePrice)}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                {t('halls.cancel')}
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={() => onConfirm(selected, linePrice)}
                className="btn-primary disabled:opacity-50"
              >
                {confirmLabel ?? t('orders.optionsAddToOrder')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
