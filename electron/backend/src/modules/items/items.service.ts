import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import type { ItemOptionGroup } from '../../types/item-options';
import {
  getGroupsForItem,
  getGroupsForItems,
  saveGroupsForItem,
  copyGroupsFromItem,
} from './item-options.service';

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
  hidden_from_menu?: boolean;
  has_options?: boolean;
  option_groups?: ItemOptionGroup[];
}

export interface CreateItemInput extends Omit<Item, 'id' | 'option_groups' | 'has_options'> {
  option_groups?: ItemOptionGroup[];
}

export interface UpdateItemInput extends Partial<Omit<Item, 'id'>> {
  option_groups?: ItemOptionGroup[];
}

function mapItemRow(row: any, option_groups: ItemOptionGroup[] = []): Item {
  return {
    ...row,
    is_out_of_stock: Boolean(row.is_out_of_stock),
    hidden_from_menu: Boolean(row.hidden_from_menu),
    has_options: Boolean(row.has_options),
    option_groups,
  } as Item;
}

async function resolveCategoryId(
  db: DatabaseService,
  categoryId: number | null | undefined,
): Promise<number | null> {
  if (categoryId == null) return null;
  const row = await db.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
  return row ? categoryId : null;
}

async function resolveKitchenId(
  db: DatabaseService,
  kitchenId: number | null | undefined,
): Promise<number | null> {
  if (kitchenId == null) return null;
  const row = await db.get('SELECT id FROM kitchens WHERE id = ?', [kitchenId]);
  return row ? kitchenId : null;
}

class ItemsService {
  constructor(private readonly db: DatabaseService) {}

  private async attachOptionGroups(items: Item[]): Promise<Item[]> {
    if (!items.length) return items;
    const groupsMap = await getGroupsForItems(items.map((i) => i.id));
    return items.map((item) => {
      const option_groups = groupsMap.get(item.id) ?? [];
      return {
        ...item,
        option_groups,
        has_options: Boolean(item.has_options) || option_groups.length > 0,
      };
    });
  }

  async findAll(kitchen_id?: number): Promise<Item[]> {
    let query =
      'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock, COALESCE(hidden_from_menu, 0) as hidden_from_menu, COALESCE(has_options, 0) as has_options FROM items';
    const params: any[] = [];

    if (kitchen_id !== undefined) {
      query += ' WHERE kitchen_id = ?';
      params.push(kitchen_id);
    }

    const rows = await this.db.all(query, params);
    const items = rows.map((row: any) => mapItemRow(row)) as Item[];
    return this.attachOptionGroups(items);
  }

  async findOne(id: number): Promise<Item> {
    const row = await this.db.get(
      'SELECT id, name, price, categoryId, kitchen_id, image_url, description, COALESCE(is_out_of_stock, 0) as is_out_of_stock, COALESCE(hidden_from_menu, 0) as hidden_from_menu, COALESCE(has_options, 0) as has_options FROM items WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Item not found');
    }
    const option_groups = await getGroupsForItem(id);
    return mapItemRow(row, option_groups);
  }

  async create(data: CreateItemInput): Promise<Item> {
    const hasOptionsFlag = data.option_groups?.length ? 1 : 0;
    const categoryId = await resolveCategoryId(this.db, data.categoryId);
    const kitchenId = await resolveKitchenId(this.db, data.kitchen_id);
    await this.db.run(
      'INSERT INTO items (name, price, categoryId, kitchen_id, image_url, description, is_out_of_stock, hidden_from_menu, has_options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.price,
        categoryId,
        kitchenId,
        data.image_url ?? null,
        data.description ?? null,
        data.is_out_of_stock ? 1 : 0,
        data.hidden_from_menu ? 1 : 0,
        hasOptionsFlag,
      ],
    );
    const id = await this.db.getLastInsertRowId();
    if (data.option_groups?.length) {
      await saveGroupsForItem(id, data.option_groups);
    }
    return this.findOne(id);
  }

  async update(id: number, data: UpdateItemInput): Promise<Item> {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...data };
    const hasOptionsFlag =
      data.option_groups !== undefined
        ? data.option_groups.length > 0
          ? 1
          : 0
        : merged.has_options
          ? 1
          : 0;

    const categoryId = await resolveCategoryId(this.db, merged.categoryId);
    const kitchenId = await resolveKitchenId(this.db, merged.kitchen_id);

    await this.db.run(
      'UPDATE items SET name = ?, price = ?, categoryId = ?, kitchen_id = ?, image_url = ?, description = ?, is_out_of_stock = ?, hidden_from_menu = ?, has_options = ? WHERE id = ?',
      [
        merged.name,
        merged.price,
        categoryId,
        kitchenId,
        merged.image_url ?? null,
        merged.description ?? null,
        merged.is_out_of_stock ? 1 : 0,
        merged.hidden_from_menu ? 1 : 0,
        hasOptionsFlag,
        id,
      ],
    );

    if (data.option_groups !== undefined) {
      await saveGroupsForItem(id, data.option_groups);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM items WHERE id = ?', [id]);
  }

  async copyOptionsFromItem(targetId: number, sourceId: number): Promise<Item> {
    await this.findOne(targetId);
    await this.findOne(sourceId);
    await copyGroupsFromItem(sourceId, targetId);
    return this.findOne(targetId);
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

export function copyOptionsFromItem(
  ...args: Parameters<ItemsService['copyOptionsFromItem']>
): ReturnType<ItemsService['copyOptionsFromItem']> {
  return requireItems().copyOptionsFromItem(...args);
}
