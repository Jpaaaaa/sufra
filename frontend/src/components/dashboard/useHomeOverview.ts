import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchReports } from '../../lib/reports/utils';
import type { GraphDataPoint, ItemPerformance, ReportSummary, UnsoldMenuItem } from '../../lib/reports/types';
import { fetchProfitAndLoss } from '../../lib/finance/utils';
import type { ProfitSummary } from '../../lib/finance/types';
import { fetchJson, getServerUrl, type Hall } from '../../utils';
import { isVirtualHall } from '../../types/hall';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { useAuth } from '../../contexts/AuthContext';
import type { Shift } from '../../contexts/ShiftContext';
import type { Item } from '../../hooks/useItems';
import { resolveHomePeriod, type HomePeriodId } from './home-period';

export interface DailySummary {
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}

export interface FloorHallPulse {
  id: number;
  name: string;
  occupied: number;
  total: number;
}

export interface AgingTable {
  tableId: number;
  label: string;
  waitMins: number;
}

const EMPTY_SUMMARY: DailySummary = {
  totalSales: 0,
  ordersCount: 0,
  occupiedTables: 0,
  emptyTables: 0,
  printerStatus: 'success',
};

const EMPTY_REPORT: ReportSummary = {
  totalSales: 0,
  orderCount: 0,
  averageOrder: 0,
  discounts: 0,
  cancellations: 0,
  netProfit: 0,
  salesByType: { dineIn: 0, pickup: 0, delivery: 0 },
};

interface ActiveOrder {
  id: number;
  table_id?: number;
  status?: string;
  created_at?: string;
  table_name?: string;
  hall_name?: string;
  hall_id?: number;
}

