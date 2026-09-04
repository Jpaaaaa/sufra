import { create } from 'zustand';
import { getServerUrl, fetchJson, type Hall } from '../src/utils';
import { useFloorsStore } from './floorsStore';
import { useTablesStore } from './tablesStore';
import {
  attachFloorToHall,
  isVirtualHall,
  normalizeHallBase,
} from '../src/types/hall';
import { buildFloorsMap } from '../src/types/floor';

export interface LoadHallsOptions {
  excludeVirtual?: boolean;
  withTablesCount?: boolean;
}

interface HallsStore {
  halls: Hall[];
  loadHalls: (options?: LoadHallsOptions) => Promise<Hall[]>;
  getHallById: (id: number) => Hall | undefined;
  updateHall: (id: number, patch: Partial<Hall>) => void;
}

/**
 * Global store for restaurant halls — single source of truth.
 */
export const useHallsStore = create<HallsStore>((set, get) => ({
  halls: [],

  loadHalls: async (options = {}) => {
    try {
      let raw: Record<string, unknown>[];
      if (typeof window !== 'undefined' && window.sufra?.halls?.findAll) {
        raw = await window.sufra.halls.findAll();
      } else {
        const serverUrl = getServerUrl();
        raw = await fetchJson<Record<string, unknown>[]>(`${serverUrl}/halls`);
      }

      const floorsData = await useFloorsStore.getState().loadFloors();
      const floorsMap = buildFloorsMap(floorsData);

      let halls = (raw || []).map((h) => {
        const base = normalizeHallBase(h);
        return attachFloorToHall(base, floorsMap);
      });

      if (options.excludeVirtual) {
        halls = halls.filter((h) => !isVirtualHall(h.name));
      }

      if (options.withTablesCount) {
        const tablesStore = useTablesStore.getState();
        halls = await Promise.all(
          halls.map(async (hall) => {
            const tables = await tablesStore.loadTablesForHall(hall.id);
            return { ...hall, tablesCount: tables.length };
          }),
        );
      }

      set({ halls });
      return halls;
    } catch (e) {
      console.error('[HallsStore] Failed to load halls:', e);
      set({ halls: [] });
      return [];
    }
  },

  getHallById: (id) => get().halls.find((h) => h.id === id),

  updateHall: (id, patch) => {
    set((state) => ({
      halls: state.halls.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  },
}));
