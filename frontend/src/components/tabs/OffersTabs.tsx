'use client';

import { useTranslation } from 'react-i18next';
import { GiftIcon } from '../icons';

/** Page heading: active + regular sections are shown below in one view. */
export default function OffersTabs() {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <GiftIcon className="h-4 w-4" />
        </span>
        <span className="font-medium">{t('offers.manageHeading')}</span>
      </div>
    </div>
  );
}


