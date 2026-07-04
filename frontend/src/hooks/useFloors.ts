import { useState, useEffect } from 'react';
import { getServerUrl, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';

export interface Floor {
  id: number;
  name: string;
  number: number;
  floor_number?: number;
  created_at?: string;
  updated_at?: string;
}

interface FloorFormState {
  id?: number;
  name: string;
  number: string;
}

export function useFloors() {
  const [floors, setFloors] = useState<Floor[]>([]);
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
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/floors`);
      
      const floorsData: Floor[] = raw.map((f) => ({
        id: f.id,
        name: f.name,
        number: f.number ?? f.floor_number,
        floor_number: f.floor_number,
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));

      setFloors(floorsData);
      return floorsData;
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الطوابق');
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ الطابق.');
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف الطابق.');
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

