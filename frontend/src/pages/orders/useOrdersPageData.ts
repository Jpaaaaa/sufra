import { useState, useCallback } from 'react';
import { getServerUrl, fetchJson } from '../../utils';
import type { ExistingOrder } from '../../hooks/useOrderModal';

export function useOrdersPageData() {
  const [allPickupOrders, setAllPickupOrders] = useState<ExistingOrder[]>([]);
  const [allDeliveryOrders, setAllDeliveryOrders] = useState<ExistingOrder[]>([]);
  const [archivedDineInOrders, setArchivedDineInOrders] = useState<ExistingOrder[]>([]);
  const [loadingPickupOrders, setLoadingPickupOrders] = useState(false);
  const [loadingDeliveryOrders, setLoadingDeliveryOrders] = useState(false);
  const [loadingArchivedDineIn, setLoadingArchivedDineIn] = useState(false);

  const loadPickupOrders = useCallback(async () => {
    setLoadingPickupOrders(true);
    try {
      const serverUrl = getServerUrl();
      const [active, archived] = await Promise.all([
        fetchJson<any[]>(`${serverUrl}/orders/pickup/active`).catch(() => []),
        fetchJson<any[]>(`${serverUrl}/orders/pickup/archived`).catch(() => []),
      ]);
      const all = [...(Array.isArray(active) ? active : []), ...(Array.isArray(archived) ? archived : [])];
      all.sort((a: any, b: any) => (b?.created_at ? new Date(b.created_at).getTime() : 0) - (a?.created_at ? new Date(a.created_at).getTime() : 0));
      setAllPickupOrders(all);
    } catch {
      setAllPickupOrders([]);
    } finally {
      setLoadingPickupOrders(false);
    }
  }, []);

  const loadDeliveryOrders = useCallback(async () => {
    setLoadingDeliveryOrders(true);
    try {
      const serverUrl = getServerUrl();
      const [active, archived] = await Promise.all([
        fetchJson<any[]>(`${serverUrl}/orders/delivery/active`).catch(() => []),
        fetchJson<any[]>(`${serverUrl}/orders/delivery/archived`).catch(() => []),
      ]);
      const all = [...(Array.isArray(active) ? active : []), ...(Array.isArray(archived) ? archived : [])];
      all.sort((a: any, b: any) => (b?.created_at ? new Date(b.created_at).getTime() : 0) - (a?.created_at ? new Date(a.created_at).getTime() : 0));
      setAllDeliveryOrders(all);
    } catch {
      setAllDeliveryOrders([]);
    } finally {
      setLoadingDeliveryOrders(false);
    }
  }, []);

  const loadArchivedDineInOrders = useCallback(async () => {
    setLoadingArchivedDineIn(true);
    try {
      const serverUrl = getServerUrl();
      const archived = await fetchJson<any[]>(`${serverUrl}/orders/dine-in/archived`);
      setArchivedDineInOrders(Array.isArray(archived) ? archived : []);
    } catch {
      setArchivedDineInOrders([]);
    } finally {
      setLoadingArchivedDineIn(false);
    }
  }, []);

  const PENDING_STATUSES = ['pending', 'printed', 'preparing', 'ready', 'out_for_delivery', 'new'];
  const ARCHIVED_STATUSES = ['archived', 'completed', 'cancelled'];

  return {
    allPickupOrders,
    setAllPickupOrders,
    allDeliveryOrders,
    setAllDeliveryOrders,
    archivedDineInOrders,
    setArchivedDineInOrders,
    loadingPickupOrders,
    loadingDeliveryOrders,
    loadingArchivedDineIn,
    loadPickupOrders,
    loadDeliveryOrders,
    loadArchivedDineInOrders,
    pickupOrderCounts: {
      pending: allPickupOrders.filter((o: any) => PENDING_STATUSES.includes(o?.status)).length,
      archived: allPickupOrders.filter((o: any) => ARCHIVED_STATUSES.includes(o?.status)).length,
      completed: allPickupOrders.filter((o: any) => ['archived', 'completed'].includes(o?.status)).length,
      cancelled: allPickupOrders.filter((o: any) => o?.status === 'cancelled').length,
    },
    deliveryOrderCounts: {
      pending: allDeliveryOrders.filter((o: any) => PENDING_STATUSES.includes(o?.status)).length,
      archived: allDeliveryOrders.filter((o: any) => ARCHIVED_STATUSES.includes(o?.status)).length,
      completed: allDeliveryOrders.filter((o: any) => ['archived', 'completed'].includes(o?.status)).length,
      cancelled: allDeliveryOrders.filter((o: any) => o?.status === 'cancelled').length,
    },
    archivedDineInCounts: {
      completed: archivedDineInOrders.filter((o: any) => ['archived', 'completed'].includes(o?.status)).length,
      cancelled: archivedDineInOrders.filter((o: any) => o?.status === 'cancelled').length,
    },
    getFilteredPickupOrders: (pickupFilter: 'pending' | 'archived', archivedFilter?: 'all' | 'completed' | 'cancelled') =>
      pickupFilter === 'pending'
        ? allPickupOrders.filter((o: any) => PENDING_STATUSES.includes(o?.status))
        : (() => {
            const archived = allPickupOrders.filter((o: any) => ARCHIVED_STATUSES.includes(o?.status));
            if (!archivedFilter || archivedFilter === 'all') return archived;
            if (archivedFilter === 'completed') return archived.filter((o: any) => ['archived', 'completed'].includes(o?.status));
            return archived.filter((o: any) => o?.status === 'cancelled');
          })(),
    getFilteredArchivedDineInOrders: (archivedFilter: 'all' | 'completed' | 'cancelled') => {
      const archived = archivedDineInOrders.filter((o: any) => ['completed', 'archived', 'cancelled'].includes(o?.status));
      if (archivedFilter === 'all') return archived;
      if (archivedFilter === 'completed') return archived.filter((o: any) => ['archived', 'completed'].includes(o?.status));
      return archived.filter((o: any) => o?.status === 'cancelled');
    },
    getFilteredDeliveryOrders: (deliveryFilter: 'pending' | 'archived', archivedFilter?: 'all' | 'completed' | 'cancelled') =>
      deliveryFilter === 'pending'
        ? allDeliveryOrders.filter((o: any) => PENDING_STATUSES.includes(o?.status))
        : (() => {
            const archived = allDeliveryOrders.filter((o: any) => ARCHIVED_STATUSES.includes(o?.status));
            if (!archivedFilter || archivedFilter === 'all') return archived;
            if (archivedFilter === 'completed') return archived.filter((o: any) => ['archived', 'completed'].includes(o?.status));
            return archived.filter((o: any) => o?.status === 'cancelled');
          })(),
  };
}
