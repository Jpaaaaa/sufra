import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmMoveDialog } from '../../components/orders/ConfirmMoveDialog';
import { showConfirm } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { fetchJson, getServerUrl } from '../../utils';
import { PosHallRail } from './components/PosHallRail';
import { PosMoveBanner } from './components/PosMoveBanner';
import { PosTableActionSheet } from './components/PosTableActionSheet';
import { PosTableCard } from './components/PosTableCard';
import { PosTopBar } from './components/PosTopBar';
import { usePosFloor } from './usePosFloor';

export default function PosFloorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWaiter = user?.role === 'waiter';
  const suppressClick = useRef(false);
  const floor = usePosFloor();

  const onCardPress = (tableId: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (floor.moveSourceId != null) {
      const table = floor.tables.find((tb) => tb.id === tableId);
      if (table && table.id !== floor.moveSourceId) floor.setMoveTarget(table);
      return;
    }
    const hallId = floor.selectedHall?.id;
    if (hallId) navigate(`/pos/table/${hallId}/${tableId}`);
  };

  const cancelOrders = async (ids: number[]) => {
    const ok = await showConfirm({
      title: t('pos.cancelOrder'),
      message: t('pos.cancelOrderConfirm'),
      confirmText: t('pos.cancelOrder'),
      cancelText: t('pos.cancel'),
      confirmColor: 'danger',
    });
    if (!ok) return;
    const serverUrl = getServerUrl();
    for (const id of ids) {
      await fetchJson(`${serverUrl}/orders/dine-in/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
    }
    window.dispatchEvent(new CustomEvent('refresh-tables'));
    if (floor.selectedHall) void floor.loadTablesForHall(floor.selectedHall.id);
  };

  return (
    <>
      <PosTopBar
        title={floor.selectedHall?.name || t('pos.floor')}
        sessionDetail
        homeOpensSession={isWaiter}
        onBack={() => {
          if (floor.moveSourceId != null) {
            floor.cancelMove();
            return;
          }
          if (!isWaiter) navigate('/orders');
        }}
      />
      <div className="pos-body">
        <PosHallRail
          halls={floor.halls}
          floors={floor.floors}
          selectedHallId={floor.selectedHall?.id ?? null}
          selectedFloorId={floor.floorId}
          onSelectHall={floor.selectHall}
          onSelectFloor={floor.selectFloor}
        />
        <div className="pos-content">
          {floor.moveSourceId != null && <PosMoveBanner onCancel={floor.cancelMove} />}
          {floor.error && <div className="text-[13px] text-red-500">{floor.error}</div>}
          <div className="pos-floor-toolbar">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">
                {floor.selectedHall?.name || t('pos.floor')}
              </div>
              <div className="text-[13px] text-graphite tabular-nums">
                {t('pos.tableCount', { count: floor.tables.length })}
                {' · '}
                {t('pos.occupiedCount', {
                  count: floor.tables.filter((tb) => tb.orderStatus).length,
                })}
              </div>
            </div>
            <div className="pos-legend" aria-hidden>
              <span className="pos-legend-i is-free">{t('pos.free')}</span>
              <span className="pos-legend-i is-pending">{t('pos.pending')}</span>
              <span className="pos-legend-i is-printed">{t('pos.printed')}</span>
            </div>
          </div>
          <div className="pos-floor-stage">
            <div className="pos-tables">
              {floor.tables.map((table) => (
                <PosTableCard
                  key={table.id}
                  table={table}
                  occupancy={floor.occupancy[table.id]}
                  moveSourceId={floor.moveSourceId}
                  moveMode={floor.moveSourceId != null}
                  onPress={() => onCardPress(table.id)}
                  onLongPress={() => {
                    if (!table.orderStatus) return;
                    suppressClick.current = true;
                    floor.setActionTable(table);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <PosTableActionSheet
        open={Boolean(floor.actionTable)}
        onClose={() => floor.setActionTable(null)}
        onMove={() => {
          if (floor.actionTable) floor.startMove(floor.actionTable.id);
        }}
        onPrint={() => {
          const table = floor.actionTable;
          const hallId = floor.selectedHall?.id;
          floor.setActionTable(null);
          if (table && hallId) navigate(`/pos/table/${hallId}/${table.id}`, { state: { print: true } });
        }}
        onDiscount={() => {
          const table = floor.actionTable;
          const hallId = floor.selectedHall?.id;
          floor.setActionTable(null);
          if (table && hallId) navigate(`/pos/table/${hallId}/${table.id}`, { state: { discount: true } });
        }}
        onCancelOrder={() => {
          const table = floor.actionTable;
          floor.setActionTable(null);
          if (table) void cancelOrders(floor.occupancy[table.id]?.orderIds ?? []);
        }}
      />
      <ConfirmMoveDialog
        open={Boolean(floor.moveTarget)}
        title={t('pos.moveTable')}
        message={t('pos.moveConfirm')}
        onCancel={() => floor.setMoveTarget(null)}
        onConfirm={() => {
          void floor.handleMoveConfirm().then((count) => {
            if (count > 0) showToast(t('pos.movedCount', { count }), 'success');
          }).catch(() => showToast(t('pos.moveFailed'), 'error'));
        }}
      />
    </>
  );
}
