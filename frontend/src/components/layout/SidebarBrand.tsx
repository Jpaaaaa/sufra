import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_BRAND_NAME } from '../../lib/brand';
import BrandMark from './BrandMark';

function SidebarBrand() {
  const { t } = useTranslation();
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await window.sufra?.recipePrint?.getSettings?.();
        const name = s?.restaurantName?.trim() ?? '';
        if (!cancelled) setRestaurantName(name);
      } catch {
        if (!cancelled) setRestaurantName('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle =
    restaurantName && restaurantName.toLowerCase() !== APP_BRAND_NAME.toLowerCase()
      ? restaurantName
      : t('loginTagline');

  return (
    <div className="flex-shrink-0 border-b border-black/5 bg-gradient-to-l from-cyber-aqua/12 via-white to-white px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-obsidian/80">
            {APP_BRAND_NAME}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium leading-snug text-graphite" title={subtitle}>
            {subtitle}
          </p>
        </div>
        <BrandMark />
      </div>
    </div>
  );
}

export default memo(SidebarBrand);
