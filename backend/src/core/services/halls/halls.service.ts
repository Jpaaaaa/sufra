import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Hall {
  id: number;
  name: string;
  hall_number: number;
  floor_id?: number | null;
  created_at: string;
  updated_at: string;
}

export class HallsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Hall[]> {
    const rows = await this.db.all(
      'SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls',
    );
    return rows as Hall[];
  }

  async findOne(id: number): Promise<Hall> {
    const row = await this.db.get(
      'SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Hall not found');
    }
    return row as Hall;
  }

  async create(data: { name: string; hall_number: number; floor_id?: number | null }): Promise<Hall> {
    await this.db.run(
      'INSERT INTO halls (name, hall_number, floor_id) VALUES (?, ?, ?)',
      [data.name, data.hall_number, data.floor_id ?? null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      'SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new Error('Failed to retrieve created hall');
    }
    return row as Hall;
  }

  async update(
    id: number,
    data: { name?: string; hall_number?: number; floor_id?: number | null },
  ): Promise<Hall> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };

    await this.db.run(
      'UPDATE halls SET name = ?, hall_number = ?, floor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.name, merged.hall_number, merged.floor_id ?? null, id],
    );
    const row = await this.db.get(
      'SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Hall not found after update');
    }
    return row as Hall;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // Delete tables first (cascade) - SQLite may not enforce ON DELETE CASCADE
    await this.db.run('DELETE FROM tables WHERE hall_id = ?', [id]);
    await this.db.run('DELETE FROM halls WHERE id = ?', [id]);
  }
}