function waitMinutes(createdAt?: string): number {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

export function useHomeOverview() {
  const { token } = useAuth();
  const { subscribeToOrders } = useOrderSocket();

  const [period, setPeriod] = useState<HomePeriodId>('today');
  const [customDate, setCustomDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [reportSummary, setReportSummary] = useState<ReportSummary>(EMPTY_REPORT);
  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  const [topItems, setTopItems] = useState<ItemPerformance[]>([]);
  const [unsoldMenuItems, setUnsoldMenuItems] = useState<UnsoldMenuItem[]>([]);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [live, setLive] = useState<DailySummary>(EMPTY_SUMMARY);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [halls, setHalls] = useState<FloorHallPulse[]>([]);
  const [pickupActive, setPickupActive] = useState(0);
  const [deliveryActive, setDeliveryActive] = useState(0);
  const [agingTables, setAgingTables] = useState<AgingTable[]>([]);
  const [itemsWithoutPrice, setItemsWithoutPrice] = useState(0);

  const range = useMemo(() => resolveHomePeriod(period, customDate), [period, customDate]);

  const load = useCallback(async () => {
    const serverUrl = getServerUrl();
    try {
      const [report, profitData, summary, shift, hallsData, dineIn, pickup, delivery, items] =
        await Promise.all([
          fetchReports(range.reportPeriod, range.reportDate),
          fetchProfitAndLoss({ from: range.from, to: range.to }).catch(() => null),
          fetchJson<DailySummary>(`${serverUrl}/reports/daily-summary`).catch(() => EMPTY_SUMMARY),
          token
            ? fetchJson<Shift | null>(`${serverUrl}/shifts/active`, {
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => null)
            : Promise.resolve(null),
          fetchJson<Hall[]>(`${serverUrl}/halls`).catch(() => [] as Hall[]),
          fetchJson<ActiveOrder[]>(`${serverUrl}/orders/dine-in/active`).catch(() => [] as ActiveOrder[]),
          fetchJson<unknown[]>(`${serverUrl}/orders/pickup/active`).catch(() => []),
          fetchJson<unknown[]>(`${serverUrl}/orders/delivery/active`).catch(() => []),
          fetchJson<Item[]>(`${serverUrl}/items`).catch(() => [] as Item[]),
        ]);

      setReportSummary({
        ...EMPTY_REPORT,
        ...report.summary,
        salesByType: report.summary.salesByType ?? EMPTY_REPORT.salesByType,
      });
      setGraphData(Array.isArray(report.graphData) ? report.graphData : []);
      setTopItems((report.itemsPerformance ?? []).slice(0, 5));
      setUnsoldMenuItems((report.unsoldMenuItems ?? []).slice(0, 8));
      setProfit(profitData);
      setLive({
        totalSales: Number(summary?.totalSales) || 0,
        ordersCount: Number(summary?.ordersCount) || 0,
        occupiedTables: Number(summary?.occupiedTables) || 0,
        emptyTables: Number(summary?.emptyTables) || 0,
        printerStatus: summary?.printerStatus === 'error' ? 'error' : 'success',
      });
      setShiftOpen(!!shift && shift.status === 'open');
      setPickupActive(Array.isArray(pickup) ? pickup.length : 0);
      setDeliveryActive(Array.isArray(delivery) ? delivery.length : 0);

      const dineInOrders = Array.isArray(dineIn) ? dineIn : [];
      const occupiedByHall = new Map<string, Set<number>>();
      const aging: AgingTable[] = [];
      const seenTables = new Set<number>();

      for (const order of dineInOrders) {
        const hallKey = String(order.hall_id ?? order.hall_name ?? '');
        if (!occupiedByHall.has(hallKey)) occupiedByHall.set(hallKey, new Set());
        if (order.table_id) occupiedByHall.get(hallKey)!.add(order.table_id);

        if (order.table_id && !seenTables.has(order.table_id)) {
          seenTables.add(order.table_id);
          const mins = waitMinutes(order.created_at);
          if (mins >= 30) {
            aging.push({
              tableId: order.table_id,
              label: order.table_name || String(order.table_id),
              waitMins: mins,
            });
          }
        }
      }
      aging.sort((a, b) => b.waitMins - a.waitMins);
      setAgingTables(aging.slice(0, 8));

      const pulse: FloorHallPulse[] = (Array.isArray(hallsData) ? hallsData : [])
        .filter((h) => h?.name && !isVirtualHall(h.name))
        .map((h) => {
          const byId = occupiedByHall.get(String(h.id));
          const byName = occupiedByHall.get(h.name);
          const occupied = new Set([...(byId ?? []), ...(byName ?? [])]).size;
          return {
            id: h.id,
            name: h.name,
            occupied,
            total: Number(h.tablesCount) || 0,
          };
        });
      setHalls(pulse);

      const noPrice = (Array.isArray(items) ? items : []).filter(
        (item) => !item.hidden_from_menu && !item.has_options && Number(item.price) <= 0,
      ).length;
      setItemsWithoutPrice(noPrice);

      try {
        await fetchJson(`${serverUrl}/health`);
        setOnline(true);
      } catch {
        setOnline(false);
      }

      setUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to load home overview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [range.from, range.reportDate, range.reportPeriod, range.to, token]);

  useEffect(() => {
    setIsLoading(true);
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        if (event.eventType === 'created' || event.eventType === 'updated') {
          void load();
        }
      },
      ['dine-in', 'pickup', 'delivery'],
    );
    return unsubscribe;
  }, [subscribeToOrders, load]);

  const selectPeriod = useCallback((id: HomePeriodId) => {
    setPeriod(id);
    if (id !== 'custom') setCustomDate('');
  }, []);

  return {
    period,
    customDate,
    setCustomDate,
    selectPeriod,
    range,
    isLoading,
    updatedAt,
    reportSummary,
    graphData,
    topItems,
    unsoldMenuItems,
    profit,
    live,
    shiftOpen,
    setShiftOpen,
    online,
    halls,
    pickupActive,
    deliveryActive,
    agingTables,
    itemsWithoutPrice,
    refresh: load,
  };
}

export type HomeOverview = ReturnType<typeof useHomeOverview>;
