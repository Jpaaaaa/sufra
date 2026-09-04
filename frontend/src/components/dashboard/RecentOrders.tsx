'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getServerUrl, fetchJson, Hall } from '../../utils';
import { Clock } from 'lucide-react';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { homeUi } from './home-ui';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface RecentOrder {
  id: string;
  orderId: string;
  tableNumber: string;
  total: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled';
  time: string;
  note: string;
}

interface Order {
  id: number;
  display_number?: number | null;
  table_id: number;
  status: string;
  total: number;
  created_at: string;
  table_name?: string;
  table_number?: number;
  hall_name?: string;
  floor_name?: string;
  note?: string;
}

function formatTimeAgo(createdAt: string, t: TFunction): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('home.timeNow');
  if (diffMins < 60) return t('home.timeMinsAgo', { count: diffMins });
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) {
    return mins > 0
      ? t('home.timeHoursMinsAgo', { hours, mins })
      : t('home.timeHoursAgo', { hours });
  }
  const days = Math.floor(hours / 24);
  return t('home.timeDaysAgo', { count: days });
}

const mapOrderStatus = (status: string): RecentOrder['status'] => {
  const statusMap: Record<string, RecentOrder['status']> = {
    pending: 'pending',
    printed: 'printed',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  return statusMap[status] || 'pending';
};

function statusLabel(status: RecentOrder['status'], t: TFunction): string {
  const map: Record<RecentOrder['status'], string> = {
    pending: t('orders.statusPending'),
    printed: t('orders.statusPrinted'),
    completed: t('orders.statusCompleted'),
    cancelled: t('orders.statusCancelled'),
  };
  return map[status];
}

function statusClass(status: RecentOrder['status']): string {
  const configs: Record<RecentOrder['status'], string> = {
    pending: homeUi.statusPending,
    printed: homeUi.statusPrinted,
    completed: homeUi.statusCompleted,
    cancelled: homeUi.statusCancelled,
  };
  return configs[status];
}

function fmtMoney(n: number): string {
  return Math.round(n || 0).toLocaleString('en-US');
}

const STORAGE_KEY = 'sufra_cleared_order_ids';

function RecentOrders() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clearedOrderIds, setClearedOrderIds] = useState<Set<string>>(new Set());
  const clearedOrderIdsRef = useRef<Set<string>>(new Set());
  const { subscribeToOrders } = useOrderSocket();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        const clearedSet = new Set(parsed);
        setClearedOrderIds(clearedSet);
        clearedOrderIdsRef.current = clearedSet;
      }
    } catch (error) {
      console.error('Failed to load cleared order IDs from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    clearedOrderIdsRef.current = clearedOrderIds;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(clearedOrderIds)));
    } catch (error) {
      console.error('Failed to save cleared order IDs to localStorage:', error);
    }
  }, [clearedOrderIds]);

  const loadRecentOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverUrl = getServerUrl();
      const allOrders: Order[] = [];
      try {
        const halls = await fetchJson<Hall[]>(`${serverUrl}/halls`);
        for (const hall of halls) {
          try {
            const hallOrders = await fetchJson<Order[]>(`${serverUrl}/orders/dine-in/hall/${hall.id}`);
            allOrders.push(...hallOrders);
          } catch (error) {
            console.error(`Failed to load orders for hall ${hall.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to load halls:', error);
      }

      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const recentOrders: RecentOrder[] = allOrders
        .filter((order) => !clearedOrderIdsRef.current.has(order.id.toString()))
        .slice(0, 8)
        .map((order) => {
          const tableLabel =
            order.table_name ||
            t('orders.tableDefaultName', { number: order.table_number ?? order.table_id });
          const parts = [tableLabel];
          if (order.hall_name) parts.push(order.hall_name);
          return {
            id: order.id.toString(),
            orderId: `#${orderDisplayNumber(order)}`,
            tableNumber: parts.join(' · '),
            total: order.total || 0,
            status: mapOrderStatus(order.status),
            time: formatTimeAgo(order.created_at, t),
            note: order.note || '',
          };
        });

      setOrders(recentOrders);
    } catch (error) {
      console.error('Failed to load recent orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRecentOrders();
    const interval = setInterval(loadRecentOrders, 60000);
    return () => clearInterval(interval);
  }, [loadRecentOrders]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.eventType === 'created' || event.eventType === 'updated') {
          loadRecentOrders();
        }
      },
      ['dine-in', 'pickup', 'delivery'],
    );
    return unsubscribe;
  }, [subscribeToOrders, loadRecentOrders]);

  return (
    <section className={`${homeUi.surface} flex h-full flex-col overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h2 className={homeUi.sectionTitle}>{t('home.recentOrdersTitle')}</h2>
        <span className={`${homeUi.chip} ${homeUi.chipMuted} tabular-nums`}>{orders.length}</span>
      </header>

      <div className="flex-1 overflow-x-auto">
        {isLoading ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.loading')}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={homeUi.emptyState}>
            <p className={homeUi.emptyTitle}>{t('home.noRecentOrders')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-black/5 bg-cloud-soft-white/60">
                {[
                  t('home.colOrderId'),
                  t('home.colTable'),
                  t('home.colTotal'),
                  t('home.colStatus'),
                  t('home.colTime'),
                ].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-obsidian/45"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate('/orders')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/orders');
                    }
                  }}
                  className={`cursor-pointer border-b border-black/5 last:border-b-0 ${homeUi.rowHover}`}
                >
                  <td className="px-3 py-2.5">
                    <span className="text-[13px] font-semibold tabular-nums text-obsidian">
                      {order.orderId}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block max-w-[140px] truncate text-[13px] text-obsidian/70">
                      {order.tableNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[13px] font-semibold tabular-nums text-obsidian">
                      {fmtMoney(order.total)}{' '}
                      <span className="font-medium text-obsidian/45">{t('orders.currency')}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusClass(order.status)}`}
                    >
                      {statusLabel(order.status, t)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-[12px] text-obsidian/55">
                      <Clock className="h-3 w-3" />
                      {order.time}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default memo(RecentOrders);
