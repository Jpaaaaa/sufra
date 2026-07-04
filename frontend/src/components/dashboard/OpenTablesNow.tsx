'use client';

import { useEffect, useState, useCallback } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../utils';
import { Clock, User } from 'lucide-react';
import Card from '../ui/Card';
import { useOrderSocket } from '../../hooks/useOrderSocket';

interface OpenTable {
  id: string;
  tableNumber: string;
  waiterName: string;
  status: string;
  waitingTime: string;
}

interface Order {
  id: number;
  table_id: number;
  status: string;
  created_at: string;
  table_name?: string;
  hall_name?: string;
  note?: string;
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

export default function OpenTablesNow() {
  const { t } = useTranslation();
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
          status: getStatusLabel(order.status, t),
          waitingTime: formatWaitingTime(order.created_at, t),
        });
      }

      openTables.sort((a, b) => {
        const aOrder = dineInOrders.find((o) => o.table_id.toString() === a.id);
        const bOrder = dineInOrders.find((o) => o.table_id.toString() === b.id);
        const aTime = aOrder?.created_at || '';
        const bTime = bOrder?.created_at || '';
        return new Date(aTime).getTime() - new Date(bTime).getTime();
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
    <Card className="rounded-xl shadow-soft border border-black/5 bg-white p-6 mb-6">
      <h2 className="text-[20px] leading-tight font-medium text-obsidian mb-6">{t('home.openTablesTitle')}</h2>

      {isLoading ? (
        <div className="text-center text-obsidian/60 py-8">{t('home.loading')}</div>
      ) : tables.length === 0 ? (
        <div className="text-center text-obsidian/60 py-8">{t('home.noOpenTables')}</div>
      ) : (
        <div className="space-y-0">
          <div className="grid grid-cols-4 gap-4 pb-3 mb-3 border-b border-black/5">
            <div className="text-[13px] font-medium text-obsidian/70">{t('home.colTable')}</div>
            <div className="text-[13px] font-medium text-obsidian/70">{t('home.colWaiter')}</div>
            <div className="text-[13px] font-medium text-obsidian/70">{t('home.colStatus')}</div>
            <div className="text-[13px] font-medium text-obsidian/70">{t('home.colWaitingTime')}</div>
          </div>

          {tables.slice(0, 5).map((table, index) => (
            <div key={table.id}>
              <div className="grid grid-cols-4 gap-4 py-3.5">
                <div className="flex items-center">
                  <span className="text-[14px] font-medium text-obsidian">{table.tableNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-obsidian/40" />
                  <span className="text-[14px] text-obsidian/80">{table.waiterName}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[13px] text-obsidian/70">{table.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-[14px] font-medium text-obsidian">{table.waitingTime}</span>
                </div>
              </div>
              {index < Math.min(tables.length, 5) - 1 && <div className="h-px bg-black/5" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
