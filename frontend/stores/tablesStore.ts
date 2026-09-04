import { create } from 'zustand';
import { getServerUrl, fetchJson, type TableEntity } from '../src/utils';
import { normalizeTable } from '../src/types/table';

interface TablesStore {
  tablesByHallId: Record<number, TableEntity[]>;
  loadTablesForHall: (hallId: number, force?: boolean) => Promise<TableEntity[]>;
  invalidateHall: (hallId: number) => void;
  invalidateAll: () => void;
  getTablesForHall: (hallId: number) => TableEntity[];
}

async function fetchTablesForHall(hallId: number): Promise<TableEntity[]> {
  let raw: Record<string, unknown>[];
  try {
    if (typeof window !== 'undefined' && window.sufra?.tables?.findByHall) {
      raw = await window.sufra.tables.findByHall(hallId);
    } else {
      const serverUrl = getServerUrl();
      raw = await fetchJson<Record<string, unknown>[]>(
        `${serverUrl}/halls/${hallId}/tables`,
      );
    }
  } catch (ipcError) {
    console.warn(
      '[TablesStore] IPC tables.findByHall failed, falling back to HTTP:',
      ipcError,
    );
    const serverUrl = getServerUrl();
    raw = await fetchJson<Record<string, unknown>[]>(
      `${serverUrl}/halls/${hallId}/tables`,
    );
  }

  const tablesArray = Array.isArray(raw) ? raw : [];
  return tablesArray.map((t) => normalizeTable(t, hallId));
}

/**
 * Global cache for tables per hall — single source of truth.
 */
export const useTablesStore = create<TablesStore>((set, get) => ({
  tablesByHallId: {},

  loadTablesForHall: async (hallId, force = false) => {
    if (!force && get().tablesByHallId[hallId]) {
      return get().tablesByHallId[hallId];
    }

    try {
      const mapped = await fetchTablesForHall(hallId);
      set((state) => ({
        tablesByHallId: { ...state.tablesByHallId, [hallId]: mapped },
      }));
      return mapped;
    } catch (e) {
      console.error('[TablesStore] Failed to load tables for hall:', hallId, e);
      set((state) => ({
        tablesByHallId: { ...state.tablesByHallId, [hallId]: [] },
      }));
      return [];
    }
  },

  invalidateHall: (hallId) => {
    set((state) => {
      const next = { ...state.tablesByHallId };
      delete next[hallId];
      return { tablesByHallId: next };
    });
  },

  invalidateAll: () => set({ tablesByHallId: {} }),

  getTablesForHall: (hallId) => get().tablesByHallId[hallId] ?? [],
}));
