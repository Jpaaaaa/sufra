import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface OrderActionsProps {
  subtotal: number;
  total: number;
  /** When > 0, show before/after discount breakdown */
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
    <>
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm mb-3 md:p-0.5 md:mb-0.5 md:rounded-md xl:p-2.5 xl:mb-2 xl:rounded-xl">
        {hasDiscount ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between md:gap-0.5">
              <span className="text-[15px] leading-normal font-medium text-obsidian/70 md:text-[11px] xl:text-[15px]">
                {t('orders.totalBeforeDiscount')}
              </span>
              <span className="text-[17px] leading-normal font-semibold text-obsidian md:text-[11px] xl:text-[17px]">
                {fmt(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-black/5 pt-2 md:pt-0.5 xl:pt-2">
              <span className="text-[16px] leading-normal font-bold text-obsidian md:text-[11px] xl:text-[16px]">
                {t('orders.totalAfterDiscount')}
              </span>
              <span className="text-[22px] md:text-[11px] xl:text-[18px] leading-normal font-bold text-cyber-aqua">
                {fmt(total)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 justify-between md:gap-0.5 xl:gap-4">
            <div className="flex items-center gap-3 md:gap-0.5 xl:gap-2">
              <span className="text-[16px] leading-normal font-medium text-obsidian whitespace-nowrap md:text-[11px] xl:text-[13px]">
                {t('orders.subtotalShort')}
              </span>
              <span className="text-[18px] leading-normal font-semibold text-obsidian whitespace-nowrap md:text-[11px] xl:text-[14px]">
                {fmt(subtotal)}
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-0.5 xl:gap-2">
              <span className="text-[16px] leading-normal font-bold text-obsidian whitespace-nowrap md:text-[11px] xl:text-[13px]">
                {t('orders.totalGrand')}
              </span>
              <span className="text-[22px] leading-normal font-bold text-cyber-aqua whitespace-nowrap md:text-[10px] xl:text-[18px]">
                {fmt(total)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-3 border-t border-black/5 mt-3 md:gap-0.5 md:pt-0.5 md:mt-0.5 xl:gap-2 xl:pt-2 xl:mt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasItems}
          className="flex-1 rounded-xl bg-cyber-aqua px-5 py-3.5 text-[18px] leading-normal font-bold text-white hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed md:rounded-md md:px-1.5 md:py-0.5 md:text-[11px] xl:px-3 xl:py-2 xl:text-[15px]"
        >
          {isEditing ? t('orders.btnSaveChanges') : t('orders.btnConfirmOrder')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-black/10 bg-white px-5 py-3.5 text-[17px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white whitespace-nowrap md:rounded-md md:px-1.5 md:py-0.5 md:text-[11px] xl:px-3 xl:py-2 xl:text-[14px]"
        >
          {t('orders.btnCancel')}
        </button>
      </div>
    </>
  );
});

