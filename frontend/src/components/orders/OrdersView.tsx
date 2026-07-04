import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Hall, TableEntity, fetchJson, getServerUrl } from '../../utils';
import {
  normalizeCategoryRow,
  normalizeItemRow,
  sortCategoriesForOrderMenu,
} from '../../utils/menu-filters';
import {
  getItemOrderAvailability,
  toastMessageForUnavailable,
  buildCategoryMenuActiveMap,
} from '../../utils/item-order-availability';
import { showToast } from '../ui/Toast';
import type { Category as AdminCategory } from '../../hooks/useCategories';
import { Order } from '../../hooks/useOrders';
import { Item } from '../../hooks/useItems';

interface OrdersViewProps {
  hall: Hall;
  table: TableEntity;
  orders: Order[];
  loading: boolean;
  onBack: () => void;
}

interface Category {
  id: number;
  name: string;
  is_menu_active?: boolean;
  sort_order?: number;
}

export default function OrdersView({
  hall,
  table,
  onBack,
}: OrdersViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ item: Item; quantity: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoadingItems(true);
      try {
        const serverUrl = getServerUrl();
        const [itemsData, categoriesData] = await Promise.all([
          fetchJson<any[]>(`${serverUrl}/items`),
          fetchJson<any[]>(`${serverUrl}/categories`),
        ]);
        setItems(itemsData.map(normalizeItemRow));
        setCategories(categoriesData.map(normalizeCategoryRow));
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoadingItems(false);
      }
    };
    void loadData();
  }, []);

  const menuCategories = useMemo(
    () => sortCategoriesForOrderMenu(categories as AdminCategory[]),
    [categories],
  );

  const menuItems = useMemo(() => items, [items]);

  const categoryMenuActiveById = useMemo(
    () => buildCategoryMenuActiveMap(categories as AdminCategory[]),
    [categories],
  );

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === null || item.categoryId === selectedCategory;
    const matchesSearch = searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addItemToOrder = (item: Item) => {
    const { available, reason } = getItemOrderAvailability(item, categoryMenuActiveById);
    if (!available && reason) {
      showToast(toastMessageForUnavailable(reason), 'error');
      return;
    }
    const existing = selectedItems.find((si) => si.item.id === item.id);
    if (existing) {
      setSelectedItems((prev) =>
        prev.map((si) =>
          si.item.id === item.id ? { ...si, quantity: si.quantity + 1 } : si
        )
      );
    } else {
      setSelectedItems((prev) => [...prev, { item, quantity: 1 }]);
    }
  };

  const removeItemFromOrder = (itemId: number) => {
    setSelectedItems((prev) => prev.filter((si) => si.item.id !== itemId));
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromOrder(itemId);
    } else {
      setSelectedItems((prev) =>
        prev.map((si) =>
          si.item.id === itemId ? { ...si, quantity } : si
        )
      );
    }
  };

  const getTotal = () => {
    return selectedItems.reduce((sum, si) => sum + si.item.price * si.quantity, 0);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-slate-900">
            الطلبات - {table.name}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500">
            الصالة: {hall.name} · رقم {hall.number}
            {hall.floor && <> · الطابق: {hall.floor.name}</>}
            {table.name && ` · ${table.name}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
        >
          ← رجوع للطاولات
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Order Creation Panel */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[20px] leading-tight font-semibold text-emerald-900">
              قائمة الأصناف
            </h3>
            <Link
              to="/items"
              className="text-[13px] leading-relaxed text-emerald-600 hover:text-emerald-700 underline"
            >
              إدارة الأصناف ←
            </Link>
          </div>

          {/* Category filters */}
          {menuCategories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`rounded-full px-3 py-1.5 text-[13px] leading-relaxed font-medium ${
                  selectedCategory === null
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                الكل
              </button>
              {menuCategories.map((cat) => {
                const inactive = cat.is_menu_active === false;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    title={inactive ? 'الفئة غير متاحة للطلب حالياً' : undefined}
                    className={`rounded-full px-3 py-1.5 text-[13px] leading-relaxed font-medium ${
                      selectedCategory === cat.id
                        ? inactive
                          ? 'bg-amber-600 text-white ring-2 ring-amber-300/50'
                          : 'bg-emerald-600 text-white'
                        : inactive
                          ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                    {inactive ? ' · غير متاح' : ''}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search bar */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="ابحث عن صنف..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {loadingItems ? (
            <div className="flex h-64 items-center justify-center text-[15px] leading-normal text-slate-500">
              جاري تحميل الأصناف...
            </div>
          ) : menuItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-[15px] leading-normal text-emerald-700">
              <div className="text-center">
                <div className="mb-2 text-4xl">🍽️</div>
                <p>لا توجد أصناف بعد</p>
                <Link to="/items" className="mt-2 inline-block text-[13px] leading-relaxed text-emerald-600 hover:underline">
                  إضافة أصناف الآن
                </Link>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
              لا توجد نتائج بحث
            </div>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
              {filteredItems.map((item) => {
                const unavailable = !getItemOrderAvailability(item, categoryMenuActiveById).available;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItemToOrder(item)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-right ${
                      unavailable
                        ? 'cursor-not-allowed border-amber-200 bg-amber-50/80 opacity-90 hover:border-amber-300'
                        : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-[15px] leading-normal font-medium text-slate-900">{item.name}</div>
                      {unavailable && (
                        <div className="mt-0.5 text-[11px] font-semibold text-amber-800">غير متوفر للطلب</div>
                      )}
                    </div>
                    <div className={`text-[15px] leading-normal font-bold ${unavailable ? 'text-amber-700' : 'text-emerald-600'}`}>
                      {item.price} د.ع
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Order Panel */}
        <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6">
          <h3 className="text-[20px] leading-tight font-semibold text-blue-900">
            الطلب الحالي ({selectedItems.length})
          </h3>
          
          {selectedItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-[15px] leading-normal text-blue-700">
              <div className="text-center">
                <div className="mb-2 text-4xl">📋</div>
                <p>اضغط على الأصناف لإضافتها للطلب</p>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-64 space-y-2 overflow-auto">
                {selectedItems.map((si) => (
                  <div
                    key={si.item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <div className="flex-1">
                      <div className="text-[15px] leading-normal font-medium text-slate-900">{si.item.name}</div>
                      <div className="text-[13px] leading-relaxed text-slate-600">{si.item.price} د.ع × {si.quantity}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(si.item.id, si.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-[13px] leading-relaxed font-bold text-slate-700 hover:bg-slate-300"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[15px] leading-normal font-bold text-slate-900">
                        {si.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(si.item.id, si.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 text-[13px] leading-relaxed font-bold text-white hover:bg-emerald-600"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItemFromOrder(si.item.id)}
                        className="mr-1 text-red-600 hover:text-red-700"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border-t-2 border-blue-300 bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] leading-normal font-bold text-slate-900">الإجمالي:</span>
                  <span className="text-[20px] leading-tight font-bold text-blue-700">{getTotal()} د.ع</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-[15px] leading-normal font-bold text-white shadow-md hover:bg-emerald-700"
                >
                  تأكيد الطلب ✓
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

