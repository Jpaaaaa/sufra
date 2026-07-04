import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HallStore {
  activeHallId: number | null;
  setActiveHallId: (id: number | null) => void;
  /**
   * Validate and reset activeHallId if the hall no longer exists
   * Returns true if activeHallId is valid, false if it was reset
   */
  validateActiveHall: (halls: Array<{ id: number }>) => boolean;
}

/**
 * Global store for active hall ID - single source of truth
 * Used by Tables, Orders, and Reports screens
 * 
 * This ensures all screens use the same hall context, preventing
 * desynchronization bugs where tables are created in one hall
 * but appear in a different hall's context.
 */
export const useHallStore = create<HallStore>()(
  persist(
    (set, get) => ({
      activeHallId: null,
      
      setActiveHallId: (id: number | null) => {
        console.log(`[HallStore] Setting activeHallId to: ${id}`);
        set({ activeHallId: id });
      },

      validateActiveHall: (halls: Array<{ id: number }>) => {
        const { activeHallId } = get();
        
        if (activeHallId === null) {
          return false;
        }

        const hallExists = halls.some(h => h.id === activeHallId);
        if (!hallExists) {
          console.log(`[HallStore] Active hall ${activeHallId} no longer exists, resetting to null`);
          set({ activeHallId: null });
          return false;
        }

        return true;
      },
    }),
    {
      name: 'sufra-hall-storage', // localStorage key
    }
  )
);

