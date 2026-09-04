import { useEffect, useState, useMemo } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import {
  normalizeCategoryRow,
  normalizeItemRow,
  sortCategoriesForOrderMenu,
} from '../utils/menu-filters';
import type { Item } from './useItems';
import type { ShelfItem } from './useShelves';
import type { Category } from './useOrderModalTypes';
import type { Category as AdminCategory } from './useCategories';
import type { ExistingOrder } from './useOrderModalTypes';
import { useDebounce } from './useDebounce';
import { showToast } from '../components/ui/Toast';
import { OFFERS_CATEGORY_ID, SHELF_CATEGORY_ID } from '../components/orders/CategoryTabs';
import type { TableEntity } from '../utils';
import type { useOffers } from './useOffers';
import { useKitchensStore } from '../../stores/kitchensStore';
import { buildOffersCategoryItems } from '../lib/offers/build-offers-category-items';

function parseOrdersWithDiscount(loadedOrders: any[]) {
  return loadedOrders
    .filter((o: any) => {
      const hasDiscount = o.globalDiscount &&
        (typeof o.globalDiscount === 'object' || typeof o.globalDiscount === 'string') &&
        (o.globalDiscount.percent !== undefined || (typeof o.globalDiscount === 'string' && o.globalDiscount.length > 0));
      if (!hasDiscount) return false;
      let discountObj = o.globalDiscount;
      if (typeof discountObj === 'string') {
        try {
          discountObj = JSON.parse(discountObj);
        } catch {
          return false;
        }
      }
      return discountObj && discountObj.percent && discountObj.amount;
    })
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useOrderModalData(
  table: TableEntity,
  selectedCategory: number | null,
  searchQuery: string,
  offers: ReturnType<typeof useOffers>
) {
  const [items, setItems] = useState<Item[]>([]);
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const kitchens = useKitchensStore((state) => state.kitchens);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [existingOrders, setExistingOrders] = useState<ExistingOrder[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<{ percent: number; amount: number } | null>(null);
  const [tableDiscount, setTableDiscount] = useState(0);

  const debouncedSearch = useDebounce(searchQuery, 50);

  useEffect(() => {
    const loadData = async () => {
      setLoadingItems(true);
      setLoadingOrders(true);
      try {
        const serverUrl = getServerUrl();
        const [itemsData, categoriesData, ordersData, shelvesData] = await Promise.all([
          fetchJson<any[]>(`${serverUrl}/items`),
          fetchJson<any[]>(`${serverUrl}/categories`),
          fetchJson<any[]>(`${serverUrl}/orders/dine-in/table/${table.id}`),
          fetchJson<ShelfItem[]>(`${serverUrl}/shelves`),
          useKitchensStore.getState().loadKitchens(),
        ]);
        setItems(itemsData.map(normalizeItemRow));
        setCategories(categoriesData.map(normalizeCategoryRow));
        setShelfItems(shelvesData || []);
        const loadedOrders = ordersData.filter((o: any) => o.status === 'pending' || o.status === 'printed');
        setExistingOrders(loadedOrders);

        const ordersWithDiscount = parseOrdersWithDiscount(loadedOrders);
        if (ordersWithDiscount.length > 0) {
          const discount = ordersWithDiscount[0].globalDiscount;
          const parsed = typeof discount === 'string' ? JSON.parse(discount) : discount;
          if (parsed?.percent && parsed?.amount) {
            setAppliedDiscount({ percent: parsed.percent, amount: parsed.amount });
            setTableDiscount(parsed.amount);
          } else {
            setAppliedDiscount(null);
            setTableDiscount(0);
          }
        } else {
          setAppliedDiscount(null);
          setTableDiscount(0);
        }
      } catch (e) {
        console.error('Failed to load data:', e);
        showToast('فشل تحميل البيانات', 'error');
      } finally {
        setLoadingItems(false);
        setLoadingOrders(false);
      }
    };
    void loadData();
  }, [table.id]);

  const menuCategories = useMemo(
    () => sortCategoriesForOrderMenu(categories as AdminCategory[]),
    [categories],
  );

  const menuItems = useMemo(() => items, [items]);

  const filteredItems = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const hasSearch = searchLower.length > 0;

    if (selectedCategory === OFFERS_CATEGORY_ID) {
      const uniqueItems = buildOffersCategoryItems(menuItems, offers);
      if (hasSearch) {
        return uniqueItems.filter((item) => item.name.toLowerCase().includes(searchLower));
      }
      return uniqueItems;
    }

    if (selectedCategory === SHELF_CATEGORY_ID) {
      const shelfItemsAsItems: (Item & { _shelfItem?: ShelfItem })[] = shelfItems
        .filter((si) => si.quantity > 0)
        .map((si) => ({
          id: si.id + 1000000,
          name: si.name,
          price: si.price,
          categoryId: SHELF_CATEGORY_ID,
          kitchen_id: null,
          _shelfItem: si,
        }));
      if (hasSearch) {
        return shelfItemsAsItems.filter((item) => item.name.toLowerCase().includes(searchLower));
      }
      return shelfItemsAsItems.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }

    if (menuItems.length === 0) return [];
    if (selectedCategory === null && !hasSearch) return menuItems;

    return menuItems.filter((item) => {
      if (selectedCategory !== null && item.categoryId !== selectedCategory) return false;
      if (hasSearch && !item.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [
    menuItems,
    shelfItems,
    selectedCategory,
    debouncedSearch,
    offers.featuredItems,
    offers.combos,
    offers.happyHours,
  ]);

  return {
    items: menuItems,
    shelfItems,
    categories: menuCategories,
    kitchens,
    loadingItems,
    loadingOrders,
    existingOrders,
    setExistingOrders,
    filteredItems,
    appliedDiscount,
    setAppliedDiscount,
    tableDiscount,
    setTableDiscount,
  };
}
