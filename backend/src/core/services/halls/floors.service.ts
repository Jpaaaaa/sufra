import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Floor {
  id: number;
  name: string;
  floor_number: number;
  created_at: string;
  updated_at: string;
}

export class FloorsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Floor[]> {
    const rows = await this.db.all(
      'SELECT id, name, floor_number, created_at, updated_at FROM floors ORDER BY floor_number',
    );
    return rows as Floor[];
  }

  async findOne(id: number): Promise<Floor> {
    const row = await this.db.get(
      'SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Floor not found');
    }
    return row as Floor;
  }

  async create(data: { name: string; floor_number: number }): Promise<Floor> {
    await this.db.run(
      'INSERT INTO floors (name, floor_number) VALUES (?, ?)',
      [data.name, data.floor_number],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      'SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new Error('Failed to retrieve created floor');
    }
    return row as Floor;
  }

  async update(
    id: number,
    data: { name?: string; floor_number?: number },
  ): Promise<Floor> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };

    await this.db.run(
      'UPDATE floors SET name = ?, floor_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.name, merged.floor_number, id],
    );
    const row = await this.db.get(
      'SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Floor not found after update');
    }
    return row as Floor;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM floors WHERE id = ?', [id]);
  }
}
