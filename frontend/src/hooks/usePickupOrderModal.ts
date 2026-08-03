import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchJson, getServerUrl, Kitchen } from '../utils';
import {
  normalizeCategoryRow,
  normalizeItemRow,
  sortCategoriesForOrderMenu,
} from '../utils/menu-filters';
import type { Category as AdminCategory } from './useCategories';
import { Item } from './useItems';
import { ShelfItem } from './useShelves';
import { useDebounce } from './useDebounce';
import { showToast } from '../components/ui/Toast';
import { showPasswordDialog } from '../components/ui/PasswordDialog';
import { useAuth } from '../contexts/AuthContext';
import { useOffers } from './useOffers';
import { OFFERS_CATEGORY_ID, SHELF_CATEGORY_ID } from '../components/orders/CategoryTabs';
import { isHappyHourActiveNow } from '../utils/offer-pricing';
import { isWeekdayIncluded } from '../utils/weekdays';
import { ExistingOrder, CartItem, Category } from './useOrderModal';
import {
  type AddItemExtras,
  buildCartItem,
  cartSubtotal,
  getCartLineKey,
  updateCartLine,
  mapCartItemToOrderPayload,
  orderItemToCartLine,
} from './cart-item-utils';

export function usePickupOrderModal() {
  const { user } = useAuth();
  const offers = useOffers();
  const [items, setItems] = useState<Item[]>([]);
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [existingOrders, setExistingOrders] = useState<ExistingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [mode, setMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingOrder, setEditingOrder] = useState<ExistingOrder | null>(null);
  const [animatedOrderId, setAnimatedOrderId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [appliedDiscount, setAppliedDiscount] = useState<{ percent: number; amount: number } | null>(null);
  // Optional customer name and phone for pickup orders
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Load data (but don't load existing orders - each modal should start fresh)
  useEffect(() => {
    const loadData = async () => {
      setLoadingItems(true);
      setLoadingOrders(true);
      try {
        const serverUrl = getServerUrl();
        const [itemsData, categoriesData, kitchensData, shelvesData] = await Promise.all([
          fetchJson<any[]>(`${serverUrl}/items`),
          fetchJson<any[]>(`${serverUrl}/categories`),
          fetchJson<any[]>(`${serverUrl}/kitchens`),
          fetchJson<ShelfItem[]>(`${serverUrl}/shelves`),
        ]);
        setItems(itemsData.map(normalizeItemRow));
        setCategories(categoriesData.map(normalizeCategoryRow));
        setShelfItems(shelvesData || []);
        setKitchens(kitchensData);
        // Don't load existing orders - each modal should start fresh
        setExistingOrders([]);
      } catch (e) {
        console.error('Failed to load data:', e);
        showToast('فشل تحميل البيانات', 'error');
      } finally {
        setLoadingItems(false);
        setLoadingOrders(false);
      }
    };
    void loadData();
  }, []);

  const debouncedSearch = useDebounce(searchQuery, 50);

  const menuCategories = useMemo(
    () => sortCategoriesForOrderMenu(categories as AdminCategory[]),
    [categories],
  );

  const menuItems = useMemo(() => items, [items]);

  const filteredItems = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const hasSearch = searchLower.length > 0;
    
    if (selectedCategory === OFFERS_CATEGORY_ID) {
      const allOffersItems: Item[] = [];
      const featuredItemIds = new Set(offers.featuredItems.map(fi => fi.product_id));
      const featuredItems = menuItems.filter(item => featuredItemIds.has(item.id));
      allOffersItems.push(...featuredItems);
      
      const activeDailyDeal = offers.getActiveDailyDeal();
      const activeScheduledOffers = offers.getActiveScheduledOffers();
      const activeHappyHours = offers.happyHours.filter((hh) => isHappyHourActiveNow(hh));
      
      const offerItemIds = new Set<number>();
      if (activeDailyDeal) offerItemIds.add(activeDailyDeal.product_id);
      activeScheduledOffers.forEach(so => {
        if (so.product_id) offerItemIds.add(so.product_id);
      });
      activeHappyHours.forEach(hh => offerItemIds.add(hh.product_id));
      
      const offerItems = menuItems.filter(item => offerItemIds.has(item.id) && !featuredItemIds.has(item.id));
      allOffersItems.push(...offerItems);
      
      const activeCombos = offers.combos.filter(
        (c) => c.is_active === 1 && isWeekdayIncluded(c.weekdays),
      );
      const comboItems: any[] = activeCombos.map(combo => {
        const productList = combo.products?.length
          ? combo.products
          : (combo.product_ids || []).map((pid: number) => {
              const it = menuItems.find(i => i.id === pid);
              return { id: pid, name: it?.name ?? '?', price: it?.price ?? 0 };
            });
        const originalTotal = productList.reduce((sum: number, p: any) => sum + (p.price || 0), 0) || combo.combo_price;
        return {
          id: -combo.id,
          name: combo.combo_name,
          price: combo.combo_price,
          categoryId: OFFERS_CATEGORY_ID,
          kitchen_id: null,
          original_price: originalTotal > combo.combo_price ? originalTotal : undefined,
          is_featured: false,
          _comboProducts: productList,
          _isCombo: true,
        };
      });
      allOffersItems.push(...comboItems);
      
      const uniqueItems = Array.from(new Map(allOffersItems.map(item => [item.id, item])).values());
      uniqueItems.sort((a, b) => {
        const aFeatured = a.is_featured || false;
        const bFeatured = b.is_featured || false;
        const aCombo = a.id < 0;
        const bCombo = b.id < 0;
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        if (!aCombo && bCombo) return -1;
        if (aCombo && !bCombo) return 1;
        return a.name.localeCompare(b.name, 'ar');
      });
      
      if (hasSearch) {
        return uniqueItems.filter(item => item.name.toLowerCase().includes(searchLower));
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
        return shelfItemsAsItems.filter((item) =>
          item.name.toLowerCase().includes(searchLower)
        );
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
  }, [menuItems, shelfItems, selectedCategory, debouncedSearch, offers.featuredItems, offers.combos, offers.happyHours]);

  const addItemToOrder = useCallback((item: Item, extras?: AddItemExtras) => {
    const s = extras?.shelfItem;
    setSelectedItems((prev) => {
      const next = buildCartItem(item, extras ?? {}, 'pickup');
      const key = getCartLineKey(next.item.id, next.shelfItem?.id, next.selectedOptions);
      const existing = prev.find(
        (si) => getCartLineKey(si.item.id, si.shelfItem?.id, si.selectedOptions) === key,
      );
      if (existing) {
        if (s && existing.quantity + 1 > s.quantity) {
          showToast(`الكمية المتوفرة: ${s.quantity}`, 'error');
          return prev;
        }
        return prev.map((si) =>
          si.cartLineId === existing.cartLineId ? { ...si, quantity: si.quantity + 1 } : si,
        );
      }
      if (s && s.quantity === 0) {
        showToast('نفذت الكمية', 'error');
        return prev;
      }
      return [...prev, next];
    });
    if (ordersExpanded && existingOrders.length > 0) {
      setOrdersExpanded(false);
    }
  }, [ordersExpanded, existingOrders.length]);

  // Add shelf item by barcode
  const addShelfItemByBarcode = useCallback(async (barcode: string) => {
    try {
      const serverUrl = getServerUrl();
      const shelfItem = await fetchJson<ShelfItem>(`${serverUrl}/shelves/barcode/${barcode}`);

      if (shelfItem.quantity === 0) {
        showToast('نفذت الكمية', 'error');
        return;
      }

      const existingCartItem = selectedItems.find((si) => si.shelfItem?.barcode === barcode);

      if (existingCartItem) {
        const newQuantity = existingCartItem.quantity + 1;
        if (newQuantity > shelfItem.quantity) {
          showToast(`الكمية المتوفرة: ${shelfItem.quantity}`, 'error');
          return;
        }
        setSelectedItems((prev) =>
          prev.map((si) =>
            si.shelfItem?.barcode === barcode ? { ...si, quantity: si.quantity + 1 } : si
          )
        );
        showToast(`تم زيادة الكمية: ${shelfItem.name} (${newQuantity})`, 'success');
        return;
      }

      const virtualItem: Item = {
        id: shelfItem.id + 1000000,
        name: shelfItem.name,
        price: shelfItem.price,
        categoryId: null,
        kitchen_id: null,
      };

      addItemToOrder(virtualItem, { shelfItem });
      showToast(`تم إضافة ${shelfItem.name}`, 'success');
    } catch (e: any) {
      console.error('Failed to find shelf item:', e);
      showToast('لم يتم العثور على المنتج بهذا الباركود', 'error');
    }
  }, [addItemToOrder, selectedItems]);

  const removeItemFromOrder = useCallback((cartLineId: string) => {
    setSelectedItems((prev) => prev.filter((si) => si.cartLineId !== cartLineId));
  }, []);

  const updateQuantity = useCallback((cartLineId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems((prev) => prev.filter((si) => si.cartLineId !== cartLineId));
    } else {
      setSelectedItems((prev) => {
        const line = prev.find((si) => si.cartLineId === cartLineId);
        if (line?.shelfItem && quantity > line.shelfItem.quantity) {
          showToast(`الكمية المتوفرة: ${line.shelfItem.quantity}`, 'error');
          return prev;
        }
        return updateCartLine(prev, cartLineId, { quantity });
      });
    }
  }, []);

  const updateCartLineOptions = useCallback(
    (cartLineId: string, selectedOptions: import('../lib/item-options').SelectedItemOptions, linePrice: number) => {
      setSelectedItems((prev) =>
        prev.map((si) =>
          si.cartLineId === cartLineId ? { ...si, selectedOptions, linePrice } : si,
        ),
      );
    },
    [],
  );

  const subtotal = useMemo(() => cartSubtotal(selectedItems), [selectedItems]);

  const total = useMemo(() => {
    const discountToApply = appliedDiscount ? appliedDiscount.amount : orderDiscount;
    return Math.max(0, subtotal - discountToApply);
  }, [subtotal, orderDiscount, appliedDiscount]);

  const handleApplyDiscount = useCallback(async () => {
    if (subtotal === 0) return;
    
    const discountToApply = orderDiscount === 0 ? null : {
      percent: Math.round((orderDiscount / subtotal) * 100 * 10) / 10,
      amount: Math.round(orderDiscount),
    };
    
    setAppliedDiscount(discountToApply);
    showToast(discountToApply ? 'تم تطبيق الخصم بنجاح' : 'تم إلغاء الخصم بنجاح', 'success');
  }, [orderDiscount, subtotal]);

  const handleEditOrder = useCallback(async (order: ExistingOrder) => {
    setMode('EDIT');
    setEditingOrder(order);
    
    // Map order items to CartItems
    const orderItems: CartItem[] = order.items
      .map((item: any) => {
        const line = orderItemToCartLine(item, items);
        if (line) line.order_type = 'pickup';
        return line;
      })
      .filter((x): x is CartItem => x != null);
    
    setSelectedItems(orderItems);
    
    // Restore discount from order if it has one
    if (order.globalDiscount) {
      const discount = order.globalDiscount;
      if (typeof discount === 'object' && 'percent' in discount && 'amount' in discount) {
        setAppliedDiscount({
          percent: discount.percent,
          amount: discount.amount,
        });
        setOrderDiscount(discount.amount);
      }
    } else {
      setAppliedDiscount(null);
      setOrderDiscount(0);
    }
    
    // Restore note from order
    setNote(order.note || '');

    // Restore optional customer info for pickup
    setCustomerName((order as any).customer_name || '');
    setCustomerPhone((order as any).customer_phone || '');
    
    setOrdersExpanded(false);
  }, [items]);

  const handleCancelEdit = useCallback(() => {
    setSelectedItems([]);
    setEditingOrder(null);
    setMode('CREATE');
    setNote('');
    setAppliedDiscount(null);
    setOrderDiscount(0);
  }, []);

  const handlePrintOrder = useCallback(async (orderId: number, orderData?: ExistingOrder, silent: boolean = false) => {
    console.log('[PICKUP PRINT] handlePrintOrder called:', { orderId, hasOrderData: !!orderData, silent });
    
    // Request password before printing - ONLY for customer role with require_captain_approval
    if (user?.role === 'customer' && user?.require_captain_approval) {
      const passwordConfirmed = await showPasswordDialog({
        title: 'طلب كلمة المرور للطباعة',
        message: 'الرجاء إدخال كلمة مرور الكابتن/المدير للطباعة',
        onConfirm: async (password: string) => {
          const serverUrl = getServerUrl();
          const response = await fetchJson<{ valid: boolean }>(`${serverUrl}/auth/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          return response.valid;
        },
      });

      if (!passwordConfirmed) {
        return; // User cancelled or password was incorrect
      }
    }

    try {
      // Get order data - prefer provided data, otherwise fetch
      let order: ExistingOrder;
      if (orderData) {
        order = orderData;
      } else {
        const serverUrl = getServerUrl();
        order = await fetchJson<ExistingOrder>(`${serverUrl}/orders/pickup/${orderId}`);
      }

      if (!order) {
        showToast('الطلب غير موجود', 'error');
        return;
      }

      // Calculate totals from order
      const subtotal = order.items.reduce((sum: number, item: any) => {
        return sum + (item.price || 0) * (item.quantity || 1);
      }, 0);

      // Parse globalDiscount if it exists
      let globalDiscount: { percent: number; amount: number } | null = null;
      if (order.globalDiscount) {
        try {
          const discount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          if (discount && discount.percent !== undefined && discount.amount !== undefined) {
            globalDiscount = discount;
          }
        } catch {
          // Invalid discount format, ignore
        }
      }

      // Build base print data structure
      const basePrintData = {
        orderId: order.id,
        table: 0,
        hall: 'سفري',
        totals: {
          subtotal: subtotal,
          discount: order.discount || 0,
          globalDiscount: globalDiscount,
          total: order.total || subtotal,
        },
        timestamp: order.created_at || new Date().toISOString(),
        restaurantName: 'Sufra POS',
        note: order.note || null,
      };
      
      // Group items by kitchen and print each
      const kitchenGroups = new Map<number | null, any[]>();
      order.items.forEach((item: any) => {
        const kitchenId = item.kitchen_id ?? null;
        if (!kitchenGroups.has(kitchenId)) {
          kitchenGroups.set(kitchenId, []);
        }
        kitchenGroups.get(kitchenId)!.push(item);
      });

      const results: any[] = [];
      
      for (const [kitchenId, items] of kitchenGroups) {
        if (kitchenId === null) continue;
        
        // Map items to match OrderPrintData structure exactly
        const mappedItems = items.map((item: any) => ({
          id: item.id,
          item_name: item.item_name || item.name || 'صنف',
          quantity: item.quantity || 1,
          price: item.price || 0,
          kitchen_id: item.kitchen_id ?? null,
          service_type: item.service_type || 'pickup',
          options_json: item.options_json ?? null,
        }));
        
        const kitchenPrintData = {
          ...basePrintData,
          items: mappedItems,
          kitchenName: kitchens.find(k => k.id === kitchenId)?.name || `المطبخ ${kitchenId}`,
          service_type: 'pickup',
        };
        
        // Print via IPC - pass kitchenId, Electron will get IP/port from settings
        if (window.sufra?.print?.order) {
          try {
            console.log('[PICKUP PRINT] Calling window.sufra.print.order:', { kitchenId, itemsCount: mappedItems.length, orderId: basePrintData.orderId });
            const result = await window.sufra.print.order(kitchenPrintData, kitchenId);
            console.log('[PICKUP PRINT] IPC returned result:', result);
            
            // Verify result structure
            if (!result || typeof result !== 'object') {
              throw new Error('Invalid print result: IPC returned non-object');
            }
            
            const printSuccess = result.success === true;
            console.log('[PICKUP PRINT] Print success status:', printSuccess, 'Error:', result.error);
            
            results.push({
              kitchen_id: kitchenId,
              success: printSuccess,
            });
            
            const kitchen = kitchens.find(k => k.id === kitchenId);
            const kitchenName = kitchen?.name || 'المطبخ العام';
            const itemsText = items.map((i: any) => `${i.quantity}× ${i.item_name}`).join('، ');
            
            // Only show success toast if print actually succeeded
            if (printSuccess) {
              if (!silent) {
                showToast(`✓ تم الطباعة إلى ${kitchenName}: ${itemsText}`, 'success', 4000);
              }
            } else {
              const errorMsg = result.error ? `: ${result.error}` : '';
              console.error('[PICKUP PRINT] Print failed - result:', result);
              if (!silent) {
                showToast(`✕ فشل الطباعة إلى ${kitchenName}${errorMsg}`, 'error');
              }
            }
          } catch (printError: any) {
            console.error('[PICKUP PRINT] Print exception caught:', printError);
            console.error('[PICKUP PRINT] Error stack:', printError?.stack);
            results.push({
              kitchen_id: kitchenId,
              success: false,
            });
            const kitchen = kitchens.find(k => k.id === kitchenId);
            const kitchenName = kitchen?.name || 'المطبخ العام';
            if (!silent) {
              showToast(`✕ فشل الطباعة إلى ${kitchenName}: ${printError?.message || 'خطأ غير معروف'}`, 'error');
            }
          }
        } else {
          console.error('[PICKUP PRINT] window.sufra.print.order is not available');
          results.push({
            kitchen_id: kitchenId,
            success: false,
          });
          if (!silent) {
            const kitchen = kitchens.find(k => k.id === kitchenId);
            const kitchenName = kitchen?.name || 'المطبخ العام';
            showToast(`✕ فشل الطباعة إلى ${kitchenName}: واجهة الطباعة غير متوفرة`, 'error');
          }
        }
      }

      if (results.length === 0) {
        if (!silent) {
          showToast('لا توجد طابعات مُعدّة للمطابخ. راجع الإعدادات', 'warning');
        }
      } else if (silent) {
        // Show single summary toast for auto-print
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        if (successCount === totalCount) {
          showToast(`✓ تم طباعة الطلب إلى ${totalCount} مطبخ`, 'success', 3000);
        } else {
          showToast(`⚠ تم الطباعة إلى ${successCount}/${totalCount} مطبخ`, 'warning', 3000);
        }
      }

      // Update order status
      if (order?.status === 'pending') {
        const serverUrl = getServerUrl();
        await fetchJson(`${serverUrl}/orders/pickup/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'printed' }),
        });
      }
    } catch (e: any) {
      console.error('Failed to print order:', e);
      showToast('حدث خطأ أثناء طباعة الطلب', 'error');
    }
  }, [kitchens, user?.role]);

  const handleSubmitOrder = useCallback(async () => {
    if (selectedItems.length === 0) return;

    try {
      const payload: any = {
        items: selectedItems.map(mapCartItemToOrderPayload),
      };
      
      if (appliedDiscount) {
        payload.globalDiscount = {
          percent: appliedDiscount.percent,
          amount: appliedDiscount.amount,
        };
      }
      
      payload.note = note && note.trim() ? note.trim() : null;

      // Optional customer name and phone for pickup
      if (customerName.trim()) payload.customer_name = customerName.trim();
      if (customerPhone.trim()) payload.customer_phone = customerPhone.trim();

      const serverUrl = getServerUrl();
      
      if (mode === 'EDIT' && editingOrder) {
        // Update existing order
        await fetchJson<any>(`${serverUrl}/orders/pickup/${editingOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        showToast(`تم تحديث طلب السفري بنجاح (${selectedItems.length} صنف)`, 'success');
        setAnimatedOrderId(editingOrder.id);
        setTimeout(() => setAnimatedOrderId(null), 2000);
        
        // Reset after successful update
        handleCancelEdit();
      } else {
        // Create new order
        await fetchJson<any>(`${serverUrl}/orders/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        showToast(`تم إنشاء طلب السفري بنجاح (${selectedItems.length} صنف)`, 'success');
        
        // Clear form for next order
        setSelectedItems([]);
        setNote('');
        setAppliedDiscount(null);
        setOrderDiscount(0);
        setSelectedCategory(null);
        setSearchQuery('');
        setMode('CREATE');
      }
    } catch (e: any) {
      console.error('Failed to save pickup order:', e);
      showToast('حدث خطأ أثناء حفظ الطلب: ' + (e.message || 'خطأ غير معروف'), 'error');
    }
  }, [selectedItems, note, appliedDiscount, customerName, customerPhone, mode, editingOrder, handleCancelEdit, handlePrintOrder]);

  const reset = useCallback(() => {
    // Only reset if in CREATE mode
    if (mode === 'CREATE') {
      setSelectedItems([]);
      setNote('');
      setAppliedDiscount(null);
      setOrderDiscount(0);
      setExistingOrders([]);
      setSelectedCategory(null);
      setSearchQuery('');
      setOrdersExpanded(true);
      setMode('CREATE');
      setEditingOrder(null);
    }
  }, [mode]);

  return {
    items: filteredItems,
    allMenuItems: menuItems,
    categories: menuCategories,
    kitchens,
    existingOrders,
    selectedItems,
    loadingItems,
    loadingOrders,
    selectedCategory,
    searchQuery,
    ordersExpanded,
    mode,
    editingOrder,
    animatedOrderId,
    note,
    subtotal,
    total,
    orderDiscount,
    appliedDiscount,
    setSelectedCategory,
    setSearchQuery,
    setOrdersExpanded,
    setNote,
    setOrderDiscount,
    customerName,
    customerPhone,
    setCustomerName,
    setCustomerPhone,
    handleApplyDiscount,
    addItemToOrder,
    addShelfItemByBarcode,
    removeItemFromOrder,
    updateQuantity,
    updateCartLineOptions,
    clearCart: () => {
      setSelectedItems([]);
      setNote('');
    },
    handleSubmitOrder,
    handleEditOrder,
    handleCancelEdit,
    handlePrintOrder,
    reset,
  };
}

