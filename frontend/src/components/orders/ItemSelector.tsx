import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';
import { useOffers, type DailyDeal, type HappyHour, type ScheduledOffer } from '../../hooks/useOffers';
import { getServerUrl } from '../../lib/server-config';
import { showToast } from '../ui/Toast';
import {
  getItemOrderAvailability,
  toastMessageForUnavailable,
} from '../../utils/item-order-availability';
import { enrichItemWithOffers, isHappyHourActiveNow } from '../../utils/offer-pricing';

const LONG_PRESS_MS = 450;

function PlaceholderIcon() {
  return (
    <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="2.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

interface ItemSelectorProps {
  items: Item[];
  allMenuItems?: Item[];
  /** Category id → whether the category is active on the order menu. */
  categoryMenuActiveById?: Map<number, boolean>;
  /** Kitchen id → display name (from `/kitchens`). */
  kitchenNameById?: Map<number, string>;
  loading: boolean;
  onAddItem: (item: Item, shelfItem?: unknown, offerDisplayName?: string) => void;
  offers?: ReturnType<typeof useOffers>;
}

// Memoized item button to prevent unnecessary re-renders
const ItemButton = memo(function ItemButton({ 
  item, 
  onAddItem,
  offers,
  allMenuItems = [],
  categoryMenuActiveById,
  kitchenNameById,
}: { 
  item: Item; 
  onAddItem: (item: Item, shelfItem?: unknown, offerDisplayName?: string) => void;
  offers?: ReturnType<typeof useOffers>;
  allMenuItems?: Item[];
  categoryMenuActiveById?: Map<number, boolean>;
  kitchenNameById?: Map<number, string>;
}) {
  const [showDetailOverlay, setShowDetailOverlay] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enrichedItem = useMemo(() => enrichItemWithOffers(item, offers), [item, offers]);
  const description = enrichedItem.description?.trim() || '';

  const isFeatured = enrichedItem.is_featured || false;
  const isCombo = enrichedItem.id < 0 || (enrichedItem as any)._isCombo;
  const hasOffer =
    enrichedItem.original_price !== undefined && enrichedItem.original_price !== enrichedItem.price;

  const { available: canOrder, reason: unavailableReason } = useMemo(
    () => getItemOrderAvailability(enrichedItem, categoryMenuActiveById),
    [enrichedItem, categoryMenuActiveById],
  );
  const isUnavailable = !canOrder;

  const kitchenName =
    enrichedItem.kitchen_id != null && kitchenNameById
      ? kitchenNameById.get(enrichedItem.kitchen_id)
      : undefined;

  // Get offer type and detail data (for hold-to-show overlay)
  let offerType = '';
  let comboDetails: string[] = [];
  let dailyDeal: DailyDeal | undefined = undefined;
  let activeHappyHour: HappyHour | undefined;
  let scheduledOffer: ScheduledOffer | undefined;
  let comboData: { combo_name: string; combo_price: number; products: Array<{ name: string }> } | undefined;

  if (offers) {
    const dd = offers.getActiveDailyDeal();
    if (dd && dd.product_id === enrichedItem.id) {
      offerType = 'عرض اليوم';
      dailyDeal = dd;
    }
    if (!offerType) {
      const activeHappyHours = offers.happyHours.filter(
        (hh) => hh.product_id === enrichedItem.id && isHappyHourActiveNow(hh),
      );
      if (activeHappyHours.length > 0) {
        offerType = 'ساعة سعيدة';
        activeHappyHour = activeHappyHours[0];
      }
    }
    if (!offerType) {
      const activeScheduled = offers.getActiveScheduledOffers();
      const scheduled = activeScheduled.find((so) => so.product_id === enrichedItem.id);
      if (scheduled) {
        offerType = 'عرض مجدول';
        scheduledOffer = scheduled;
      }
    }
    if (isCombo) {
      const combo = offers?.combos?.find((c) => c.id === Math.abs(enrichedItem.id));
      if ((enrichedItem as any)._comboProducts && (enrichedItem as any)._comboProducts.length > 0) {
        comboDetails = (enrichedItem as any)._comboProducts.map((p: any) => p.name || p);
        if (combo)
          comboData = {
            combo_name: combo.combo_name,
            combo_price: combo.combo_price,
            products: (enrichedItem as any)._comboProducts,
          };
      } else if (combo?.products?.length) {
        comboDetails = combo.products.map((p) => p.name);
        comboData = { combo_name: combo.combo_name, combo_price: combo.combo_price, products: combo.products };
      } else if (combo && (combo.product_ids?.length ?? 0) > 0 && allMenuItems.length > 0) {
        comboDetails = (combo.product_ids || [])
          .map((pid: number) => allMenuItems.find((i) => i.id === pid)?.name)
          .filter(Boolean) as string[];
        comboData = combo
          ? { combo_name: combo.combo_name, combo_price: combo.combo_price, products: comboDetails.map((n) => ({ name: n })) }
          : undefined;
      }
    }
  }

  const hasDetailToShow = !!(description || offerType || (isCombo && comboDetails.length > 0));

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const handlePointerDown = useCallback(() => {
    if (!hasDetailToShow) return;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setShowDetailOverlay(true);
    }, LONG_PRESS_MS);
  }, [hasDetailToShow, clearLongPressTimer]);

  const handlePointerUp = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handlePointerLeave = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleClick = useCallback(() => {
    if (showDetailOverlay) {
      setShowDetailOverlay(false);
      return;
    }
    const { available, reason } = getItemOrderAvailability(enrichedItem, categoryMenuActiveById);
    if (!available && reason) {
      showToast(toastMessageForUnavailable(reason), 'error');
      return;
    }
    const offerLabel = offerType || (isCombo ? 'عرض مجمع' : undefined);
    const shelfItem = (enrichedItem as { _shelfItem?: unknown })._shelfItem;
    onAddItem(enrichedItem, shelfItem, offerLabel);
  }, [enrichedItem, categoryMenuActiveById, onAddItem, showDetailOverlay, offerType, isCombo]);
  
  return (
    <button
      key={item.id}
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
      aria-disabled={isUnavailable}
      className={`group relative flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-right shadow-sm transition-all duration-150 md:p-0 md:rounded-md xl:p-2.5 xl:rounded-xl ${isCombo ? 'min-h-[180px] md:min-h-[76px] xl:min-h-[180px]' : 'min-h-[172px] md:min-h-[70px] xl:min-h-[172px]'} ${
        isUnavailable
          ? 'opacity-60 cursor-not-allowed bg-slate-50'
          : isFeatured
          ? 'border-s-4 border-s-amber-400 hover:shadow-md hover:border-amber-200 active:scale-[0.98]'
          : isCombo
          ? 'border-s-4 border-s-purple-400 hover:shadow-md hover:border-purple-200 active:scale-[0.98]'
          : hasOffer
          ? 'border-s-4 border-s-emerald-500 hover:shadow-md hover:border-emerald-200 active:scale-[0.98]'
          : 'hover:shadow-md hover:border-cyber-aqua/40 active:scale-[0.98]'
      }`}
    >
      {/* Hold card: description or offer details overlay */}
      {showDetailOverlay && hasDetailToShow && (
        <div
          className="absolute inset-0 z-20 rounded-xl bg-obsidian/95 flex flex-col items-center justify-center p-3 text-right overflow-y-auto"
          role="dialog"
          aria-live="polite"
        >
          {(offerType || (isCombo && comboDetails.length > 0)) ? (
            <div className="w-full space-y-2 text-white/95">
              <div className="text-[17px] font-bold text-white border-b border-white/30 pb-1.5 mb-1">
                {offerType || 'عرض مجمع'}
              </div>
              {dailyDeal && (
                <>
                  <p className="text-[15px]"><span className="text-white/70">المنتج:</span> {dailyDeal.product_name ?? enrichedItem.name}</p>
                  <p className="text-[15px]"><span className="text-white/70">السعر الخاص:</span> {dailyDeal.special_price} د.ع</p>
                  <p className="text-[14px] text-white/80">التاريخ: {dailyDeal.date}</p>
                </>
              )}
              {activeHappyHour && (
                <>
                  <p className="text-[15px]"><span className="text-white/70">المنتج:</span> {activeHappyHour.product_name ?? enrichedItem.name}</p>
                  <p className="text-[15px]"><span className="text-white/70">السعر:</span> {activeHappyHour.happy_hour_price} د.ع</p>
                  <p className="text-[14px] text-white/80">من {activeHappyHour.time_start} إلى {activeHappyHour.time_end}</p>
                </>
              )}
              {scheduledOffer && (
                <>
                  <p className="text-[15px]"><span className="text-white/70">المشمول:</span> {scheduledOffer.product_name ?? scheduledOffer.combo_name ?? enrichedItem.name}</p>
                  <p className="text-[15px]"><span className="text-white/70">السعر:</span> {scheduledOffer.special_price} د.ع</p>
                  <p className="text-[14px] text-white/80">
                    من {new Date(scheduledOffer.start_datetime.replace(' ', 'T')).toLocaleString('ar-SA')} إلى {new Date(scheduledOffer.end_datetime.replace(' ', 'T')).toLocaleString('ar-SA')}
                  </p>
                </>
              )}
              {isCombo && (comboData || comboDetails.length > 0) && (
                <>
                  {comboData && <p className="text-[15px]"><span className="text-white/70">العرض:</span> {comboData.combo_name}</p>}
                  <p className="text-[15px]"><span className="text-white/70">المنتجات:</span></p>
                  <ul className="list-disc list-inside text-[14px] text-white/90 space-y-0.5 pr-2">
                    {(comboData?.products ?? comboDetails).map((p, idx) => (
                      <li key={idx}>{typeof p === 'string' ? p : (p as { name: string }).name}</li>
                    ))}
                  </ul>
                  <p className="text-[15px]"><span className="text-white/70">السعر:</span> {enrichedItem.price} د.ع</p>
                </>
              )}
            </div>
          ) : description ? (
            <p className="text-[16px] leading-relaxed text-white/95 break-words">
              {description}
            </p>
          ) : null}
          <span className="mt-3 text-[14px] text-white/60">أفلت للإغلاق</span>
        </div>
      )}
      {/* Badges Row */}
      <div className="absolute top-1 left-1 right-1 flex items-start justify-between gap-1 flex-wrap z-10">
        <div className="flex items-center gap-1 flex-wrap">
          {unavailableReason === 'stock' && (
            <span className="inline-flex items-center text-[11px] font-semibold text-gray-700 bg-white/90 backdrop-blur px-2 py-1 rounded-md shadow-sm">
              نفد
            </span>
          )}
          {unavailableReason === 'hidden' && (
            <span className="inline-flex items-center text-[11px] font-semibold text-amber-900 bg-amber-100/95 px-2 py-1 rounded-md shadow-sm">
              غير متوفر للطلب
            </span>
          )}
          {unavailableReason === 'category_inactive' && (
            <span className="inline-flex items-center text-[11px] font-semibold text-amber-900 bg-amber-100/95 px-2 py-1 rounded-md shadow-sm">
              الفئة غير متاحة
            </span>
          )}
          {!isUnavailable && isFeatured && (
            <span className="inline-flex items-center text-[11px] font-semibold text-amber-800 bg-amber-100/95 px-2 py-1 rounded-md">
              ⭐ مميز
            </span>
          )}
          {!isUnavailable && isCombo && (
            <span className="inline-flex items-center text-[11px] font-semibold text-purple-800 bg-purple-100/95 px-2 py-1 rounded-md">
              عرض مجمع
            </span>
          )}
          {!isUnavailable && hasOffer && offerType && !isCombo && (
            <span className="inline-flex items-center text-[11px] font-semibold text-emerald-800 bg-emerald-100/95 px-2 py-1 rounded-md">
              {offerType}
            </span>
          )}
        </div>
      </div>
      
      {/* Item Image or Placeholder */}
      <div className={`w-full mb-1.5 rounded-lg overflow-hidden bg-slate-100 aspect-square relative flex items-center justify-center ${isUnavailable ? 'opacity-60' : ''}`}>
        {enrichedItem.image_url ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <PlaceholderIcon />
            </div>
            <img
              src={enrichedItem.image_url.startsWith('/uploads/') 
                ? `${getServerUrl()}${enrichedItem.image_url}` 
                : enrichedItem.image_url}
              alt={enrichedItem.name}
              className="relative z-10 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </>
        ) : (
          <PlaceholderIcon />
        )}
        {isUnavailable && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <span className="text-white text-[12px] font-bold bg-gray-800/90 px-2 py-1.5 rounded-lg text-center leading-tight">
              {unavailableReason === 'stock'
                ? 'نفد'
                : unavailableReason === 'hidden'
                  ? 'غير متوفر للطلب'
                  : 'غير متاح'}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="w-full pt-1.5 md:pt-0 xl:pt-1.5">
        <div className="text-[15px] sm:text-[16px] md:text-[11px] xl:text-[16px] leading-snug font-semibold text-obsidian mb-1 line-clamp-2 break-words">
          {enrichedItem.name}
        </div>
        {kitchenName ? (
          <div className="text-[11px] sm:text-[11px] md:text-[11px] xl:text-[11px] leading-tight text-slate-500 line-clamp-1 mb-0.5">
            مطبخ {kitchenName}
          </div>
        ) : null}
        
        {/* Combo Contents */}
        {isCombo && comboDetails.length > 0 && (
          <div className="mb-1">
            <div className="text-[11px] leading-tight text-slate-500 line-clamp-2">
              {comboDetails.slice(0, 2).map((name, idx) => (
                <span key={idx}>
                  {name}
                  {idx < Math.min(comboDetails.length, 2) - 1 && ' + '}
                </span>
              ))}
              {comboDetails.length > 2 && (
                <span className="text-slate-400"> +{comboDetails.length - 2}</span>
              )}
            </div>
          </div>
        )}
        
        {/* Price Section */}
        <div className="flex flex-col items-start gap-1 mt-auto pt-2 border-t border-slate-100 md:pt-0 md:gap-0 xl:pt-2 xl:gap-1">
          {hasOffer && enrichedItem.original_price && (
            <span className="text-[12px] text-slate-400 line-through font-medium">
              {enrichedItem.original_price} د.ع
            </span>
          )}
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-[17px] sm:text-[18px] md:text-[11px] xl:text-[18px] leading-tight font-bold text-obsidian whitespace-nowrap">
              {enrichedItem.price} د.ع
            </span>
            {isCombo && (
              <span className="text-[11px] text-slate-500 font-medium">
                (مجموعة)
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

// Optimized grid for large lists - uses CSS optimizations for full screen performance
function VirtualizedItemGrid({ 
  items, 
  onAddItem,
  offers,
  allMenuItems = [],
  categoryMenuActiveById,
  kitchenNameById,
}: { 
  items: Item[]; 
  onAddItem: (item: Item, shelfItem?: unknown, offerDisplayName?: string) => void;
  offers?: ReturnType<typeof useOffers>;
  allMenuItems?: Item[];
  categoryMenuActiveById?: Map<number, boolean>;
  kitchenNameById?: Map<number, string>;
}) {
  return (
    <div 
      data-order-item-grid
      className="grid gap-3 w-full [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] md:gap-1 md:[grid-template-columns:repeat(auto-fill,minmax(68px,1fr))] xl:gap-3 xl:[grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]"
      style={{
        gridAutoRows: 'min-content',
        alignContent: 'start',
      }}
    >
      {items.map((item) => (
          <div
            key={item.id}
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: '180px 140px',
        }}
          >
            <ItemButton
              item={item}
              onAddItem={onAddItem}
              offers={offers}
              allMenuItems={allMenuItems}
              categoryMenuActiveById={categoryMenuActiveById}
              kitchenNameById={kitchenNameById}
            />
          </div>
      ))}
    </div>
  );
}

export const ItemSelector = memo(function ItemSelector({
  items,
  allMenuItems = [],
  categoryMenuActiveById,
  kitchenNameById,
  loading,
  onAddItem,
  offers,
}: ItemSelectorProps) {
  const { t } = useTranslation();
  const useVirtualization = items.length > 20;

  // Memoize the grid to prevent re-rendering when items array reference changes but content is same
  const itemsGrid = useMemo(() => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-[19px] sm:text-[20px] md:text-[11px] xl:text-[20px] leading-normal font-light text-obsidian/60">
          {t('orders.itemLoading')}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex h-full items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[19px] sm:text-[20px] md:text-[11px] xl:text-[20px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('orders.itemNoResults')}
        </div>
      );
    }

    if (useVirtualization) {
      return (
        <VirtualizedItemGrid
          items={items}
          onAddItem={onAddItem}
          offers={offers}
          allMenuItems={allMenuItems}
          categoryMenuActiveById={categoryMenuActiveById}
          kitchenNameById={kitchenNameById}
        />
      );
    }

    return (
    <div 
      data-order-item-grid
      className="grid gap-3 w-full [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] md:gap-1 md:[grid-template-columns:repeat(auto-fill,minmax(68px,1fr))] xl:gap-3 xl:[grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]"
      style={{
        gridAutoRows: 'min-content',
        alignContent: 'start',
      }}
    >
        {items.map((item) => (
          <ItemButton
            key={item.id}
            item={item}
            onAddItem={onAddItem}
            offers={offers}
            allMenuItems={allMenuItems}
            categoryMenuActiveById={categoryMenuActiveById}
            kitchenNameById={kitchenNameById}
          />
        ))}
      </div>
    );
  }, [items, allMenuItems, categoryMenuActiveById, kitchenNameById, loading, onAddItem, useVirtualization, offers, t]);

  return <div className="w-full h-full">{itemsGrid}</div>;
}, (prevProps, nextProps) => {
  // Fast path: check loading state first
  if (prevProps.loading !== nextProps.loading) return false;
  
  // Fast path: check array length
  if (prevProps.items.length !== nextProps.items.length) return false;
  
  // Fast path: check function reference
  if (prevProps.onAddItem !== nextProps.onAddItem) return false;

  if (prevProps.categoryMenuActiveById !== nextProps.categoryMenuActiveById) return false;

  if (prevProps.kitchenNameById !== nextProps.kitchenNameById) return false;
  
  // Fast path: check offers reference (if same, skip deep compare)
  if (prevProps.offers === nextProps.offers) {
    // Only compare item IDs for performance (shallow check)
    for (let i = 0; i < prevProps.items.length; i++) {
      if (prevProps.items[i].id !== nextProps.items[i].id) return false;
    }
    return true; // Same items, skip re-render
  }
  
  // Deep compare only if offers changed (rare)
  for (let i = 0; i < prevProps.items.length; i++) {
    if (prevProps.items[i].id !== nextProps.items[i].id) return false;
    if (prevProps.items[i].name !== nextProps.items[i].name) return false;
    if (prevProps.items[i].price !== nextProps.items[i].price) return false;
  }
  
  return true; // Props are equal, skip re-render
});
