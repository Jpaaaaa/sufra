'use client';

import { useTranslation } from 'react-i18next';
import type { Item } from '../../hooks/useItems';

const pillClass =
  'inline-flex items-center gap-1 text-[9px] font-bold text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded-full';

export default function ItemAdminBadges({ item }: { item: Item }) {
  const { t } = useTranslation();
  const hidden = item.hidden_from_menu ?? false;
  const oos = item.is_out_of_stock ?? false;

  return (
    <>
      {hidden && (
        <span className={pillClass} title={t('catalog.badgeHiddenTitle')}>
          {t('catalog.badgeHidden')}
        </span>
      )}
      {oos && (
        <span className={pillClass} title={t('catalog.badgeOosTitle')}>
          {t('catalog.badgeOos')}
        </span>
      )}
    </>
  );
}
