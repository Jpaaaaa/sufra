import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NumericKeypad from '../../../components/ui/NumericKeypad';
import { PosSideSheet } from './PosSideSheet';

const PRESETS = [5, 10, 15, 20, 25];

export function PosDiscountSheet({
  open,
  onClose,
  tableSubtotal,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  tableSubtotal: number;
  onApply: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [percent, setPercent] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('percent');
    setPercent(null);
    setDraft('');
  }, [open]);

  const amount = useMemo(() => {
    if (mode === 'percent' && percent != null) {
      return Math.round((tableSubtotal * percent) / 100);
    }
    const n = Math.round(Number(draft) || 0);
    return Math.min(Math.max(0, n), Math.round(tableSubtotal));
  }, [mode, percent, draft, tableSubtotal]);

  const after = Math.max(0, Math.round(tableSubtotal) - amount);

  const apply = () => onApply(amount);

  return (
    <PosSideSheet
      open={open}
      wide
      title={t('pos.tableDiscount')}
      onClose={onClose}
      footer={
        <div className="pos-discount-actions">
          <button type="button" className="pos-cart-discount" onClick={() => onApply(0)}>
            {t('pos.removeDiscount')}
          </button>
          <button type="button" className="pos-primary" onClick={apply}>
            {t('pos.apply')}
          </button>
        </div>
      }
    >
      <div className="pos-discount">
        <div className="pos-discount-preview">
          <div className="pos-discount-preview-row">
            <span>{t('pos.subtotal')}</span>
            <span className="tabular-nums">{Math.round(tableSubtotal)}</span>
          </div>
          <div className="pos-discount-preview-row">
            <span>{t('pos.discountValue')}</span>
            <span className="tabular-nums pos-discount-minus">−{amount}</span>
          </div>
          <div className="pos-discount-preview-row is-total">
            <span>{t('pos.afterDiscount')}</span>
            <span className="tabular-nums">{after}</span>
          </div>
        </div>

        <div className="pos-discount-tabs">
          <button
            type="button"
            className={mode === 'percent' ? 'is-on' : ''}
            onClick={() => setMode('percent')}
          >
            {t('pos.discountPercent')}
          </button>
          <button
            type="button"
            className={mode === 'amount' ? 'is-on' : ''}
            onClick={() => {
              setMode('amount');
              setPercent(null);
            }}
          >
            {t('pos.discountAmount')}
          </button>
        </div>

        {mode === 'percent' ? (
          <div className="pos-discount-grid">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`pos-discount-chip tabular-nums ${percent === p ? 'is-on' : ''}`}
                onClick={() => setPercent(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        ) : (
          <div className="pos-discount-amount">
            <div className="pos-discount-draft tabular-nums">{draft || '0'}</div>
            <NumericKeypad value={draft} onChange={setDraft} />
          </div>
        )}
      </div>
    </PosSideSheet>
  );
}
