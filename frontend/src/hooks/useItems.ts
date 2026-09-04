import { useState, useEffect, useMemo } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { useKitchensStore } from '../../stores/kitchensStore';
import { normalizeCategoryRow, normalizeItemRow } from '../utils/menu-filters';
import { Category } from './useCategories';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';

import { apiGroupsToDraft, draftGroupsToApi, type ItemOptionGroup } from '../lib/item-options';

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
  has_options: boolean;
  option_groups: ReturnType<typeof apiGroupsToDraft>;
}

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
  hidden_from_menu?: boolean;
  has_options?: boolean;
  option_groups?: ItemOptionGroup[];
  _comboProducts?: Array<{
    id: number;
    name: string;
    price: number;
    quantity?: number;
    kitchen_id?: number | null;
  }>;
}

export type { ItemFormState };

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const allKitchens = useKitchensStore((state) => state.kitchens);
  const kitchens = useMemo(
    () => allKitchens.filter((k) => k.is_active),
    [allKitchens],
  );
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
    has_options: false,
    option_groups: [],
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
      await useKitchensStore.getState().loadKitchens();
    } catch (e: unknown) {
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
      has_options: false,
      option_groups: [],
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
      const payload: Record<string, unknown> = {
        name: formState.name.trim(),
        price: priceValue,
        categoryId: formState.categoryId ? Number(formState.categoryId) : null,
        kitchen_id: formState.kitchen_id ? Number(formState.kitchen_id) : null,
        image_url: formState.image_url?.trim() || null,
        description: formState.description?.trim() || null,
        is_out_of_stock: formState.is_out_of_stock,
        hidden_from_menu: formState.hidden_from_menu,
      };

      if (formState.has_options && formState.option_groups.length > 0) {
        payload.option_groups = draftGroupsToApi(formState.option_groups);
      } else if (formState.id) {
        payload.option_groups = [];
      }

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
    const categoryExists =
      item.categoryId != null && categories.some((c) => c.id === item.categoryId);
    const kitchenExists =
      item.kitchen_id != null && kitchens.some((k) => k.id === item.kitchen_id);
    setFormState({
      id: item.id,
      name: item.name,
      price: String(item.price),
      categoryId: categoryExists && item.categoryId ? String(item.categoryId) : '',
      kitchen_id: kitchenExists && item.kitchen_id ? String(item.kitchen_id) : '',
      image_url: item.image_url || '',
      description: item.description || '',
      is_out_of_stock: item.is_out_of_stock || false,
      hidden_from_menu: item.hidden_from_menu || false,
      has_options: Boolean(item.has_options || item.option_groups?.length),
      option_groups: apiGroupsToDraft(item.option_groups),
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

