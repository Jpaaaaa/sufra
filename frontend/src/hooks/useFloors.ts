import { useState, useEffect } from 'react';
import { getServerUrl, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { useFloorsStore } from '../../stores/floorsStore';
import type { Floor } from '../types/floor';

export type { Floor };

interface FloorFormState {
  id?: number;
  name: string;
  number: string;
}

export function useFloors() {
  const floors = useFloorsStore((state) => state.floors);
  const loadFloorsFromStore = useFloorsStore((state) => state.loadFloors);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FloorFormState>({
    name: '',
    number: '',
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadFloors = async () => {
    setLoading(true);
    setError(null);
    try {
      const floorsData = await loadFloorsFromStore();
      return floorsData;
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'تعذر تحميل الطوابق';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFloors();
  }, []);

  const resetForm = () => {
    setFormState({ id: undefined, name: '', number: '' });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    try {
      let floorName = formState.name.trim();
      let floorNumber: number;

      if (!formState.number.trim()) {
        const maxNumber = floors.length > 0 ? Math.max(...floors.map((f) => f.number)) : 0;
        floorNumber = maxNumber + 1;
      } else {
        floorNumber = Number(formState.number);
        if (!Number.isFinite(floorNumber) || floorNumber <= 0) {
          setError('رقم الطابق غير صالح.');
          setLoading(false);
          return;
        }
      }

      if (!floorName) {
        floorName = `طابق ${floorNumber}`;
      }

      const payload = {
        name: floorName,
        number: floorNumber,
        floor_number: floorNumber,
      };

      const serverUrl = getServerUrl();
      if (formState.id) {
        await fetchJson(`${serverUrl}/floors/${formState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast(`تم تحديث الطابق "${floorName}" بنجاح`, 'success');
      } else {
        await fetchJson(`${serverUrl}/floors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast(`تم إضافة الطابق "${floorName}" بنجاح`, 'success');
      }

      resetForm();
      await loadFloors();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الطابق.';
      setError(message);
      showToast('حدث خطأ أثناء حفظ الطابق', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (floor: Floor) => {
    setFormState({
      id: floor.id,
      name: floor.name,
      number: String(floor.number),
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (floor: Floor) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف الطابق "${floor.name}"؟ سيتم إزالة ارتباطه من جميع الصالات المرتبطة به.`,
      title: 'حذف الطابق',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/floors/${floor.id}`, {
        method: 'DELETE',
      });
      await loadFloors();
      showToast(`تم حذف الطابق "${floor.name}" بنجاح`, 'success');
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حذف الطابق.';
      setError(message);
      showToast('حدث خطأ أثناء حذف الطابق', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    floors,
    loading,
    error,
    formState,
    setFormState,
    isFormOpen,
    setIsFormOpen,
    loadFloors,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
  };
}
