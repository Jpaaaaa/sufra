import { useState, useEffect } from 'react';
import { getServerUrl, Kitchen, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { useFloorsStore } from '../../stores/floorsStore';
import { useKitchensStore } from '../../stores/kitchensStore';

interface KitchenFormState {
  id?: number;
  name: string;
  description: string;
  floor_id?: number | null;
}

export function useKitchens() {
  const floors = useFloorsStore((state) => state.floors);
  const kitchens = useKitchensStore((state) => state.kitchens);
  const loadKitchensFromStore = useKitchensStore((state) => state.loadKitchens);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<KitchenFormState>({
    name: '',
    description: '',
    floor_id: null,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadKitchens = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadKitchensFromStore();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'تعذر تحميل المطابخ';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKitchens();
  }, []);

  const resetForm = () => {
    setFormState({ id: undefined, name: '', description: '', floor_id: null });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.name.trim()) {
      setError('يرجى إدخال اسم المطبخ.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        floor_id: formState.floor_id || null,
        is_active: 1,
      };

      if (window.sufra?.kitchens) {
        if (formState.id) {
          await window.sufra.kitchens.update(formState.id, payload);
        } else {
          await window.sufra.kitchens.create(payload);
        }
      } else {
        const serverUrl = getServerUrl();
        if (formState.id) {
          await fetchJson(`${serverUrl}/kitchens/${formState.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          await fetchJson(`${serverUrl}/kitchens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }

      resetForm();
      await loadKitchens();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ المطبخ.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (kitchen: Kitchen) => {
    setFormState({
      id: kitchen.id,
      name: kitchen.name,
      description: kitchen.description || '',
      floor_id: kitchen.floor_id ?? null,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (kitchen: Kitchen) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف المطبخ "${kitchen.name}"؟`,
      title: 'حذف المطبخ',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      if (window.sufra?.kitchens?.remove) {
        await window.sufra.kitchens.remove(kitchen.id);
      } else {
        const serverUrl = getServerUrl();
        await fetchJson(`${serverUrl}/kitchens/${kitchen.id}`, {
          method: 'DELETE',
        });
      }
      await loadKitchens();
      showToast(`تم حذف المطبخ "${kitchen.name}" بنجاح`, 'success');
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حذف المطبخ.';
      setError(message);
      showToast('حدث خطأ أثناء حذف المطبخ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (kitchen: Kitchen) => {
    setLoading(true);
    setError(null);
    try {
      if (window.sufra?.kitchens?.update) {
        await window.sufra.kitchens.update(kitchen.id, { is_active: kitchen.is_active ? 0 : 1 });
      } else {
        const serverUrl = getServerUrl();
        await fetchJson(`${serverUrl}/kitchens/${kitchen.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: kitchen.is_active ? 0 : 1 }),
        });
      }
      await loadKitchens();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء تحديث حالة المطبخ.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return {
    kitchens,
    floors,
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
    toggleActive,
  };
}
