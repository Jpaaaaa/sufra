import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableEntity } from '../../utils';
import { ConfirmMoveDialog } from '../../components/orders/ConfirmMoveDialog';

interface TableWithStatus extends TableEntity {
  orderStatus?: 'pending' | 'printed' | 'none' | null;
}

interface TablesGridProps {
  tables: TableWithStatus[];
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
  loading,
  dropTargetId,
  moveInProgress,
  dragSourceRef,
  onTableClick,
  onMoveTable,
  onDropTargetChange,
}: TablesGridProps) {
  const { t } = useTranslation();
  const [pendingMove, setPendingMove] = useState<{ sourceId: number; targetId: number } | null>(null);

  const tableLabel = (name: string | null | undefined, number: number) =>
    name?.trim() ? name : t('orders.tableDefaultName', { number });

  const getStatusStyle = (orderStatus: string | null | undefined) => {
    if (orderStatus === 'pending') {
      return { border: 'border-amber-300', bg: 'bg-amber-50/50', iconColor: '#B45309', textColor: 'text-amber-800', badgeBg: 'bg-amber-100/80', statusDot: 'bg-amber-500' };
    }
    if (orderStatus === 'printed') {
      return { border: 'border-emerald-300', bg: 'bg-emerald-50/50', iconColor: '#047857', textColor: 'text-emerald-800', badgeBg: 'bg-emerald-100/80', statusDot: 'bg-emerald-500' };
    }
    return { border: 'border-stone-200', bg: 'bg-white', iconColor: '#78716c', textColor: 'text-stone-700', badgeBg: 'bg-stone-50', statusDot: 'bg-stone-300' };
  };

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
    <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {tables.map((table) => {
        const style = getStatusStyle(table.orderStatus);
        const hasOrders = !!(table.orderStatus && table.orderStatus !== 'none');
        const isDropTarget = dropTargetId === table.id;

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
            onDragLeave={() => { if (dropTargetId === table.id) onDropTargetChange(null); }}
            onDrop={(e) => {
              e.preventDefault();
              onDropTargetChange(null);
              try {
                const data = e.dataTransfer.getData('application/json');
                if (!data) return;
                const { tableId } = JSON.parse(data);
                if (tableId !== table.id) setPendingMove({ sourceId: tableId, targetId: table.id });
              } catch { /* ignore */ }
            }}
            onDragEnd={() => {
              dragSourceRef.current = null;
              onDropTargetChange(null);
            }}
            onClick={() => onTableClick(table)}
            className={`group relative flex flex-col items-center justify-between rounded-xl border p-5 ${style.border} ${style.bg} hover:border-stone-300 hover:shadow-md overflow-hidden aspect-square transition-all cursor-default ${hasOrders ? 'cursor-grab active:cursor-grabbing' : ''} ${isDropTarget ? 'ring-2 ring-cyber-aqua ring-offset-2 scale-[1.02]' : ''}`}
          >
            {hasOrders && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${style.statusDot}`} />
              </div>
            )}
            <div className="flex-1 flex items-center justify-center w-full">
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="max-w-[80px] max-h-[80px]">
                <rect x="18" y="35" width="64" height="22" rx="4" fill="#E8E6E3" stroke={style.iconColor} strokeWidth="2" />
                <line x1="28" y1="57" x2="28" y2="88" stroke={style.iconColor} strokeWidth="2.5" strokeLinecap="round" />
                <line x1="72" y1="57" x2="72" y2="88" stroke={style.iconColor} strokeWidth="2.5" strokeLinecap="round" />
                <line x1="38" y1="57" x2="38" y2="85" stroke={style.iconColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                <line x1="62" y1="57" x2="62" y2="85" stroke={style.iconColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>
            <div className={`w-full rounded-lg ${style.badgeBg} px-3 py-2.5 mt-2 border border-stone-100`}>
              <p className={`text-center text-[15px] font-semibold ${style.textColor} truncate`}>
                {tableLabel(table.name, table.number)}
              </p>
              {hasOrders && (
                <p className="text-center text-[11px] font-medium text-stone-500 mt-0.5">
                  {table.orderStatus === 'pending' ? t('orders.hallStatusWaiting') : t('orders.hallStatusPrinted')}
                </p>
              )}
            </div>
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
