import { DatabaseService } from '../../database/database.service';
import { Category } from '../../types';
import { NotFoundException } from '../../utils/exceptions';

export class CategoriesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.db.all('SELECT id, name FROM categories');
    return rows as Category[];
  }

  async findOne(id: number): Promise<Category> {
    const row = await this.db.get('SELECT id, name FROM categories WHERE id = ?', [id]);
    if (!row) {
      throw new NotFoundException('Category not found');
    }
    return row as Category;
  }

  async create(data: Omit<Category, 'id'>): Promise<Category> {
    await this.db.run('INSERT INTO categories (name) VALUES (?)', [data.name]);
    const id = await this.db.getLastInsertRowId();
    return { id, ...data };
  }

  async update(id: number, data: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };
    await this.db.run('UPDATE categories SET name = ? WHERE id = ?', [merged.name, id]);
    return merged;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM categories WHERE id = ?', [id]);
  }
}
