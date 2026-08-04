import type { Kitchen } from '../utils';
import type { Floor } from './floor';

export function normalizeKitchenBase(raw: Record<string, unknown>): Omit<Kitchen, 'floor'> {
  return {
    id: raw.id as number,
    name: raw.name as string,
    description: raw.description as string | undefined,
    floor_id: (raw.floor_id as number | null) ?? null,
    is_active: Boolean(raw.is_active),
  };
}

export function attachFloorToKitchen(
  kitchen: Omit<Kitchen, 'floor'>,
  floorsMap: Map<number, Floor>,
): Kitchen {
  const floorId = kitchen.floor_id ?? null;
  const floor = floorId ? floorsMap.get(floorId) : null;
  return {
    ...kitchen,
    floor: floor
      ? { id: floor.id, name: floor.name, number: floor.number }
      : null,
  };
}
