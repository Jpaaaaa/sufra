import { create } from 'zustand';
import { getServerUrl, fetchJson } from '../src/utils';
import {
  type Floor,
  normalizeFloor,
  buildFloorsMap,
} from '../src/types/floor';

interface FloorsStore {
  floors: Floor[];
  loadFloors: () => Promise<Floor[]>;
  getFloorById: (id: number) => Floor | undefined;
  getFloorsMap: () => Map<number, Floor>;
}

/**
 * Global store for restaurant floors — single source of truth.
 * Used by Floors, Halls, Kitchens, Tables, and Orders screens.
 */
export const useFloorsStore = create<FloorsStore>((set, get) => ({
  floors: [],

  loadFloors: async () => {
    try {
      let raw: Record<string, unknown>[];
      if (typeof window !== 'undefined' && window.sufra?.floors?.findAll) {
        raw = await window.sufra.floors.findAll();
      } else {
        const serverUrl = getServerUrl();
        raw = await fetchJson<Record<string, unknown>[]>(`${serverUrl}/floors`);
      }

      const floorsData = (raw || []).map(normalizeFloor);
      set({ floors: floorsData });
      return floorsData;
    } catch (e) {
      console.error('[FloorsStore] Failed to load floors:', e);
      set({ floors: [] });
      return [];
    }
  },

  getFloorById: (id) => get().floors.find((f) => f.id === id),

  getFloorsMap: () => buildFloorsMap(get().floors),
}));
