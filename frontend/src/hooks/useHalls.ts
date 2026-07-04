import { useState, useEffect } from 'react';
import { getServerUrl, Hall, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { Floor } from './useFloors';

interface HallFormState {
  id?: number;
  name: string;
  number: string;
  floor_id?: number | null;
}

export function useHalls() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
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
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/halls`);
      
      const baseHalls: Hall[] = raw.map((h) => ({
        id: h.id,
        name: h.name,
        number: h.number ?? h.hall_number,
        floor_id: h.floor_id ?? null,
        tablesCount:
          h.tablesCount ??
          h.tables_count ??
          h.table_count ??
          h.tables ??
          undefined,
      }));

      // Load floors to map floor_id to floor info
      let floorsMap: Map<number, Floor> = new Map();
      try {
        const serverUrl = getServerUrl();
        const floorsData = await fetchJson<Floor[]>(`${serverUrl}/floors`);
        floorsMap = new Map(floorsData.map(f => [f.id, f]));
      } catch {
        // If floors fail to load, continue without floor info
      }

      const hallsWithCounts = await Promise.all(
        baseHalls.map(async (hall) => {
          // Add floor information if available
          const floor = hall.floor_id ? floorsMap.get(hall.floor_id) : null;
          
          if (hall.tablesCount !== undefined) {
            return { ...hall, floor: floor || null };
          }
          try {
            const serverUrl = getServerUrl();
            const tables = await fetchJson<any[]>(
              `${serverUrl}/halls/${hall.id}/tables`,
            );
            // Ensure tables is an array (handle null/undefined responses)
            const tablesArray = Array.isArray(tables) ? tables : [];
            return { ...hall, tablesCount: tablesArray.length, floor: floor || null };
          } catch {
            return { ...hall, tablesCount: undefined, floor: floor || null };
          }
        }),
      );

      setHalls(hallsWithCounts);
      return hallsWithCounts;
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الصالات');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadFloors = async () => {
    try {
      const serverUrl = getServerUrl();
      const floorsData = await fetchJson<Floor[]>(`${serverUrl}/floors`);
      setFloors(floorsData);
    } catch (e) {
      console.error('Failed to load floors:', e);
      setFloors([]);
    }
  };

  useEffect(() => {
    void loadHalls();
    void loadFloors();
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ الصالة.');
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
      await loadHalls();
      showToast(`تم حذف الصالة "${hall.name}" بنجاح`, 'success');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف الصالة.');
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

