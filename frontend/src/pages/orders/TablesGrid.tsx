import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableEntity } from '../../utils';
import { ConfirmMoveDialog } from '../../components/orders/ConfirmMoveDialog';
import { formatElapsedShort } from '../pos/format-elapsed';
import type { OrdersTableOccupancy } from './useOrdersPage';

interface TableWithStatus extends TableEntity {
  orderStatus?: 'pending' | 'printed' | 'none' | null;
}

interface TablesGridProps {
  tables: TableWithStatus[];
  occupancy: Record<number, OrdersTableOccupancy>;
  loading: boolean;
  dropTargetId: number | null;
  moveInProgress: boolean;
  dragSourceRef: React.MutableRefObject<number | null>;
  onTableClick: (table: TableEntity) => void;
  onMoveTable: (sourceId: number, targetId: number) => void;
  onDropTargetChange: (id: number | null) => void;
}

export function TablesGrid({
  tables,
  occupancy,
  loading,
  dropTargetId,
  moveInProgress,
  dragSourceRef,
  onTableClick,
  onMoveTable,
  onDropTargetChange,
}: TablesGridProps) {
  const { t, i18n } = useTranslation();
  const [pendingMove, setPendingMove] = useState<{ sourceId: number; targetId: number } | null>(null);

  const tableLabel = (name: string | null | undefined, number: number) =>
    name?.trim() ? name : t('orders.tableDefaultName', { number });

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-[15px] leading-normal font-light text-obsidian/60">
        {t('orders.loadingTables')}
      </div>
    );
  }
  if (tables.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
        {t('orders.emptyTablesInHall')}
      </div>
    );
  }

  return (
    <div className="ow-tables">
      {tables.map((table) => {
        const hasOrders = !!(table.orderStatus && table.orderStatus !== 'none');
        const occ = occupancy[table.id];
        const isDropTarget = dropTargetId === table.id;
        const statusClass =
          table.orderStatus === 'pending' ? 'is-wait' : table.orderStatus === 'printed' ? 'is-sent' : 'is-free';

        return (
          <button
            key={table.id}
            type="button"
            draggable={hasOrders && !moveInProgress}
            onDragStart={(e) => {
              if (!hasOrders) return;
              dragSourceRef.current = table.id;
              e.dataTransfer.setData(
                'application/json',
                JSON.stringify({ tableId: table.id, tableName: tableLabel(table.name, table.number) }),
              );
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnter={(e) => {
              if (moveInProgress) return;
              const src = dragSourceRef.current;
              if (src != null && src !== table.id) e.preventDefault();
            }}
            onDragOver={(e) => {
              if (moveInProgress) return;
              const src = dragSourceRef.current;
              if (src != null && src !== table.id) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                onDropTargetChange(table.id);
              }
            }}
            onDragLeave={() => {
              if (dropTargetId === table.id) onDropTargetChange(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropTargetChange(null);
              try {
                const data = e.dataTransfer.getData('application/json');
                if (!data) return;
                const { tableId } = JSON.parse(data);
                if (tableId !== table.id) setPendingMove({ sourceId: tableId, targetId: table.id });
              } catch {
                /* ignore */
              }
            }}
            onDragEnd={() => {
              dragSourceRef.current = null;
              onDropTargetChange(null);
            }}
            onClick={() => onTableClick(table)}
            className={`ow-table ${statusClass} ${isDropTarget ? 'is-drop' : ''} ${hasOrders ? 'cursor-grab' : ''}`}
          >
            <span className={`ow-table-pill ${statusClass}`}>
              {table.orderStatus === 'pending'
                ? t('orders.hallStatusWaiting')
                : table.orderStatus === 'printed'
                  ? t('orders.hallStatusPrinted')
                  : t('orders.legendFree')}
            </span>
            <svg
              className="ow-table-icon"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <rect x="18" y="35" width="64" height="22" rx="4" fill="#E8E6E3" stroke="currentColor" strokeWidth="2" />
              <line x1="28" y1="57" x2="28" y2="88" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="72" y1="57" x2="72" y2="88" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="38" y1="57" x2="38" y2="85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              <line x1="62" y1="57" x2="62" y2="85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            </svg>
            <span className="ow-table-foot">
              <span className="ow-table-num tabular-nums">{table.number}</span>
              <span className="ow-table-name">{tableLabel(table.name, table.number)}</span>
              {hasOrders && occ ? (
                <span className="ow-table-meta tabular-nums">
                  {formatElapsedShort(occ.since, i18n.language)}
                  {' · '}
                  {t('orders.itemCount', { count: occ.itemCount })}
                  {' · '}
                  {Math.round(occ.total)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      {pendingMove && (() => {
        const sourceTable = tables.find((tbl) => tbl.id === pendingMove.sourceId);
        const targetTable = tables.find((tbl) => tbl.id === pendingMove.targetId);
        const sourceName = tableLabel(sourceTable?.name, sourceTable?.number ?? pendingMove.sourceId);
        const targetName = tableLabel(targetTable?.name, targetTable?.number ?? pendingMove.targetId);
        return (
          <ConfirmMoveDialog
            open={true}
            title={t('orders.confirmMoveTitle')}
            message={t('orders.confirmMoveMessage', { source: sourceName, target: targetName })}
            onConfirm={() => {
              onMoveTable(pendingMove.sourceId, pendingMove.targetId);
              setPendingMove(null);
            }}
            onCancel={() => setPendingMove(null)}
          />
        );
      })()}
    </div>
  );
}
