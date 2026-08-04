import { useState, useEffect } from 'react';
import { getServerUrl, Hall, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { useFloorsStore } from '../../stores/floorsStore';
import { useHallsStore } from '../../stores/hallsStore';
import { useTablesStore } from '../../stores/tablesStore';
import { dispatchHallsChanged, dispatchRefreshTables } from '../lib/structure-events';

interface HallFormState {
  id?: number;
  name: string;
  number: string;
  floor_id?: number | null;
}

export function useHalls() {
  const floors = useFloorsStore((state) => state.floors);
  const halls = useHallsStore((state) => state.halls);
  const loadHallsFromStore = useHallsStore((state) => state.loadHalls);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<HallFormState>({
    name: '',
    number: '',
    floor_id: null,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadHalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const hallsWithCounts = await loadHallsFromStore({
        withTablesCount: true,
      });
      return hallsWithCounts;
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'تعذر تحميل الصالات';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHalls();
  }, []);

  useEffect(() => {
    const onHallsChanged = () => void loadHalls();
    window.addEventListener('structure:halls-changed', onHallsChanged);
    return () => window.removeEventListener('structure:halls-changed', onHallsChanged);
  }, []);

  const resetForm = () => {
    setFormState({ id: undefined, name: '', number: '', floor_id: null });
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    try {
      let hallName = formState.name.trim();
      let hallNumber: number;

      if (!formState.number.trim()) {
        const maxNumber = halls.length > 0 ? Math.max(...halls.map((h) => h.number)) : 0;
        hallNumber = maxNumber + 1;
      } else {
        hallNumber = Number(formState.number);
        if (!Number.isFinite(hallNumber) || hallNumber <= 0) {
          setError('رقم الصالة غير صالح.');
          setLoading(false);
          return;
        }
      }

      if (!hallName) {
        hallName = `صالة ${hallNumber}`;
      }

      const payload = {
        name: hallName,
        number: hallNumber,
        hall_number: hallNumber,
        floor_id: formState.floor_id || null,
      };

      const serverUrl = getServerUrl();
      if (formState.id) {
        await fetchJson(`${serverUrl}/halls/${formState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${serverUrl}/halls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      await loadHalls();
      dispatchHallsChanged();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الصالة.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (hall: Hall) => {
    setFormState({
      id: hall.id,
      name: hall.name,
      number: String(hall.number),
      floor_id: hall.floor_id ?? null,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (hall: Hall) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف الصالة "${hall.name}"؟ سيتم حذف جميع الطاولات المرتبطة بها.`,
      title: 'حذف الصالة',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/halls/${hall.id}`, {
        method: 'DELETE',
      });
      useTablesStore.getState().invalidateHall(hall.id);
      await loadHalls();
      dispatchHallsChanged();
      dispatchRefreshTables();
      showToast(`تم حذف الصالة "${hall.name}" بنجاح`, 'success');
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حذف الصالة.';
      setError(message);
      showToast('حدث خطأ أثناء حذف الصالة', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    halls,
    loading,
    error,
    formState,
    setFormState,
    isFormOpen,
    setIsFormOpen,
    loadHalls,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    floors,
  };
}
