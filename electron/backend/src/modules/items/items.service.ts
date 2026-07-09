import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Item {
  id: number;
  name: string;
  price: number;
  categoryId?: number | null;
  kitchen_id?: number | null;
  image_url?: string | null;
  description?: string | null;
  original_price?: number;
  is_featured?: boolean;
  is_out_of_stock?: boolean;
  /** When true, item is omitted from ordering menus (POS). */
  hidden_from_menu?: boolean;
}

class ItemsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(kitchen_id?: number): Promise<Item[]> {
    let query =
      'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock, COALESCE(hidden_from_menu, 0) as hidden_from_menu FROM items';
    const params: any[] = [];

    if (kitchen_id !== undefined) {
      query += ' WHERE kitchen_id = ?';
      params.push(kitchen_id);
    }

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => ({
      ...row,
      is_out_of_stock: Boolean(row.is_out_of_stock),
      hidden_from_menu: Boolean(row.hidden_from_menu),
    })) as Item[];
  }

  async findOne(id: number): Promise<Item> {
    const row = await this.db.get(
      'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock, COALESCE(hidden_from_menu, 0) as hidden_from_menu FROM items WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Item not found');
    }
    const r = row as any;
    return {
      ...r,
      is_out_of_stock: Boolean(r.is_out_of_stock),
      hidden_from_menu: Boolean(r.hidden_from_menu),
    } as Item;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    await this.db.run(
      'INSERT INTO items (name, price, categoryId, kitchen_id, image_url, description, is_out_of_stock, hidden_from_menu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.price,
        data.categoryId ?? null,
        data.kitchen_id ?? null,
        data.image_url ?? null,
        data.description ?? null,
        data.is_out_of_stock ? 1 : 0,
        data.hidden_from_menu ? 1 : 0,
      ],
    );
    const id = await this.db.getLastInsertRowId();
    return this.findOne(id);
  }

  async update(id: number, data: Partial<Omit<Item, 'id'>>): Promise<Item> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };
    await this.db.run(
      'UPDATE items SET name = ?, price = ?, categoryId = ?, kitchen_id = ?, image_url = ?, description = ?, is_out_of_stock = ?, hidden_from_menu = ? WHERE id = ?',
      [
        merged.name,
        merged.price,
        merged.categoryId ?? null,
        merged.kitchen_id ?? null,
        merged.image_url ?? null,
        merged.description ?? null,
        merged.is_out_of_stock ? 1 : 0,
        merged.hidden_from_menu ? 1 : 0,
        id,
      ],
    );
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM items WHERE id = ?', [id]);
  }
}

let itemsInstance: ItemsService | null = null;

export function initializeItems(db: DatabaseService): void {
  itemsInstance = new ItemsService(db);
}

function requireItems(): ItemsService {
  if (!itemsInstance) {
    throw new Error('Items not initialized');
  }
  return itemsInstance;
}

export function findAll(
  ...args: Parameters<ItemsService['findAll']>
): ReturnType<ItemsService['findAll']> {
  return requireItems().findAll(...args);
}

export function findOne(
  ...args: Parameters<ItemsService['findOne']>
): ReturnType<ItemsService['findOne']> {
  return requireItems().findOne(...args);
}

export function create(
  ...args: Parameters<ItemsService['create']>
): ReturnType<ItemsService['create']> {
  return requireItems().create(...args);
}

export function update(
  ...args: Parameters<ItemsService['update']>
): ReturnType<ItemsService['update']> {
  return requireItems().update(...args);
}

export function remove(
  ...args: Parameters<ItemsService['remove']>
): ReturnType<ItemsService['remove']> {
  return requireItems().remove(...args);
}
