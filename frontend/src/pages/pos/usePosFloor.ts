import { useCallback, useEffect, useState } from 'react';
import { fetchJson, getServerUrl } from '../../utils';
import { useOrders } from '../../hooks/useOrders';
import type { TableWithStatus } from '../../hooks/useOrders';

export type TableOccupancy = {
  since: string;
  itemCount: number;
  total: number;
  orderIds: number[];
};

export function usePosFloor() {
  const ordersApi = useOrders();
  const { tables, selectedHall, halls, selectHall, loadTablesForHall } = ordersApi;
  const [floorId, setFloorId] = useState<number | null>(null);
  const [occupancy, setOccupancy] = useState<Record<number, TableOccupancy>>({});
  const [moveSourceId, setMoveSourceId] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState<TableWithStatus | null>(null);
  const [actionTable, setActionTable] = useState<TableWithStatus | null>(null);

  const loadOccupancy = useCallback(async (hallId: number) => {
    try {
      const serverUrl = getServerUrl();
      const hallOrders = await fetchJson<Record<string, unknown>[]>(
        `${serverUrl}/orders/dine-in/hall/${hallId}`,
      );
      const map: Record<number, TableOccupancy> = {};
      for (const order of hallOrders) {
        const status = order.status as string;
        if (status !== 'pending' && status !== 'printed') continue;
        const tableId = order.table_id as number;
        const items = (order.items as { quantity?: number }[]) || [];
        const itemCount = items.reduce((n, it) => n + Number(it.quantity || 0), 0);
        const created = String(order.created_at || '');
        const total = Number(order.total || 0);
        const id = Number(order.id);
        if (!map[tableId]) {
          map[tableId] = { since: created, itemCount, total, orderIds: [id] };
        } else {
          map[tableId].itemCount += itemCount;
          map[tableId].total += total;
          map[tableId].orderIds.push(id);
          if (created && created < map[tableId].since) map[tableId].since = created;
        }
      }
      setOccupancy(map);
    } catch {
      setOccupancy({});
    }
  }, []);

  useEffect(() => {
    if (selectedHall) void loadOccupancy(selectedHall.id);
  }, [selectedHall, tables, loadOccupancy]);

  const selectFloor = useCallback(
    (id: number | null) => {
      setFloorId(id);
      if (id == null) return;
      const onFloor = halls.filter((h) => h.floor_id === id);
      if (onFloor.length === 0) return;
      const currentOk = selectedHall && onFloor.some((h) => h.id === selectedHall.id);
      if (!currentOk) selectHall(onFloor[0]);
    },
    [halls, selectedHall, selectHall],
  );

  const startMove = (tableId: number) => {
    setMoveSourceId(tableId);
    setActionTable(null);
  };

  const cancelMove = () => {
    setMoveSourceId(null);
    setMoveTarget(null);
  };

  const handleMoveConfirm = async (): Promise<number> => {
    if (moveSourceId == null || !moveTarget) return 0;
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<{ movedCount: number }>(`${serverUrl}/orders/dine-in/move-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_table_id: moveSourceId, target_table_id: moveTarget.id }),
      });
      const count = result?.movedCount ?? 0;
      if (count > 0) {
        window.dispatchEvent(new CustomEvent('refresh-tables'));
        if (selectedHall) void loadTablesForHall(selectedHall.id);
      }
      return count;
    } catch (err) {
      throw err;
    } finally {
      cancelMove();
    }
  };

  return {
    ...ordersApi,
    floorId,
    selectFloor,
    occupancy,
    moveSourceId,
    moveTarget,
    setMoveTarget,
    actionTable,
    setActionTable,
    startMove,
    cancelMove,
    handleMoveConfirm,
  };
}
