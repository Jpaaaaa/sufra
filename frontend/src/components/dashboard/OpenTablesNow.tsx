'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getServerUrl, fetchJson } from '../../utils';
import { Clock, User, ChevronLeft } from 'lucide-react';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { homeUi } from './home-ui';

interface OpenTable {
  id: string;
  tableNumber: string;
  waiterName: string;
  statusKey: string;
  waitingTime: string;
}

interface Order {
  id: number;
  table_id: number;
  status: string;
  created_at: string;
  table_name?: string;
  hall_name?: string;
}

function formatWaitingTime(createdAt: string, t: TFunction): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('home.waitLtMin');
  if (diffMins < 60) return t('home.waitMins', { count: diffMins });
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? t('home.waitHoursMins', { hours, mins }) : t('home.waitHours', { hours });
}

function getStatusLabel(status: string, t: TFunction): string {
  const statusMap: Record<string, string> = {
    pending: t('home.openStatusPending'),
    printed: t('home.openStatusPreparing'),
    completed: t('home.openStatusCompleted'),
    cancelled: t('home.openStatusCancelled'),
  };
  return statusMap[status] || status;
}

function statusChipClass(status: string): string {
  const map: Record<string, string> = {
    pending: homeUi.statusPending,
    printed: homeUi.statusPrinted,
    completed: homeUi.statusCompleted,
    cancelled: homeUi.statusCancelled,
  };
  return map[status] || homeUi.chipMuted;
}

function OpenTablesNow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tables, setTables] = useState<OpenTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { subscribeToOrders } = useOrderSocket();

  const loadOpenTables = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const dineInOrders = await fetchJson<Order[]>(`${serverUrl}/orders/dine-in/active`);
      const openTables: OpenTable[] = [];
      const processedTables = new Set<number>();

      for (const order of dineInOrders) {
        if (processedTables.has(order.table_id)) continue;
        processedTables.add(order.table_id);

        let tableName = order.table_name || t('orders.tableDefaultName', { number: order.table_id });
        if (order.hall_name && !tableName.includes(order.hall_name)) {
          tableName = `${tableName} (${order.hall_name})`;
        }

        openTables.push({
          id: order.table_id.toString(),
          tableNumber: tableName,
          waiterName: '—',
          statusKey: order.status,
          waitingTime: formatWaitingTime(order.created_at, t),
        });
      }

      openTables.sort((a, b) => {
        const aOrder = dineInOrders.find((o) => o.table_id.toString() === a.id);
        const bOrder = dineInOrders.find((o) => o.table_id.toString() === b.id);
        return (
          new Date(aOrder?.created_at || 0).getTime() - new Date(bOrder?.created_at || 0).getTime()
        );
      });

      setTables(openTables.slice(0, 5));
    } catch (error) {
      console.error('Failed to load open tables:', error);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOpenTables();
    const interval = setInterval(loadOpenTables, 60000);
    return () => clearInterval(interval);
  }, [loadOpenTables]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.orderType === 'dine-in' && (event.eventType === 'created' || event.eventType === 'updated')) {
          loadOpenTables();
        }
      },
      ['dine-in'],
    );
    return unsubscribe;
  }, [subscribeToOrders, loadOpenTables]);

  return (
    <section className={`${homeUi.surface} flex h-full flex-col overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h2 className={homeUi.sectionTitle}>{t('home.openTablesTitle')}</h2>
        <span className={`${homeUi.chip} ${homeUi.chipMuted} tabular-nums`}>
          {tables.length}
        </span>
      </header>

      <div className="flex-1 px-2 py-1">
        {isLoading ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.loading')}</p>
          </div>
        ) : tables.length === 0 ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.noOpenTables')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {tables.map((table) => (
              <li key={table.id}>
                <button
                  type="button"
                  onClick={() => navigate('/orders')}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start ${homeUi.rowHover}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-obsidian">
                        {table.tableNumber}
                      </span>
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusChipClass(table.statusKey)}`}
                      >
                        {getStatusLabel(table.statusKey, t)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-obsidian/50">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {table.waiterName}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-obsidian/65">
                        <Clock className="h-3 w-3 text-amber-500" />
                        {table.waitingTime}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 flex-shrink-0 text-obsidian/25 rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default memo(OpenTablesNow);
