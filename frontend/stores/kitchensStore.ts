import { create } from 'zustand';
import { getServerUrl, fetchJson, type Kitchen } from '../src/utils';
import { useFloorsStore } from './floorsStore';
import { attachFloorToKitchen, normalizeKitchenBase } from '../src/types/kitchen';
import { buildFloorsMap } from '../src/types/floor';

interface KitchensStore {
  kitchens: Kitchen[];
  loadKitchens: () => Promise<Kitchen[]>;
  getKitchenById: (id: number) => Kitchen | undefined;
  /** For imperative reads only — do not use as a Zustand selector (returns new array). */
  getActiveKitchens: () => Kitchen[];
}

/**
 * Global store for kitchens — single source of truth.
 */
export const useKitchensStore = create<KitchensStore>((set, get) => ({
  kitchens: [],

  loadKitchens: async () => {
    try {
      let raw: Record<string, unknown>[];
      if (typeof window !== 'undefined' && window.sufra?.kitchens?.findAll) {
        raw = await window.sufra.kitchens.findAll();
      } else {
        const serverUrl = getServerUrl();
        raw = await fetchJson<Record<string, unknown>[]>(`${serverUrl}/kitchens`);
      }

      const floorsData = await useFloorsStore.getState().loadFloors();
      const floorsMap = buildFloorsMap(floorsData);

      const kitchens = (raw || []).map((k) => {
        const base = normalizeKitchenBase(k);
        return attachFloorToKitchen(base, floorsMap);
      });

      set({ kitchens });
      return kitchens;
    } catch (e) {
      console.error('[KitchensStore] Failed to load kitchens:', e);
      set({ kitchens: [] });
      return [];
    }
  },

  getKitchenById: (id) => get().kitchens.find((k) => k.id === id),

  getActiveKitchens: () => get().kitchens.filter((k) => k.is_active),
}));
