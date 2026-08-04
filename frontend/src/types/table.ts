import type { TableEntity } from '../utils';

export function normalizeTable(raw: Record<string, unknown>, hallId?: number): TableEntity {
  return {
    id: raw.id as number,
    number: (raw.number as number) ?? 1,
    hall_id: (raw.hall_id as number | null) ?? hallId ?? null,
    name: (raw.name as string | null) ?? null,
  };
}
