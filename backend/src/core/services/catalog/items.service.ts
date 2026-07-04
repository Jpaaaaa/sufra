import { DatabaseService } from '../../database/database.service';
import { Item } from '../../types';
import { NotFoundException } from '../../utils/exceptions';

export class ItemsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(kitchen_id?: number): Promise<Item[]> {
    let query = 'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock FROM items';
    const params: any[] = [];

    if (kitchen_id !== undefined) {
      query += ' WHERE kitchen_id = ?';
      params.push(kitchen_id);
    }

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      ...row,
      is_out_of_stock: Boolean(row.is_out_of_stock),
    })) as Item[];
  }

  async findOne(id: number): Promise<Item> {
    const row = await this.db.get(
      'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock FROM items WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Item not found');
    }
    return {
      ...row,
      is_out_of_stock: Boolean(row.is_out_of_stock),
    } as Item;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    await this.db.run(
      'INSERT INTO items (name, price, categoryId, kitchen_id, image_url, description, is_out_of_stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.price,
        data.categoryId ?? null,
        data.kitchen_id ?? null,
        data.image_url ?? null,
        data.description ?? null,
        data.is_out_of_stock ? 1 : 0,
      ],
    );
    const id = await this.db.getLastInsertRowId();
    return { id, ...data };
  }

  async update(id: number, data: Partial<Omit<Item, 'id'>>): Promise<Item> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };
    await this.db.run(
      'UPDATE items SET name = ?, price = ?, categoryId = ?, kitchen_id = ?, image_url = ?, description = ?, is_out_of_stock = ? WHERE id = ?',
      [
        merged.name,
        merged.price,
        merged.categoryId ?? null,
        merged.kitchen_id ?? null,
        merged.image_url ?? null,
        merged.description ?? null,
        merged.is_out_of_stock ? 1 : 0,
        id,
      ],
    );
    return merged;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM items WHERE id = ?', [id]);
  }
}
