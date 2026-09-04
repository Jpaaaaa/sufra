import { useTranslation } from 'react-i18next';
import { Hall, TableEntity } from '../../utils';
import { ExistingOrder } from '../../hooks/useOrderModal';
import { PrinterIcon, ReceiptIcon } from '../icons';

interface OrderModalHeaderProps {
  hall: Hall;
  table: TableEntity;
  existingOrders: ExistingOrder[];
  onClose: () => void;
  onPrintKitchen: () => void;
  onPrintInvoice: () => void;
  onClearTable: () => void;
}

export function OrderModalHeader({
  hall,
  table,
  existingOrders,
  onClose,
  onPrintKitchen,
  onPrintInvoice,
  onClearTable,
}: OrderModalHeaderProps) {
  const { t } = useTranslation();
  const actionBtnClass =
    'flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-[16px] sm:text-[17px] xl:px-4 xl:py-3 xl:text-[17px] leading-normal font-bold text-white whitespace-nowrap';

  return (
    <header className="glass-matte flex items-center justify-between border-b border-black/5 px-5 py-4 relative flex-shrink-0 xl:px-5 xl:py-4">
      <div className="flex-1 min-w-0 mr-4 md:mr-0.5 xl:mr-4">
        <h2 className="text-[20px] sm:text-[22px] xl:text-[22px] leading-tight font-semibold text-obsidian truncate">
          {table.name} - {hall.name}
          {hall.floor && (
            <span className="text-obsidian/70 font-normal xl:text-base">
              {t('orders.headerFloor', { name: hall.floor.name })}
            </span>
          )}
        </h2>
      </div>
      <div className="flex gap-3 flex-shrink-0 md:gap-0.5 xl:gap-3">
        {existingOrders.length > 0 && (
          <>
            <button
              type="button"
              onClick={onPrintKitchen}
              className={`${actionBtnClass} bg-graphite hover:bg-graphite/90`}
            >
              <PrinterIcon className="w-4 h-4 md:w-3 md:h-3 xl:w-4 xl:h-4 flex-shrink-0" />
              {t('orders.headerPrintKitchen')}
            </button>
            <button
              type="button"
              onClick={onPrintInvoice}
              className={`${actionBtnClass} bg-blue-600 hover:bg-blue-700`}
            >
              <ReceiptIcon className="w-4 h-4 md:w-3 md:h-3 xl:w-4 xl:h-4 flex-shrink-0" />
              {t('orders.headerPrintInvoice')}
            </button>
            <button
              type="button"
              onClick={onClearTable}
              className={`${actionBtnClass} bg-red-600 hover:bg-red-700`}
            >
              {t('orders.headerClearTable')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-black/5 bg-white px-4 py-3 text-[16px] sm:text-[17px] xl:px-4 xl:py-3 xl:text-[17px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white whitespace-nowrap"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
