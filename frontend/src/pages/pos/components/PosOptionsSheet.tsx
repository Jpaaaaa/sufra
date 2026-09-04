import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../../../hooks/useItems';
import {
  calculateLinePrice,
  getDefaultSelections,
  isSelectionValid,
  itemHasOptionGroups,
  type ItemOptionGroup,
  type SelectedItemOptions,
} from '../../../lib/item-options';
import { PosSideSheet } from './PosSideSheet';

export function PosOptionsSheet({
  open,
  item,
  onClose,
  onConfirm,
}: {
  open: boolean;
  item: Item | null;
  onClose: () => void;
  onConfirm: (selected: SelectedItemOptions) => void;
}) {
  const { t } = useTranslation();
  const groups: ItemOptionGroup[] = item?.option_groups ?? [];
  const [selected, setSelected] = useState<SelectedItemOptions>(() => getDefaultSelections(groups));

  const price = item ? calculateLinePrice(item.price, groups, selected) : 0;
  const valid = isSelectionValid(groups, selected);

  const toggle = (group: ItemOptionGroup, gi: number, optionIndex: number) => {
    const opt = group.options[optionIndex];
    if (!opt || opt.is_out_of_stock) return;
    const groupId = group.id ?? -(gi + 1);
    const optionId = opt.id ?? -(optionIndex + 1);
    const row = {
      group_id: groupId,
      group_name: group.name,
      option_id: optionId,
      option_name: opt.name,
      pricing_mode: group.pricing_mode,
      price: opt.price,
    };
    setSelected((prev) => {
      const inGroup = prev.filter((s) => s.group_id === groupId);
      const already = inGroup.some((s) => s.option_id === optionId);
      const others = prev.filter((s) => s.group_id !== groupId);
      if (group.max_select === 1) {
        return [...others, row];
      }
      if (already) {
        return prev.filter((s) => !(s.group_id === groupId && s.option_id === optionId));
      }
      if (inGroup.length >= group.max_select) return prev;
      return [...prev, row];
    });
  };

  if (!item || !itemHasOptionGroups(item)) {
    return <PosSideSheet open={open} wide title={t('pos.options')} onClose={onClose}>{null}</PosSideSheet>;
  }

  return (
    <PosSideSheet
      open={open}
      wide
      title={item.name}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="pos-primary tabular-nums"
          disabled={!valid}
          onClick={() => onConfirm(selected)}
        >
          {t('pos.add')} · {price.toFixed(0)}
        </button>
      }
    >
      {groups.map((group, gi) => (
        <div key={group.id ?? gi}>
          <div className="px-4 py-2 text-[13px] font-bold text-graphite">{group.name}</div>
          {group.options.map((opt, oi) => {
            const groupId = group.id ?? -(gi + 1);
            const optionId = opt.id ?? -(oi + 1);
            const on = selected.some((s) => s.group_id === groupId && s.option_id === optionId);
            return (
              <button
                key={optionId}
                type="button"
                disabled={opt.is_out_of_stock}
                className={`pos-sheet-row ${on ? 'bg-cyber-aqua/15' : ''}`}
                onClick={() => toggle(group, gi, oi)}
              >
                <span className="flex-1">{opt.name}</span>
                <span className="tabular-nums text-[15px] font-bold">{opt.price}</span>
              </button>
            );
          })}
        </div>
      ))}
    </PosSideSheet>
  );
}
