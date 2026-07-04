import { useTranslation } from 'react-i18next';
import { Hall, TableEntity } from '../../utils';
import { ExistingOrder } from '../../hooks/useOrderModal';

interface OrderModalHeaderProps {
  hall: Hall;
  table: TableEntity;
  existingOrders: ExistingOrder[];
  onClose: () => void;
  onPrintReceipt: () => void;
  onClearTable: () => void;
}

export function OrderModalHeader({
  hall,
  table,
  existingOrders,
  onClose,
  onPrintReceipt,
  onClearTable,
}: OrderModalHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="glass-matte flex items-center justify-between border-b border-black/5 px-5 py-4 relative flex-shrink-0 md:px-1 md:py-0 xl:px-5 xl:py-4">
      <div className="flex-1 min-w-0 mr-4 md:mr-0.5 xl:mr-4">
        <h2 className="text-[20px] sm:text-[22px] md:text-[11px] xl:text-[22px] leading-tight font-semibold text-obsidian truncate">
          {table.name} - {hall.name}
          {hall.floor && (
            <span className="text-obsidian/70 font-normal md:text-[11px] xl:text-base">
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
              onClick={onPrintReceipt}
              className="rounded-xl bg-graphite px-4 py-3 text-[16px] sm:text-[17px] md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:px-4 xl:py-3 xl:text-[17px] leading-normal font-bold text-white hover:bg-graphite/90 whitespace-nowrap"
            >
              {t('orders.headerPrint')}
            </button>
            <button
              type="button"
              onClick={onClearTable}
              className="rounded-xl bg-red-600 px-4 py-3 text-[16px] sm:text-[17px] md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:px-4 xl:py-3 xl:text-[17px] leading-normal font-bold text-white hover:bg-red-700 whitespace-nowrap"
            >
              {t('orders.headerClearTable')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-black/5 bg-white px-4 py-3 text-[16px] sm:text-[17px] md:rounded-md md:px-0.5 md:py-0 md:text-[11px] xl:px-4 xl:py-3 xl:text-[17px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white whitespace-nowrap"
        >
          ✕
        </button>
      </div>
    </header>
  );
}

