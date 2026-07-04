'use client';

import { useTranslation } from 'react-i18next';
import { useShelvesSell } from '../../hooks/useShelvesSell';
import ShelfTodaySalesTable from './ShelfTodaySalesTable';

interface ShelfSellViewProps {
  onSaleComplete?: () => void;
}

export default function ShelfSellView({}: ShelfSellViewProps) {
  const { t } = useTranslation();
  const { todaySales, loading: salesLoading } = useShelvesSell();

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
          {t('shelves.sellTitle')}
        </h2>
        <p className="text-[15px] leading-normal font-light text-obsidian/70">
          {t('shelves.sellSubtitle')}
        </p>
      </div>

      <ShelfTodaySalesTable
        sales={todaySales}
        loading={salesLoading}
      />
    </div>
  );
}
