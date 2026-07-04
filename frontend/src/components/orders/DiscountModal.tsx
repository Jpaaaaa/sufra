import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';
import { useOrderMoney } from '../../hooks/useOrderMoney';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableSubtotal: number;
  tableDiscount: number;
  appliedDiscount: { percent: number; amount: number } | null;
  onDiscountChange: (discount: number) => void;
  onApplyDiscount: () => void;
}

export const DiscountModal = memo(function DiscountModal({
  isOpen,
  onClose,
  tableSubtotal,
  tableDiscount,
  appliedDiscount,
  onDiscountChange,
  onApplyDiscount,
}: DiscountModalProps) {
  const { t } = useTranslation();
  const fmt = useOrderMoney();
  const [isPercentage, setIsPercentage] = useState(false);
  const discountPercentage = tableSubtotal > 0 ? (tableDiscount / tableSubtotal) * 100 : 0;

  const handleDiscountValueChange = (value: number) => {
    if (isPercentage) {
      const percentageValue = Math.max(0, Math.min(100, value));
      const calculatedDiscount = (tableSubtotal * percentageValue) / 100;
      onDiscountChange(Math.round(calculatedDiscount));
    } else {
      const amountValue = Math.max(0, Math.min(tableSubtotal, value));
      onDiscountChange(Math.round(amountValue));
    }
  };

  const handleConfirm = async () => {
    await onApplyDiscount();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const discountValueField = useGlobalNumericField(
    isPercentage ? String(Math.round(discountPercentage)) : String(tableDiscount || ''),
    (s) => handleDiscountValueChange(Number(s) || 0),
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-obsidian/50"
        onClick={handleCancel}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[10000] w-[min(340px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-4 text-[18px] font-bold text-obsidian">{t('orders.tableDiscount')}</h3>

        <div className="space-y-4">
          {/* Toggle % / Amount */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPercentage(!isPercentage)}
              className={`rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors ${
                isPercentage
                  ? 'bg-cyber-aqua/20 text-cyber-aqua'
                  : 'bg-olive-gold/20 text-olive-gold'
              }`}
            >
              {isPercentage ? '%' : t('orders.currency')}
            </button>
            {isPercentage ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(discountPercentage)}
                  onChange={(e) => handleDiscountValueChange(Number(e.target.value) || 0)}
                  onFocus={discountValueField.onFocus}
                  className="w-20 rounded-lg border border-black/15 bg-white px-3 py-2 text-[16px] font-semibold text-obsidian"
                />
                <span className="text-[14px] font-bold text-obsidian">%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={discountPercentage}
                  onChange={(e) => handleDiscountValueChange(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  min="0"
                  max={tableSubtotal}
                  value={tableDiscount || ''}
                  onChange={(e) => handleDiscountValueChange(Number(e.target.value) || 0)}
                  onFocus={discountValueField.onFocus}
                  placeholder="0"
                  className="w-24 rounded-lg border border-black/15 bg-white px-3 py-2 text-[16px] font-semibold text-obsidian"
                />
                <span className="text-[14px] font-bold text-obsidian">{t('orders.currency')}</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {(tableDiscount > 0 || appliedDiscount) && (
            <div className="rounded-lg bg-cyber-aqua/10 px-4 py-2 text-center">
              <span className="text-[15px] font-bold text-cyber-aqua">
                -{fmt(tableDiscount)}
                {isPercentage && ` (${Math.round(discountPercentage)}%)`}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] font-bold text-obsidian"
            >
              {t('orders.btnCancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 rounded-xl bg-cyber-aqua px-4 py-3 text-[16px] font-bold text-white hover:bg-cyber-aqua/90"
            >
              {tableDiscount === 0 && appliedDiscount
                ? t('orders.discountRemoveApplied')
                : t('orders.discountApplyAction')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
