import type { Hall } from '../utils';
import type { Floor } from './floor';

export const VIRTUAL_HALL_NAMES = ['طلبات خارجية', 'طلبات سفري / توصيل'];

export interface HallBase {
  id: number;
  name: string;
  number: number;
  floor_id: number | null;
  tablesCount?: number;
}

export function normalizeHallBase(raw: Record<string, unknown>): HallBase {
  return {
    id: raw.id as number,
    name: raw.name as string,
    number: (raw.number ?? raw.hall_number) as number,
    floor_id: (raw.floor_id as number | null) ?? null,
    tablesCount:
      (raw.tablesCount ??
        raw.tables_count ??
        raw.table_count ??
        raw.tables) as number | undefined,
  };
}

export function attachFloorToHall(
  hall: HallBase,
  floorsMap: Map<number, Floor>,
): Hall {
  const floor = hall.floor_id ? floorsMap.get(hall.floor_id) : null;
  return {
    ...hall,
    floor: floor
      ? { id: floor.id, name: floor.name, number: floor.number }
      : null,
  };
}

export function isVirtualHall(name: string): boolean {
  return VIRTUAL_HALL_NAMES.includes(name);
}
