/** Shared helpers for floor-plan (venue + tables) routes. */
export function parseId(value: string): number {
  return parseInt(value, 10);
}

export interface CrudService {
  findAll(): Promise<unknown>;
  findOne(id: number): Promise<unknown>;
  create(body: unknown): Promise<unknown>;
  update(id: number, body: unknown): Promise<unknown>;
  remove(id: number): Promise<unknown>;
}
