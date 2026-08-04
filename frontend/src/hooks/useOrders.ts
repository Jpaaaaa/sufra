import { useState, useEffect, useRef } from 'react';
import { getServerUrl, Hall, TableEntity, fetchJson } from '../utils';
import { useHallStore } from '../../stores/hallStore';
import { useFloorsStore } from '../../stores/floorsStore';
import { useHallsStore } from '../../stores/hallsStore';
import { useTablesStore } from '../../stores/tablesStore';
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
  const activeHallId = useHallStore((state) => state.activeHallId);
  const setActiveHallId = useHallStore((state) => state.setActiveHallId);
  const halls = useHallsStore((state) => state.halls);
  const loadHallsFromStore = useHallsStore((state) => state.loadHalls);
  const updateHallInStore = useHallsStore((state) => state.updateHall);
  const floorsFromStore = useFloorsStore((state) => state.floors);
  const loadFloorsFromStore = useFloorsStore((state) => state.loadFloors);
  const loadTablesFromStore = useTablesStore((state) => state.loadTablesForHall);
  const { subscribeToOrders } = useOrderSocket();

  const floors: FloorOption[] = floorsFromStore.map((f) => ({
    id: f.id,
    name: f.name,
    number: f.number,
  }));

  const [tables, setTables] = useState<TableWithStatus[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableEntity | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hallsRef = useRef<Hall[]>([]);

  useEffect(() => {
    hallsRef.current = halls;
  }, [halls]);

  const selectedHall = halls.find((h) => h.id === activeHallId) || null;

  useEffect(() => {
    void loadHalls();
  }, []);

  useEffect(() => {
    const onHallsChanged = () => void loadHalls();
    window.addEventListener('structure:halls-changed', onHallsChanged);
    return () => window.removeEventListener('structure:halls-changed', onHallsChanged);
  }, []);

  useEffect(() => {
    if (halls.length > 0) {
      useHallStore.getState().validateActiveHall(halls);
    }
  }, [halls]);

  useEffect(() => {
    if (activeHallId !== null) {
      void loadTablesForHall(activeHallId);
    } else {
      setTables([]);
    }
  }, [activeHallId]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.orderType === 'dine-in' && activeHallId !== null) {
          const orderHallId = event.order?.hall_id;
          if (orderHallId === activeHallId) {
            void loadTablesForHall(activeHallId);
          }
          void updateHallStatuses(hallsRef.current);
        }
      },
      ['dine-in'],
    );

    return unsubscribe;
  }, [subscribeToOrders, activeHallId]);

  useEffect(() => {
    const handleRefreshTables = (event: CustomEvent<{ hallId?: number }>) => {
      const targetHallId = event.detail?.hallId ?? activeHallId;
      if (targetHallId !== null) {
        void loadTablesForHall(targetHallId);
        void updateHallStatuses(hallsRef.current);
      }
    };

    window.addEventListener('refresh-tables' as string, handleRefreshTables as EventListener);
    return () => {
      window.removeEventListener('refresh-tables' as string, handleRefreshTables as EventListener);
    };
  }, [activeHallId]);

  const updateHallStatuses = async (hallsList: Hall[]) => {
    try {
      const entries = await Promise.all(
        hallsList.map(async (hall) => {
          try {
            const serverUrl = getServerUrl();
            const hallOrders = await fetchJson<Record<string, unknown>[]>(
              `${serverUrl}/orders/dine-in/hall/${hall.id}`,
            );

            const hasPending = hallOrders.some((o) => o.status === 'pending');
            const hasPrinted = hallOrders.some((o) => o.status === 'printed');

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

      for (const hall of hallsList) {
        const status = statusMap[hall.id];
        updateHallInStore(hall.id, {
          hasPendingOrders: status?.hasPending ?? false,
          hasPrintedOrders: status?.hasPrinted ?? false,
        });
      }
    } catch {
      /* ignore */
    }
  };

  const loadHalls = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadHallsFromStore(),
        loadFloorsFromStore(),
      ]);
      const loadedHalls = useHallsStore.getState().halls;
      void updateHallStatuses(loadedHalls);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر تحميل الصالات';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadTablesForHall = async (hallId: number) => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const [baseTables, ordersRaw] = await Promise.all([
        loadTablesFromStore(hallId, true),
        fetchJson<Record<string, unknown>[]>(
          `${serverUrl}/orders/dine-in/hall/${hallId}`,
        ),
      ]);

      const ordersArray = Array.isArray(ordersRaw) ? ordersRaw : [];
      const ordersByTableId = new Map<number, Record<string, unknown>[]>();
      ordersArray.forEach((order) => {
        const tableId = order.table_id as number;
        if (!ordersByTableId.has(tableId)) {
          ordersByTableId.set(tableId, []);
        }
        ordersByTableId.get(tableId)!.push(order);
      });

      const tablesWithStatus: TableWithStatus[] = baseTables.map((table) => {
        const tableOrders = ordersByTableId.get(table.id) || [];
        const activeOrder = tableOrders.find(
          (o) => o.status === 'pending' || o.status === 'printed',
        );
        return {
          ...table,
          orderStatus: activeOrder ? (activeOrder.status as 'pending' | 'printed') : null,
        };
      });

      setTables(tablesWithStatus);

      const hasPending = tablesWithStatus.some((t) => t.orderStatus === 'pending');
      const hasPrinted = tablesWithStatus.some((t) => t.orderStatus === 'printed');

      updateHallInStore(hallId, {
        hasPendingOrders: hasPending,
        hasPrintedOrders: hasPrinted,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر تحميل الطاولات';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const selectHall = (hall: Hall) => {
    setActiveHallId(hall.id);
    setSelectedTable(null);
    setOrders([]);
  };

  const selectTable = (table: TableEntity) => {
    setSelectedTable(table);
    setOrders([]);
  };

  const backToHalls = () => {
    setActiveHallId(null);
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
