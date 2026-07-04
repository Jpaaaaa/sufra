import { useState, useEffect } from 'react';
import { fetchJson, getServerUrl, Kitchen } from '../utils';
import { normalizeCategoryRow, normalizeItemRow } from '../utils/menu-filters';
import { Category } from './useCategories';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';

export interface Item {
  id: number;
  name: string;
  price: number;
  categoryId?: number | null;
  kitchen_id?: number | null;
  image_url?: string | null;
  description?: string | null;
  original_price?: number;
  is_featured?: boolean;
  is_out_of_stock?: boolean;
  /** When true, item is omitted from POS ordering menus. */
  hidden_from_menu?: boolean;
  _comboProducts?: Array<{ id: number; name: string; price: number }>;
}

interface ItemFormState {
  id?: number;
  name: string;
  price: string;
  categoryId: string;
  kitchen_id: string;
  image_url?: string;
  description: string;
  is_out_of_stock: boolean;
  hidden_from_menu: boolean;
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ItemFormState>({
    name: '',
    price: '',
    categoryId: '',
    kitchen_id: '',
    image_url: '',
    description: '',
    is_out_of_stock: false,
    hidden_from_menu: false,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/items`);
      setItems(raw.map((row) => normalizeItemRow(row)));
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الأصناف');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/categories`);
      const mapped: Category[] = raw.map((c) => normalizeCategoryRow(c));
      mapped.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      setCategories(mapped);
    } catch (e: any) {
      console.error('Failed to load categories:', e);
    }
  };

  const loadKitchens = async () => {
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/kitchens`);
      const mapped: Kitchen[] = raw.map((k) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        is_active: Boolean(k.is_active),
      }));
      setKitchens(mapped.filter((k) => k.is_active));
    } catch (e: any) {
      console.error('Failed to load kitchens:', e);
    }
  };

  useEffect(() => {
    void loadItems();
    void loadCategories();
    void loadKitchens();
  }, []);

  const resetForm = () => {
    setFormState({
      id: undefined,
      name: '',
      price: '',
      categoryId: '',
      kitchen_id: '',
      image_url: '',
      description: '',
      is_out_of_stock: false,
      hidden_from_menu: false,
    });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.name.trim() || !formState.price.trim()) {
      setError('يرجى إدخال اسم الصنف والسعر.');
      return;
    }

    const priceValue = Number(formState.price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('السعر غير صالح.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: formState.name.trim(),
        price: priceValue,
        categoryId: formState.categoryId ? Number(formState.categoryId) : null,
        kitchen_id: formState.kitchen_id ? Number(formState.kitchen_id) : null,
        image_url: formState.image_url?.trim() || null,
        description: formState.description?.trim() || null,
        is_out_of_stock: formState.is_out_of_stock,
        hidden_from_menu: formState.hidden_from_menu,
      };

      const serverUrl = getServerUrl();
      if (formState.id) {
        await fetchJson(`${serverUrl}/items/${formState.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${serverUrl}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      await loadItems();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ الصنف.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setFormState({
      id: item.id,
      name: item.name,
      price: String(item.price),
      categoryId: item.categoryId ? String(item.categoryId) : '',
      kitchen_id: item.kitchen_id ? String(item.kitchen_id) : '',
      image_url: item.image_url || '',
      description: item.description || '',
      is_out_of_stock: item.is_out_of_stock || false,
      hidden_from_menu: item.hidden_from_menu || false,
    });
    setIsFormOpen(true);
  };

  const updateItemPrice = async (itemId: number, price: number) => {
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      });
      await loadItems();
      showToast('تم حفظ السعر', 'success');
    } catch (e: any) {
      console.error(e);
      const msg = e.message || 'تعذر حفظ السعر';
      setError(msg);
      showToast(msg, 'error');
      throw e;
    }
  };

  const toggleItemHiddenFromMenu = async (item: Item) => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const next = !item.hidden_from_menu;
      await fetchJson(`${serverUrl}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_from_menu: next }),
      });
      await loadItems();
      showToast(
        next ? 'الصنف مخفي الآن عن قائمة الطلب' : 'الصنف ظاهر الآن في قائمة الطلب',
        'success',
      );
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'تعذر تحديث حالة الصنف', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف الصنف "${item.name}"؟`,
      title: 'حذف الصنف',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/items/${item.id}`, {
        method: 'DELETE',
      });
      await loadItems();
      showToast(`تم حذف الصنف "${item.name}" بنجاح`, 'success');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف الصنف.');
      showToast('حدث خطأ أثناء حذف الصنف', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    items,
    categories,
    kitchens,
    loading,
    error,
    formState,
    setFormState,
    isFormOpen,
    setIsFormOpen,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    loadCategories,
    loadItems,
    updateItemPrice,
    toggleItemHiddenFromMenu,
  };
}

