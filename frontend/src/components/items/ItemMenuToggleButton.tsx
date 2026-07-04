'use client';

import { useTranslation } from 'react-i18next';
import type { Item } from '../../hooks/useItems';

interface ItemMenuToggleButtonProps {
  item: Item;
  loading: boolean;
  onToggle: (item: Item) => void;
}

export default function ItemMenuToggleButton({ item, loading, onToggle }: ItemMenuToggleButtonProps) {
  const { t } = useTranslation();
  const hidden = item.hidden_from_menu ?? false;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => onToggle(item)}
      className={`mt-3 w-full rounded-soft-lg py-2.5 text-[12px] font-bold transition-colors ${
        hidden
          ? 'border border-cyber-aqua/35 bg-cyber-aqua/10 text-cyber-aqua hover:bg-cyber-aqua/15'
          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
      }`}
    >
      {hidden ? t('catalog.showInOrderMenu') : t('catalog.hideFromOrderMenu')}
    </button>
  );
}
