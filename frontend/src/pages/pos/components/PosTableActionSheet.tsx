import { useTranslation } from 'react-i18next';
import { PosSideSheet } from './PosSideSheet';

export function PosTableActionSheet({
  open,
  onClose,
  onMove,
  onPrint,
  onDiscount,
  onCancelOrder,
}: {
  open: boolean;
  onClose: () => void;
  onMove: () => void;
  onPrint: () => void;
  onDiscount: () => void;
  onCancelOrder: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PosSideSheet open={open} title={t('pos.tableActions')} onClose={onClose}>
      <button type="button" className="pos-sheet-row" onClick={onMove}>
        {t('pos.moveTable')}
      </button>
      <button type="button" className="pos-sheet-row" onClick={onPrint}>
        {t('pos.print')}
      </button>
      <button type="button" className="pos-sheet-row" onClick={onDiscount}>
        {t('pos.discount')}
      </button>
      <button type="button" className="pos-sheet-row" onClick={onCancelOrder}>
        {t('pos.cancelOrder')}
      </button>
    </PosSideSheet>
  );
}
