import { useState, useEffect } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { normalizeCategoryRow } from '../utils/menu-filters';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';

export interface Category {
  id: number;
  name: string;
  /** Display order (1 = first). From API `sort_order`. */
  sort_order: number;
  /** Number of items in this category. */
  item_count: number;
  /** When false, category is hidden from ordering menus. */
  is_menu_active: boolean;
}

interface CategoryFormState {
  id?: number;
  name: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>({
    name: '',
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/categories`);
      const mapped: Category[] = raw.map((c) => normalizeCategoryRow(c));
      mapped.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      setCategories(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الفئات');
    } finally {
      setLoading(false);
    }
  };

  const reorderCategories = async (ids: number[]) => {
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/categories/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      await loadCategories();
      showToast('تم حفظ ترتيب الفئات', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'تعذر حفظ الترتيب', 'error');
      throw e;
    }
  };

  const toggleCategoryMenuActive = async (category: Category) => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const next = !category.is_menu_active;
      await fetchJson(`${serverUrl}/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_menu_active: next }),
      });
      await loadCategories();
      showToast(
        next ? 'الفئة ظاهرة الآن في قائمة الطلب' : 'الفئة مخفية الآن عن قائمة الطلب',
        'success',
      );
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'تعذر تحديث حالة الفئة', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const resetForm = () => {
    setFormState({ id: undefined, name: '' });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.name.trim()) {
      setError('يرجى إدخال اسم الفئة.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = { name: formState.name.trim() };

      const serverUrl = getServerUrl();
      if (formState.id) {
        await fetchJson(`${serverUrl}/categories/${formState.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${serverUrl}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      await loadCategories();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ الفئة.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setFormState({
      id: category.id,
      name: category.name,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (category: Category) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف الفئة "${category.name}"؟`,
      title: 'حذف الفئة',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/categories/${category.id}`, {
        method: 'DELETE',
      });
      await loadCategories();
      showToast(`تم حذف الفئة "${category.name}" بنجاح`, 'success');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف الفئة.');
      showToast('حدث خطأ أثناء حذف الفئة', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    categories,
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
    reorderCategories,
    toggleCategoryMenuActive,
  };
}

