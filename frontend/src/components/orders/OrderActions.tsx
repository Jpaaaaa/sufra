import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface OrderActionsProps {
  subtotal: number;
  total: number;
  discountAmount?: number;
  isEditing: boolean;
  hasItems: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export const OrderActions = memo(function OrderActions({
  subtotal,
  total,
  discountAmount = 0,
  isEditing,
  hasItems,
  onSubmit,
  onCancel,
}: OrderActionsProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const hasDiscount = discountAmount > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {hasDiscount ? (
          <>
            <div className="flex items-center justify-between text-[13px] text-obsidian/55">
              <span>{t('orders.totalBeforeDiscount')}</span>
              <span className="tabular-nums font-medium text-obsidian/80">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-obsidian">{t('orders.totalAfterDiscount')}</span>
              <span className="text-[20px] font-bold tabular-nums text-cyber-aqua">{fmt(total)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-obsidian/45">{t('orders.subtotalShort')}</div>
              <div className="text-[13px] tabular-nums text-obsidian/60">{fmt(subtotal)}</div>
            </div>
            <div className="text-left">
              <div className="text-[12px] font-medium text-obsidian/45">{t('orders.totalGrand')}</div>
              <div className="text-[22px] font-bold leading-none tabular-nums text-cyber-aqua">{fmt(total)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-black/10 bg-white px-4 py-3 text-[14px] font-bold text-obsidian/70 hover:bg-black/[0.03] hover:text-obsidian"
        >
          {t('orders.btnCancel')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasItems}
          className="flex-1 rounded-xl bg-cyber-aqua px-4 py-3 text-[15px] font-bold text-white shadow-sm hover:bg-cyber-aqua/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isEditing ? t('orders.btnSaveChanges') : t('orders.btnConfirmOrder')}
        </button>
      </div>
    </div>
  );
});
