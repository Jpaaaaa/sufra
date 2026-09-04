import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface Category {
  id: number;
  name: string;
  /** When false, tab is muted — items still list under it but are not orderable. */
  is_menu_active?: boolean;
}

// Special ID for offers category
export const OFFERS_CATEGORY_ID = -1;
// Special ID for shelf items (barcode products)
export const SHELF_CATEGORY_ID = -2;

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  showOffers?: boolean;
  showShelf?: boolean;
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
  showOffers = true,
  showShelf = true,
}: CategoryTabsProps) {
  const { t } = useTranslation();
  return (
    <div 
      data-scrollable
      className="flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden pb-3 -mx-0.5 px-0.5 scroll-smooth touch-pan-x"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0, 0, 0, 0.15) transparent',
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x proximity',
        overscrollBehavior: 'contain',
        contain: 'paint',
      }}
    >
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`flex-shrink-0 snap-start rounded-xl px-4 py-3 text-[16px] font-semibold leading-tight xl:px-4 xl:py-3 xl:text-[18px] ${
          selectedCategory === null
            ? 'bg-cyber-aqua text-white shadow-sm'
            : 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white'
        }`}
      >
        {t('orders.categoryAll')}
      </button>
      {showOffers && (
        <button
          type="button"
          onClick={() => onSelectCategory(OFFERS_CATEGORY_ID)}
          className={`flex-shrink-0 snap-start rounded-xl px-4 py-3 text-[16px] font-semibold leading-tight xl:text-[18px] ${
            selectedCategory === OFFERS_CATEGORY_ID
              ? 'bg-amber-500 text-white shadow-sm'
              : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          }`}
        >
          {t('orders.categoryOffersTab')}
        </button>
      )}
      {showShelf && (
        <button
          type="button"
          onClick={() => onSelectCategory(SHELF_CATEGORY_ID)}
          className={`flex-shrink-0 snap-start rounded-xl px-4 py-3 text-[16px] font-semibold leading-tight xl:text-[18px] ${
            selectedCategory === SHELF_CATEGORY_ID
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
          }`}
        >
          {t('orders.categoryShelvesTab')}
        </button>
      )}
      {categories.map((cat) => {
        const inactive = cat.is_menu_active === false;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            title={inactive ? t('orders.categoryInactiveTitle') : undefined}
            className={`flex-shrink-0 snap-start rounded-xl px-4 py-3 text-[16px] font-semibold leading-tight xl:text-[18px] ${
              selectedCategory === cat.id
                ? inactive
                  ? 'bg-amber-600/90 text-white shadow-sm ring-2 ring-amber-300/50'
                  : 'bg-cyber-aqua text-white shadow-sm'
                : inactive
                  ? 'border border-amber-200 bg-amber-50/90 text-amber-900/80 hover:bg-amber-100'
                  : 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white'
            }`}
          >
            {cat.name}
            {inactive ? (
              <span className="mr-1 text-[11px] font-bold opacity-90" aria-hidden>
                {' '}
                {t('orders.categoryUnavailableSuffix')}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

