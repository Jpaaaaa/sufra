import { useEffect, useState } from 'react';
import { useOrderModal } from '../../hooks/useOrderModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import type { Hall, TableEntity } from '../../utils';
import { usePosConnectionStatus } from './components/PosConnectionDot';

export function usePosTableOrder(table: TableEntity, hall: Hall | null, onSilentRefresh?: () => void) {
  const modal = useOrderModal(table, hall);
  const { subscribeToOrders } = useOrderSocket();
  const connection = usePosConnectionStatus();
  const [conflict, setConflict] = useState(false);
  const [undoOrderId, setUndoOrderId] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToOrders((event) => {
      const oid = event.order?.table_id;
      if (oid !== table.id) return;
      if (modal.selectedItems.length === 0) {
        setConflict(false);
        onSilentRefresh?.();
      } else {
        setConflict(true);
      }
    }, ['dine-in']);
    return unsub;
  }, [subscribeToOrders, table.id, modal.selectedItems.length, onSilentRefresh]);

  return {
    ...modal,
    connection,
    conflict,
    setConflict,
    undoOrderId,
    setUndoOrderId,
  };
}
