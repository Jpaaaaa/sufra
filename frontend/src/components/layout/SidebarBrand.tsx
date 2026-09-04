import { memo, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_BRAND_NAME } from '../../lib/brand';
import BrandMark from './BrandMark';

function SidebarBrand({
  collapsed = false,
  toggle,
  onBrandClick,
}: {
  collapsed?: boolean;
  toggle?: ReactNode;
  onBrandClick?: () => void;
}) {
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
    <div className={`flex-shrink-0 border-b border-black/[0.06] py-3 ${collapsed ? 'px-1.5' : 'px-3'}`}>
      {collapsed ? (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onBrandClick}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-aqua/50"
            aria-label={t('layout.pinSidebar')}
          >
            <BrandMark className="h-10 w-10" />
          </button>
          {toggle}
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBrandClick}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-aqua/50"
            aria-label={collapsed ? t('layout.pinSidebar') : t('layout.unpinSidebar')}
          >
            <BrandMark className="h-10 w-10" />
          </button>
          <div className="min-w-0 flex-1 text-start">
            <p className="truncate text-[14px] font-semibold leading-tight tracking-tight text-obsidian">
              {APP_BRAND_NAME}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-graphite" title={subtitle}>
              {subtitle}
            </p>
          </div>
          {toggle}
        </div>
      )}
    </div>
  );
}

export default memo(SidebarBrand);
