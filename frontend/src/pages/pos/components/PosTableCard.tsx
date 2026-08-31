import { useTranslation } from 'react-i18next';
import { formatElapsedShort } from '../format-elapsed';
import type { TableOccupancy } from '../usePosFloor';
import type { TableWithStatus } from '../../../hooks/useOrders';

const STALE_MS = 45 * 60 * 1000;

export function PosTableCard({
  table,
  occupancy,
  moveSourceId,
  moveMode,
  onPress,
  onLongPress,
}: {
  table: TableWithStatus;
  occupancy: TableOccupancy | undefined;
  moveSourceId: number | null;
  moveMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const occupied = Boolean(table.orderStatus);
  const stale =
    occupied && occupancy?.since
      ? Date.now() - new Date(occupancy.since).getTime() > STALE_MS
      : false;

  const statusClass =
    table.orderStatus === 'pending'
      ? 'is-pending'
      : table.orderStatus === 'printed'
        ? 'is-printed'
        : '';

  const statusLabel =
    table.orderStatus === 'pending'
      ? t('pos.pending')
      : table.orderStatus === 'printed'
        ? t('pos.printed')
        : t('pos.free');

  return (
    <button
      type="button"
      className={`pos-table-card ${statusClass} ${
        moveSourceId === table.id ? 'is-move-source' : ''
      } ${moveMode && moveSourceId !== table.id ? 'is-move-target' : ''}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const id = window.setTimeout(onLongPress, 500);
        const clear = () => {
          window.clearTimeout(id);
          window.removeEventListener('pointerup', clear);
          window.removeEventListener('pointercancel', clear);
        };
        window.addEventListener('pointerup', clear);
        window.addEventListener('pointercancel', clear);
      }}
      onClick={onPress}
    >
      {stale && <span className="pos-stale-dot" />}
      <div className="pos-table-card-top">
        <span className="pos-table-num tabular-nums">{table.number}</span>
        <span className="pos-table-pill">{statusLabel}</span>
      </div>
      {occupied && occupancy ? (
        <>
          <div className="pos-table-meta tabular-nums">
            {formatElapsedShort(occupancy.since, i18n.language)} · {occupancy.itemCount}{' '}
            {t('pos.items')}
          </div>
          <div className="pos-table-total tabular-nums">{occupancy.total.toFixed(0)}</div>
        </>
      ) : (
        <div className="pos-table-meta">{t('pos.tapToOpen')}</div>
      )}
    </button>
  );
}
