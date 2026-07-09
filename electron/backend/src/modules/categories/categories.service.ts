import { BadRequestException, NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  item_count?: number;
  is_menu_active: boolean;
}

class CategoriesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.db.all(
      `SELECT c.id, c.name, c.sort_order, COALESCE(c.is_menu_active, 1) AS is_menu_active, COUNT(i.id) AS item_count
       FROM categories c
       LEFT JOIN items i ON i.categoryId = c.id
       GROUP BY c.id, c.name, c.sort_order, c.is_menu_active
       ORDER BY c.sort_order ASC, c.id ASC`,
    );
    return (rows as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      sort_order: row.sort_order ?? row.id,
      item_count: Number(row.item_count ?? 0),
      is_menu_active: Boolean(row.is_menu_active),
    }));
  }

  async findOne(id: number): Promise<Category> {
    const row = await this.db.get(
      `SELECT c.id, c.name, c.sort_order, COALESCE(c.is_menu_active, 1) AS is_menu_active,
              (SELECT COUNT(*) FROM items WHERE categoryId = c.id) AS item_count
       FROM categories c WHERE c.id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Category not found');
    }
    const r = row as any;
    return {
      id: r.id,
      name: r.name,
      sort_order: r.sort_order ?? r.id,
      item_count: Number(r.item_count ?? 0),
      is_menu_active: Boolean(r.is_menu_active),
    };
  }

  async create(data: { name: string; is_menu_active?: boolean }): Promise<Category> {
    const maxRow = await this.db.get(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories',
    );
    const nextOrder = ((maxRow as any)?.m ?? 0) + 1;
    const active = data.is_menu_active === false ? 0 : 1;
    await this.db.run(
      'INSERT INTO categories (name, sort_order, is_menu_active) VALUES (?, ?, ?)',
      [data.name, nextOrder, active],
    );
    const id = await this.db.getLastInsertRowId();
    return this.findOne(id);
  }

  async update(id: number, data: Partial<Omit<Category, 'id' | 'item_count'>>): Promise<Category> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };
    await this.db.run(
      'UPDATE categories SET name = ?, is_menu_active = ? WHERE id = ?',
      [merged.name, merged.is_menu_active ? 1 : 0, id],
    );
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM categories WHERE id = ?', [id]);
  }

  async reorder(ids: number[]): Promise<void> {
    if (!ids?.length) {
      throw new BadRequestException('ids required');
    }
    const all = await this.db.all('SELECT id FROM categories');
    const allIds = new Set((all as { id: number }[]).map((r) => r.id));
    if (ids.length !== allIds.size) {
      throw new BadRequestException('Reorder must include every category exactly once');
    }
    for (const id of ids) {
      if (!allIds.has(id)) {
        throw new BadRequestException(`Unknown category id: ${id}`);
      }
    }
    let order = 1;
    for (const id of ids) {
      await this.db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [order, id]);
      order += 1;
    }
  }
}

let categoriesInstance: CategoriesService | null = null;

export function initializeCategories(db: DatabaseService): void {
  categoriesInstance = new CategoriesService(db);
}

function requireCategories(): CategoriesService {
  if (!categoriesInstance) {
    throw new Error('Categories not initialized');
  }
  return categoriesInstance;
}

export function findAll(): ReturnType<CategoriesService['findAll']> {
  return requireCategories().findAll();
}

export function findOne(
  ...args: Parameters<CategoriesService['findOne']>
): ReturnType<CategoriesService['findOne']> {
  return requireCategories().findOne(...args);
}

export function create(
  ...args: Parameters<CategoriesService['create']>
): ReturnType<CategoriesService['create']> {
  return requireCategories().create(...args);
}

export function update(
  ...args: Parameters<CategoriesService['update']>
): ReturnType<CategoriesService['update']> {
  return requireCategories().update(...args);
}

export function remove(
  ...args: Parameters<CategoriesService['remove']>
): ReturnType<CategoriesService['remove']> {
  return requireCategories().remove(...args);
}

export function reorder(
  ...args: Parameters<CategoriesService['reorder']>
): ReturnType<CategoriesService['reorder']> {
  return requireCategories().reorder(...args);
}
