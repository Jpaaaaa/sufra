export interface Floor {
  id: number;
  name: string;
  number: number;
  floor_number?: number;
  created_at?: string;
  updated_at?: string;
}

export function normalizeFloor(raw: Record<string, unknown>): Floor {
  const floorNumber = (raw.number ?? raw.floor_number) as number;
  return {
    id: raw.id as number,
    name: raw.name as string,
    number: floorNumber,
    floor_number: raw.floor_number as number | undefined,
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
  };
}

export function buildFloorsMap(floors: Floor[]): Map<number, Floor> {
  return new Map(floors.map((f) => [f.id, f]));
}
