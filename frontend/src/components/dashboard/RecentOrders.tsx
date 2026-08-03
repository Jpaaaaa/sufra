'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson, Hall } from '../../utils';
import { Clock } from 'lucide-react';
import Card from '../ui/Card';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { useOrderLocale } from '../../hooks/useOrderLocale';

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
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    printed: 'bg-cyber-aqua/10 text-cyber-aqua border-cyber-aqua/20',
    completed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
  };
  return configs[status];
}

const STORAGE_KEY = 'sufra_cleared_order_ids';

export default function RecentOrders() {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
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

      allOrders.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const recentOrders: RecentOrder[] = allOrders
        .filter((order) => !clearedOrderIdsRef.current.has(order.id.toString()))
        .slice(0, 10)
        .map((order) => {
          const tableLabel =
            order.table_name || t('orders.tableDefaultName', { number: order.table_number ?? order.table_id });
          const parts = [tableLabel];
          if (order.hall_name) parts.push(order.hall_name);
          if (order.floor_name) parts.push(order.floor_name);
          const tableNumber = parts.join(' · ');

          return {
            id: order.id.toString(),
            orderId: `#${order.id}`,
            tableNumber,
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
    <Card className="rounded-xl shadow-soft border border-black/5 bg-white p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[20px] leading-tight font-medium text-obsidian">{t('home.recentOrdersTitle')}</h2>
      </div>

      {isLoading ? (
        <div className="text-center text-obsidian/60 py-8">{t('home.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-obsidian/60 py-8">{t('home.noRecentOrders')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/5">
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colOrderId')}</th>
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colTable')}</th>
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colTotal')}</th>
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colStatus')}</th>
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colTime')}</th>
                <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">{t('home.colNote')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr
                  key={order.id}
                  className={`border-b border-black/5 hover:bg-cloud-soft-white ${
                    index === orders.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <span className="text-[14px] font-medium text-obsidian">{order.orderId}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[14px] text-obsidian/80">{order.tableNumber}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[14px] font-medium text-obsidian">
                      {order.total.toLocaleString(numberLocale)} {t('orders.currency')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-lg text-[12px] font-medium border ${statusClass(order.status)}`}
                    >
                      {statusLabel(order.status, t)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-obsidian/40" />
                      <span className="text-[13px] text-obsidian/70">{order.time}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {order.note ? (
                      <span className="text-[13px] text-obsidian/70 max-w-xs truncate block" title={order.note}>
                        {order.note}
                      </span>
                    ) : (
                      <span className="text-[13px] text-obsidian/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
