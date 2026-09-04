import { memo, startTransition, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Item } from '../../hooks/useItems';
import { Category } from '../../hooks/useOrderModal';
import type { Kitchen } from '../../utils';
import { CategoryTabs } from './CategoryTabs';
import { ItemSelector } from './ItemSelector';
import { useOffers } from '../../hooks/useOffers';
import { buildCategoryMenuActiveMap } from '../../utils/item-order-availability';

interface OrderModalMenuProps {
  items: Item[];
  allMenuItems?: Item[];
  kitchens?: Kitchen[];
  categories: Category[];
  selectedCategory: number | null;
  searchQuery: string;
  loadingItems: boolean;
  editingOrder: { id: number } | null;
  onSetSelectedCategory: (category: number | null) => void;
  onSetSearchQuery: (query: string) => void;
  onAddItem: (item: Item, extras?: import('../../hooks/cart-item-utils').AddItemExtras) => void;
  onAddShelfItemByBarcode?: (barcode: string) => void;
  onCancelEdit: () => void;
}

function OrderModalMenuComponent({
  items,
  allMenuItems = [],
  kitchens,
  categories,
  selectedCategory,
  searchQuery,
  loadingItems,
  editingOrder,
  onSetSelectedCategory,
  onSetSearchQuery,
  onAddItem,
  onCancelEdit,
}: OrderModalMenuProps) {
  const { t } = useTranslation();
  const offers = useOffers();
  const categoryMenuActiveById = useMemo(
    () => buildCategoryMenuActiveMap(categories),
    [categories],
  );

  const kitchenNameById = useMemo(() => {
    if (!kitchens?.length) return undefined;
    return new Map(kitchens.map((k) => [k.id, k.name]));
  }, [kitchens]);

  return (
    <div data-order-menu className="flex-1 border-l border-black/5 p-4 overflow-hidden flex flex-col min-w-0 min-h-0 md:p-0.5 xl:p-4">
      <div className="mb-3 flex items-center justify-between flex-shrink-0 md:mb-0 xl:mb-3">
        <h3 className="text-[18px] sm:text-[19px] md:text-[11px] xl:text-[19px] leading-tight font-semibold text-obsidian">
          {t('orders.menuModalTitle')}
        </h3>
        <Link
          to="/items"
          className="text-[14px] sm:text-[15px] md:text-[11px] xl:text-[15px] leading-relaxed font-bold text-cyber-aqua hover:text-cyber-aqua/80 underline whitespace-nowrap"
        >
          {t('orders.menuModalManageLink')}
        </Link>
      </div>

      {/* Edit Mode Banner */}
      {editingOrder && (
        <div className="mb-3 rounded-xl border border-cyber-aqua bg-cyber-aqua/10 p-3 shadow-sm flex-shrink-0 md:mb-0 md:p-0.5 md:rounded-md xl:mb-3 xl:p-3 xl:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[15px] sm:text-[16px] md:text-[11px] xl:text-[16px] leading-normal font-bold text-cyber-aqua truncate">
              {t('orders.menuModalEditing', { id: editingOrder.id })}
            </span>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-black/5 bg-white px-3 py-2 text-[14px] sm:text-[15px] md:rounded-md md:px-1 md:py-0 md:text-[11px] xl:px-3 xl:py-2 xl:text-[15px] leading-relaxed font-bold text-obsidian hover:bg-cloud-soft-white whitespace-nowrap"
            >
              {t('orders.btnCancel')}
            </button>
          </div>
        </div>
      )}

      {/* Category filters + Search - row on tablet vertical */}
      <div data-order-menu-filters className="flex flex-col gap-2 flex-shrink-0 mb-2 md:mb-0 xl:mb-2 xl:gap-2">
        <div className="flex-shrink-0">
          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={onSetSelectedCategory}
            showOffers={true}
          />
        </div>
        <div className="relative flex-shrink-0">
          <input
            type="text"
            placeholder={t('orders.menuModalSearchPlaceholder')}
            className="w-full rounded-xl border border-black/5 bg-white px-4 py-3 pr-10 text-[17px] sm:text-[18px] md:px-1.5 md:py-0.5 md:pr-6 md:text-[11px] md:rounded-md xl:px-4 xl:py-3 xl:pr-10 xl:text-[18px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
            value={searchQuery}
            onChange={(e) => {
              startTransition(() => {
                onSetSearchQuery(e.target.value);
              });
            }}
          />
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-obsidian/40 md:right-1.5 md:w-3 md:h-3 xl:right-4 xl:w-5 xl:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Items Grid - Independently Scrollable */}
      <div
        data-scrollable
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 md:pr-0.5 xl:pr-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
          overscrollBehavior: 'contain',
        }}
        onWheel={(e) => {
          // Allow scrolling within this container
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          // Allow touch scrolling within this container
          e.stopPropagation();
        }}
      >
        <ItemSelector
          items={items}
          allMenuItems={allMenuItems}
          categoryMenuActiveById={categoryMenuActiveById}
          kitchenNameById={kitchenNameById}
          loading={loadingItems}
          onAddItem={onAddItem}
          offers={offers}
        />
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const OrderModalMenu = memo(OrderModalMenuComponent);
