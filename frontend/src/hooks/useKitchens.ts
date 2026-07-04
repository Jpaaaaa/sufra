import { useState, useEffect } from 'react';
import { getServerUrl, Kitchen, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { Floor } from './useFloors';

interface KitchenFormState {
  id?: number;
  name: string;
  description: string;
  floor_id?: number | null;
}

export function useKitchens() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<KitchenFormState>({
    name: '',
    description: '',
    floor_id: null,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadFloors = async () => {
    try {
      // Use IPC if available, otherwise fallback to HTTP
      if (window.sufra?.floors?.findAll) {
        const floorsData = await window.sufra.floors.findAll();
        setFloors(floorsData);
      } else {
        const serverUrl = getServerUrl();
        const floorsData = await fetchJson<Floor[]>(`${serverUrl}/floors`);
        setFloors(floorsData);
      }
    } catch (e) {
      console.error('Failed to load floors:', e);
      setFloors([]);
    }
  };

  const loadKitchens = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use IPC if available, otherwise fallback to HTTP
      let raw: any[];
      if (window.sufra?.kitchens?.findAll) {
        raw = await window.sufra.kitchens.findAll();
      } else {
        const serverUrl = getServerUrl();
        raw = await fetchJson<any[]>(`${serverUrl}/kitchens`);
      }
      
      // Load floors to map floor_id to floor info
      let floorsMap: Map<number, Floor> = new Map();
      try {
        if (window.sufra?.floors?.findAll) {
          const floorsData = await window.sufra.floors.findAll();
          floorsMap = new Map(floorsData.map(f => [f.id, f]));
        } else {
          const serverUrl = getServerUrl();
          const floorsData = await fetchJson<Floor[]>(`${serverUrl}/floors`);
          floorsMap = new Map(floorsData.map(f => [f.id, f]));
        }
      } catch {
        // If floors fail to load, continue without floor info
      }
      
      const mapped: Kitchen[] = raw.map((k) => {
        const floor = k.floor_id ? floorsMap.get(k.floor_id) : null;
        return {
          id: k.id,
          name: k.name,
          description: k.description,
          floor_id: k.floor_id ?? null,
          floor: floor || null,
          is_active: Boolean(k.is_active),
        };
      });
      setKitchens(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل المطابخ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKitchens();
    void loadFloors();
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

      // Use IPC if available, otherwise fallback to HTTP
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حفظ المطبخ.');
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
      // Use IPC if available, otherwise fallback to HTTP
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء حذف المطبخ.');
      showToast('حدث خطأ أثناء حذف المطبخ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (kitchen: Kitchen) => {
    setLoading(true);
    setError(null);
    try {
      // Use IPC if available, otherwise fallback to HTTP
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ أثناء تحديث حالة المطبخ.');
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

