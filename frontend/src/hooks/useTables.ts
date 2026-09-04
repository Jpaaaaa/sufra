import { useState, useEffect } from 'react';
import { getServerUrl, Hall, TableEntity, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { useHallStore } from '../../stores/hallStore';
import { useHallsStore } from '../../stores/hallsStore';
import { useTablesStore } from '../../stores/tablesStore';
import { dispatchHallsChanged, dispatchRefreshTables } from '../lib/structure-events';

interface TableFormState {
  id?: number;
  number: number;
  name: string;
}

export function useTables() {
  const activeHallId = useHallStore((state) => state.activeHallId);
  const setActiveHallId = useHallStore((state) => state.setActiveHallId);
  const halls = useHallsStore((state) => state.halls);
  const loadHallsFromStore = useHallsStore((state) => state.loadHalls);
  const tablesByHallId = useTablesStore((state) => state.tablesByHallId);
  const loadTablesFromStore = useTablesStore((state) => state.loadTablesForHall);
  const invalidateHallTables = useTablesStore((state) => state.invalidateHall);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableFormState, setTableFormState] = useState<TableFormState>({
    number: 1,
    name: '',
  });

  const tables: TableEntity[] =
    activeHallId !== null ? tablesByHallId[activeHallId] ?? [] : [];

  useEffect(() => {
    const init = async () => {
      const mapped = await loadHallsFromStore({ excludeVirtual: true });
      useHallStore.getState().validateActiveHall(mapped);

      const updatedActiveHallId = useHallStore.getState().activeHallId;
      if (updatedActiveHallId === null && mapped.length > 0) {
        for (const hall of mapped) {
          const hallTables = await loadTablesFromStore(hall.id);
          if (hallTables.length > 0) {
            setActiveHallId(hall.id);
            break;
          }
        }

        const finalActiveHallId = useHallStore.getState().activeHallId;
        if (finalActiveHallId === null && mapped.length > 0) {
          setActiveHallId(mapped[0].id);
        }
      }
    };
    void init();
  }, [loadHallsFromStore, loadTablesFromStore, setActiveHallId]);

  useEffect(() => {
    const onHallsChanged = () => {
      void loadHallsFromStore({ excludeVirtual: true });
    };
    window.addEventListener('structure:halls-changed', onHallsChanged);
    return () => window.removeEventListener('structure:halls-changed', onHallsChanged);
  }, [loadHallsFromStore]);

  useEffect(() => {
    const handleRefreshTables = (event: Event) => {
      const customEvent = event as CustomEvent<{ hallId?: number }>;
      const targetHallId = customEvent.detail?.hallId ?? activeHallId;
      if (targetHallId !== null) {
        void loadTablesFromStore(targetHallId, true);
      }
    };

    window.addEventListener('refresh-tables', handleRefreshTables as EventListener);
    return () => {
      window.removeEventListener('refresh-tables', handleRefreshTables as EventListener);
    };
  }, [activeHallId, loadTablesFromStore]);

  useEffect(() => {
    if (activeHallId !== null) {
      void loadTablesFromStore(activeHallId);
    }
  }, [activeHallId, loadTablesFromStore]);

  const selectedHall = halls.find((h) => h.id === activeHallId) || null;

  const refreshAfterTableMutation = async (hallId: number) => {
    invalidateHallTables(hallId);
    await loadTablesFromStore(hallId, true);
    await loadHallsFromStore({ excludeVirtual: true, withTablesCount: true });
    dispatchHallsChanged();
    dispatchRefreshTables(hallId);
  };

  const loadTablesForHall = async (hallId: number) => {
    setLoading(true);
    setError(null);
    try {
      await loadTablesFromStore(hallId, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر تحميل الطاولات';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeHallId === null) {
      setError('يرجى اختيار صالة أولاً.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      if (tableFormState.id) {
        if (!tableFormState.number || tableFormState.number < 1) {
          setError('رقم الطاولة مطلوب.');
          setLoading(false);
          return;
        }
        const payload = {
          hall_id: activeHallId,
          number: tableFormState.number,
          name: tableFormState.name.trim() || undefined,
        };
        await fetchJson(`${serverUrl}/tables/${tableFormState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const tableLabel = tableFormState.name || `رقم ${tableFormState.number}`;
        showToast(`تم تحديث الطاولة "${tableLabel}" بنجاح`, 'success');
      } else {
        const payload: { hall_id: number; number?: number; name?: string } = {
          hall_id: activeHallId,
          name: tableFormState.name.trim() || undefined,
        };
        const created = await fetchJson<{ number: number; name?: string | null }>(
          `${serverUrl}/halls/${activeHallId}/tables`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        const tableLabel = created?.name || `طاولة ${created?.number ?? ''}`;
        showToast(`تم إنشاء الطاولة "${tableLabel}" بنجاح`, 'success');
      }

      setTableFormState({ id: undefined, number: 1, name: '' });
      await refreshAfterTableMutation(activeHallId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الطاولة.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTable = (table: TableEntity) => {
    setTableFormState({
      id: table.id,
      number: table.number,
      name: table.name || '',
    });
  };

  const handleDeleteTable = async (table: TableEntity) => {
    const confirmed = await showConfirm({
      message: `هل أنت متأكد من حذف الطاولة "${table.name}"؟`,
      title: 'حذف الطاولة',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/tables/${table.id}`, {
        method: 'DELETE',
      });
      if (activeHallId !== null) {
        await refreshAfterTableMutation(activeHallId);
      }
      showToast(`تم حذف الطاولة "${table.name}" بنجاح`, 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'حدث خطأ أثناء حذف الطاولة.';
      setError(message);
      showToast('حدث خطأ أثناء حذف الطاولة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const setSelectedHall = (hall: Hall | null) => {
    if (hall) {
      setActiveHallId(hall.id);
    } else {
      setActiveHallId(null);
    }
  };

  return {
    halls,
    tables,
    selectedHall,
    setSelectedHall,
    loading,
    error,
    setError,
    tableFormState,
    setTableFormState,
    loadTablesForHall,
    handleSubmitTable,
    handleEditTable,
    handleDeleteTable,
  };
}
