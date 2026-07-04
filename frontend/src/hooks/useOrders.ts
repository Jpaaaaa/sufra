import { useState, useEffect, useRef } from 'react';
import { getServerUrl, Hall, TableEntity, fetchJson } from '../utils';
import { useHallStore } from '../../stores/hallStore';
import { useOrderSocket } from './useOrderSocket';

export interface Order {
  id: number;
  table_id: number;
  status: 'active' | 'completed' | 'cancelled';
  items: OrderItem[];
  total: number;
  created_at: string;
  note?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_name: string;
  quantity: number;
  price: number;
}

export interface TableWithStatus extends TableEntity {
  orderStatus?: 'pending' | 'printed' | null;
}

export interface FloorOption {
  id: number;
  name: string;
  number: number;
}

export function useOrders() {
  // Use global activeHallId - single source of truth
  const activeHallId = useHallStore((state) => state.activeHallId);
  const setActiveHallId = useHallStore((state) => state.setActiveHallId);
  const { subscribeToOrders } = useOrderSocket();
  
  const [halls, setHalls] = useState<Hall[]>([]);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [tables, setTables] = useState<TableWithStatus[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableEntity | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to store current halls value to avoid recreating socket subscription
  const hallsRef = useRef<Hall[]>([]);

  // Update ref whenever halls changes
  useEffect(() => {
    hallsRef.current = halls;
  }, [halls]);

  // Get selectedHall from halls array based on activeHallId
  const selectedHall = halls.find(h => h.id === activeHallId) || null;

  // Load halls on mount
  useEffect(() => {
    void loadHalls();
  }, []);

  // Validate activeHallId when halls are loaded
  useEffect(() => {
    if (halls.length > 0) {
      const validateStore = useHallStore.getState();
      validateStore.validateActiveHall(halls);
    }
  }, [halls]);

  // Load tables when activeHallId changes
  useEffect(() => {
    if (activeHallId !== null) {
      void loadTablesForHall(activeHallId);
    } else {
      setTables([]);
    }
  }, [activeHallId]);

  // Subscribe to real-time dine-in order updates
  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        console.log('[useOrders] Received order event:', event.eventType, event.orderType);
        // Reload tables for active hall when dine-in orders are created or updated
        if (event.orderType === 'dine-in' && activeHallId !== null) {
          // Check if the order belongs to the active hall
          const orderHallId = event.order?.hall_id;
          if (orderHallId === activeHallId) {
            void loadTablesForHall(activeHallId);
          }
          // Also update hall statuses - use ref to avoid dependency issues
          void updateHallStatuses(hallsRef.current);
        }
      },
      ['dine-in'] // Only listen to dine-in orders
    );

    return unsubscribe;
  }, [subscribeToOrders, activeHallId]);

  // Listen for manual refresh events (e.g., after printing from Electron)
  useEffect(() => {
    const handleRefreshTables = (event: CustomEvent<{ hallId?: number }>) => {
      const targetHallId = event.detail?.hallId || activeHallId;
      if (targetHallId !== null) {
        console.log('[useOrders] Manual refresh triggered for hall:', targetHallId);
        void loadTablesForHall(targetHallId);
        void updateHallStatuses(hallsRef.current);
      }
    };

    window.addEventListener('refresh-tables' as any, handleRefreshTables as EventListener);
    return () => {
      window.removeEventListener('refresh-tables' as any, handleRefreshTables as EventListener);
    };
  }, [activeHallId]);

  // Helper: compute aggregate order flags for each hall
  const updateHallStatuses = async (hallsList: Hall[]) => {
    try {
      const entries = await Promise.all(
        hallsList.map(async (hall) => {
          try {
            // Use new dine-in hall endpoint
            const serverUrl = getServerUrl();
            const orders = await fetchJson<any[]>(
              `${serverUrl}/orders/dine-in/hall/${hall.id}`,
            );

            const hasPending = orders.some((o: any) => o.status === 'pending');
            const hasPrinted = orders.some((o: any) => o.status === 'printed');

            return [hall.id, { hasPending, hasPrinted }] as const;
          } catch {
            return [hall.id, { hasPending: false, hasPrinted: false }] as const;
          }
        }),
      );

      const statusMap = Object.fromEntries(entries) as Record<
        number,
        { hasPending: boolean; hasPrinted: boolean }
      >;

      setHalls((prev) =>
        prev.map((hall) => {
          const status = statusMap[hall.id];
          return {
            ...hall,
            hasPendingOrders: status?.hasPending ?? false,
            hasPrintedOrders: status?.hasPrinted ?? false,
          };
        }),
      );
    } catch (e) {
    }
  };

  const loadHalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const [rawHalls, rawFloors] = await Promise.all([
        fetchJson<any[]>(`${serverUrl}/halls`),
        fetchJson<any[]>(`${serverUrl}/floors`).catch(() => []),
      ]);

      const floorsData: FloorOption[] = (rawFloors || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        number: f.number ?? f.floor_number ?? 0,
      }));
      setFloors(floorsData);

      const mapped: Hall[] = rawHalls.map((h: any) => {
        const floorId = h.floor_id ?? null;
        const floor = floorId != null ? floorsData.find((f: any) => f.id === floorId) ?? null : null;
        return {
          id: h.id,
          name: h.name,
          number: h.number ?? h.hall_number,
          floor_id: floorId,
          floor: floor ? { id: floor.id, name: floor.name, number: floor.number } : null,
        };
      });
      setHalls(mapped);
      // Fire-and-forget aggregation of hall order statuses
      void updateHallStatuses(mapped);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل الصالات');
    } finally {
      setLoading(false);
    }
  };

  const loadTablesForHall = async (hallId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch tables via IPC and orders via HTTP in parallel
      // Tables must use IPC only (no HTTP) for Electron compatibility
      const serverUrl = getServerUrl();
      const [tablesRaw, ordersRaw] = await Promise.all([
        // Use IPC for tables if available (Electron mode), otherwise use HTTP (browser mode)
        (async () => {
          try {
            if (typeof window !== 'undefined' && window.sufra?.tables?.findByHall) {
              return await window.sufra.tables.findByHall(hallId);
            }
          } catch (error) {
            console.warn('[useOrders] IPC tables.findByHall failed, falling back to HTTP:', error);
          }
          // Fallback to HTTP (browser mode or IPC unavailable)
          return await fetchJson<any[]>(`${serverUrl}/halls/${hallId}/tables`);
        })(),
        fetchJson<any[]>(`${serverUrl}/orders/dine-in/hall/${hallId}`),
      ]);

      // Ensure tablesRaw is an array (handle null/undefined responses)
      const tablesArray = Array.isArray(tablesRaw) ? tablesRaw : [];
      const baseTables: TableEntity[] = tablesArray.map((t) => ({
        id: t.id,
        number: t.number ?? 1,
        hall_id: t.hall_id ?? hallId,
        name: t.name ?? '',
      }));

      // Create a map of table_id -> orders for O(1) lookup
      const ordersArray = Array.isArray(ordersRaw) ? ordersRaw : [];
      const ordersByTableId = new Map<number, any[]>();
      ordersArray.forEach((order: any) => {
        const tableId = order.table_id;
        if (!ordersByTableId.has(tableId)) {
          ordersByTableId.set(tableId, []);
        }
        ordersByTableId.get(tableId)!.push(order);
      });

      // Map tables with order status from the single orders response
      const tablesWithStatus: TableWithStatus[] = baseTables.map((table) => {
        const tableOrders = ordersByTableId.get(table.id) || [];
        const activeOrder = tableOrders.find(
          (o: any) => o.status === 'pending' || o.status === 'printed'
        );
        return {
          ...table,
          orderStatus: activeOrder ? activeOrder.status : null,
        };
      });

      setTables(tablesWithStatus);

      // Also update aggregate flags for this hall
      const hasPending = tablesWithStatus.some(
        (t) => t.orderStatus === 'pending',
      );
      const hasPrinted = tablesWithStatus.some(
        (t) => t.orderStatus === 'printed',
      );

      setHalls((prev) =>
        prev.map((hall) =>
          hall.id === hallId
            ? { ...hall, hasPendingOrders: hasPending, hasPrintedOrders: hasPrinted }
            : hall,
        ),
      );
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل الطاولات');
    } finally {
      setLoading(false);
    }
  };

  const selectHall = (hall: Hall) => {
    setActiveHallId(hall.id); // Update global store
    setSelectedTable(null);
    setOrders([]);
    // loadTablesForHall will be called automatically by useEffect when activeHallId changes
  };

  const selectTable = (table: TableEntity) => {
    setSelectedTable(table);
    // TODO: Load orders for this table when backend is ready
    // For now, just set empty array
    setOrders([]);
  };

  const backToHalls = () => {
    setActiveHallId(null); // Update global store
    setSelectedTable(null);
    setTables([]);
    setOrders([]);
  };

  const backToTables = () => {
    setSelectedTable(null);
    setOrders([]);
  };

  return {
    halls,
    floors,
    selectedHall,
    tables,
    selectedTable,
    orders,
    loading,
    error,
    selectHall,
    selectTable,
    backToHalls,
    backToTables,
    loadTablesForHall,
  };
}

