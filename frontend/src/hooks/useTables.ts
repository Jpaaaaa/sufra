import { useState, useEffect } from 'react';
import { getServerUrl, Hall, TableEntity, fetchJson } from '../utils';
import { showConfirm } from '../components/ui/ConfirmDialog';
import { showToast } from '../components/ui/Toast';
import { useHallStore } from '../../stores/hallStore';

interface TableFormState {
  id?: number;
  number: number;
  name: string;
}

export interface UseTablesOptions {
  /** Called after tables are created, updated, or deleted so hall cards can refresh counts. */
  onTablesMutated?: () => void;
}

export function useTables(options?: UseTablesOptions) {
  const onTablesMutated = options?.onTablesMutated;
  // Use global activeHallId - single source of truth
  const activeHallId = useHallStore((state) => state.activeHallId);
  const setActiveHallId = useHallStore((state) => state.setActiveHallId);
  
  const [halls, setHalls] = useState<Hall[]>([]);
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableFormState, setTableFormState] = useState<TableFormState>({
    number: 1,
    name: '',
  });

  // Load halls on mount
  useEffect(() => {
    const loadHalls = async () => {
      try {
        const serverUrl = getServerUrl();
        const raw = await fetchJson<any[]>(`${serverUrl}/halls`);
        
        // Filter out virtual halls used for delivery/safari orders
        const virtualHallNames = ['طلبات خارجية', 'طلبات سفري / توصيل'];
        const filteredRaw = raw.filter((h) => !virtualHallNames.includes(h.name));
        
        const mapped: Hall[] = filteredRaw.map((h) => ({
          id: h.id,
          name: h.name,
          number: h.number ?? h.hall_number,
        }));
        setHalls(mapped);

        // Validate activeHallId against loaded halls
        useHallStore.getState().validateActiveHall(mapped);

        // Auto-select first hall with tables if activeHallId is null
        const updatedActiveHallId = useHallStore.getState().activeHallId;
        if (updatedActiveHallId === null && mapped.length > 0) {
          // Try to find first hall with tables
          for (const hall of mapped) {
            try {
              // Use IPC if available (Electron mode), otherwise use HTTP (browser mode)
              let tablesRaw: any;
              try {
                if (typeof window !== 'undefined' && window.sufra?.tables?.findByHall) {
                  tablesRaw = await window.sufra.tables.findByHall(hall.id);
                } else {
                  // Fallback to HTTP (browser mode or IPC unavailable)
                  const serverUrl = getServerUrl();
                  tablesRaw = await fetchJson<any[]>(`${serverUrl}/halls/${hall.id}/tables`);
                }
              } catch (ipcError) {
                // If IPC fails, fallback to HTTP
                const serverUrl = getServerUrl();
                tablesRaw = await fetchJson<any[]>(`${serverUrl}/halls/${hall.id}/tables`);
              }
              const tablesArray = Array.isArray(tablesRaw) ? tablesRaw : [];
              if (tablesArray.length > 0) {
                setActiveHallId(hall.id);
                break;
              }
            } catch {
              // Continue to next hall
              continue;
            }
          }
          
          // If no hall has tables, select first hall anyway
          const finalActiveHallId = useHallStore.getState().activeHallId;
          if (finalActiveHallId === null && mapped.length > 0) {
            setActiveHallId(mapped[0].id);
          }
        }
      } catch (e: any) {
        // Error loading halls
      }
    };
    void loadHalls();
  }, [setActiveHallId]);

  // Get selectedHall from halls array based on activeHallId
  const selectedHall = halls.find(h => h.id === activeHallId) || null;

  // Load tables when activeHallId changes
  useEffect(() => {
    if (activeHallId !== null) {
      void loadTablesForHall(activeHallId);
    } else {
      setTables([]);
    }
  }, [activeHallId]);

  const loadTablesForHall = async (hallId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Use IPC if available (Electron mode), otherwise use HTTP (browser mode)
      let raw: any;
      try {
        if (typeof window !== 'undefined' && window.sufra?.tables?.findByHall) {
          raw = await window.sufra.tables.findByHall(hallId);
        } else {
          // Fallback to HTTP (browser mode or IPC unavailable)
          const serverUrl = getServerUrl();
          raw = await fetchJson<any[]>(`${serverUrl}/halls/${hallId}/tables`);
        }
      } catch (ipcError) {
        // If IPC fails, fallback to HTTP
        console.warn('[useTables] IPC tables.findByHall failed, falling back to HTTP:', ipcError);
        const serverUrl = getServerUrl();
        raw = await fetchJson<any[]>(`${serverUrl}/halls/${hallId}/tables`);
      }
      
      // Ensure raw is an array (handle null/undefined responses)
      const tablesArray = Array.isArray(raw) ? raw : [];
      const mapped: TableEntity[] = tablesArray.map((t) => ({
        id: t.id,
        number: t.number ?? 1,
        hall_id: t.hall_id ?? hallId,
        name: t.name ?? null,
      }));
      setTables(mapped);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل الطاولات');
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
        // Edit: number is required
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
        // Create: do not send number — backend auto-assigns 1, 2, 3, ...
        const payload: { hall_id: number; number?: number; name?: string } = {
          hall_id: activeHallId,
          name: tableFormState.name.trim() || undefined,
        };
        const created = await fetchJson<{ number: number; name?: string | null }>(`${serverUrl}/halls/${activeHallId}/tables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const tableLabel = created?.name || `طاولة ${created?.number ?? ''}`;
        showToast(`تم إنشاء الطاولة "${tableLabel}" بنجاح`, 'success');
      }

      setTableFormState({ id: undefined, number: 1, name: '' });
      // Reload tables to show the newly created/updated table
      if (activeHallId !== null) {
        await loadTablesForHall(activeHallId);
      }
      onTablesMutated?.();
    } catch (e: any) {
      const errorMessage = e.message || 'حدث خطأ أثناء حفظ الطاولة.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
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
        await loadTablesForHall(activeHallId);
      }
      onTablesMutated?.();
      showToast(`تم حذف الطاولة "${table.name}" بنجاح`, 'success');
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء حذف الطاولة.');
      showToast('حدث خطأ أثناء حذف الطاولة', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper to set selected hall (updates global store)
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

