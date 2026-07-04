import { useState, useEffect } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';

export interface ShelfItem {
  id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

interface ShelfItemFormState {
  id?: number;
  name: string;
  barcode: string;
  price: string;
  quantity: string;
}

export function useShelves() {
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ShelfItemFormState>({
    name: '',
    barcode: '',
    price: '',
    quantity: '',
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadShelves = async () => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<ShelfItem[]>(`${serverUrl}/shelves`);
      setShelves(raw);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الرفوف');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadShelves();
  }, []);

  const resetForm = () => {
    setFormState({
      id: undefined,
      name: '',
      barcode: '',
      price: '',
      quantity: '',
    });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.name.trim() || !formState.barcode.trim() || !formState.price.trim() || !formState.quantity.trim()) {
      setError('يرجى إدخال جميع الحقول المطلوبة.');
      return;
    }

    const priceValue = Number(formState.price);
    const quantityValue = Number(formState.quantity);
    
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('السعر غير صالح.');
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue < 0 || !Number.isInteger(quantityValue)) {
      setError('الكمية يجب أن تكون رقماً صحيحاً أكبر من أو يساوي الصفر.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: formState.name.trim(),
        barcode: formState.barcode.trim(),
        price: priceValue,
        quantity: quantityValue,
      };

      const serverUrl = getServerUrl();
      if (formState.id) {
        await fetchJson(`${serverUrl}/shelves/${formState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('تم تحديث العنصر بنجاح', 'success');
      } else {
        await fetchJson(`${serverUrl}/shelves`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('تم إضافة العنصر بنجاح', 'success');
      }

      resetForm();
      await loadShelves();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ العنصر.');
      showToast('حدث خطأ أثناء حفظ العنصر', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: ShelfItem) => {
    setFormState({
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      price: String(item.price),
      quantity: String(item.quantity),
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (item: ShelfItem) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف العنصر "${item.name}"؟`,
      title: 'حذف العنصر',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/shelves/${item.id}`, {
        method: 'DELETE',
      });
      await loadShelves();
      showToast(`تم حذف العنصر "${item.name}" بنجاح`, 'success');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف العنصر.');
      showToast('حدث خطأ أثناء حذف العنصر', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createShelfItem = async (data: Omit<ShelfItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const serverUrl = getServerUrl();
    return await fetchJson<ShelfItem>(`${serverUrl}/shelves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  const updateShelfItem = async (id: number, data: Partial<Omit<ShelfItem, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const serverUrl = getServerUrl();
    return await fetchJson<ShelfItem>(`${serverUrl}/shelves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  const deleteShelfItem = async (id: number) => {
    const serverUrl = getServerUrl();
    await fetchJson(`${serverUrl}/shelves/${id}`, {
      method: 'DELETE',
    });
  };

  return {
    shelves,
    isLoading: loading,
    isError: error !== null,
    error,
    formState,
    setFormState,
    isFormOpen,
    setIsFormOpen,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    createShelfItem,
    updateShelfItem,
    deleteShelfItem,
    loadShelves,
  };
}

