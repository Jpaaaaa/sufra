import { NotFoundException, BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { resolveOrderShiftFields, getCurrentBusinessDateFromSettings } from '../settings/resolve-order-shift';

export interface ShelfItem {
  id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShelfSale {
  id: number;
  shelf_item_id: number;
  quantity: number;
  price: number;
  created_at: string;
}

export class ShelvesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<ShelfItem[]> {
    const rows = await this.db.all(
      'SELECT id, name, barcode, price, quantity, created_at as createdAt, updated_at as updatedAt FROM shelf_items ORDER BY name',
    );
    return rows as ShelfItem[];
  }

  async findOneById(id: number): Promise<ShelfItem> {
    const row = await this.db.get(
      'SELECT id, name, barcode, price, quantity, created_at as createdAt, updated_at as updatedAt FROM shelf_items WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Shelf item not found');
    }
    return row as ShelfItem;
  }

  async findOneByBarcode(barcode: string): Promise<ShelfItem> {
    const row = await this.db.get(
      'SELECT id, name, barcode, price, quantity, created_at as createdAt, updated_at as updatedAt FROM shelf_items WHERE barcode = ?',
      [barcode],
    );
    if (!row) {
      throw new NotFoundException('Shelf item not found');
    }
    return row as ShelfItem;
  }

  async create(data: Omit<ShelfItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShelfItem> {
    // Check if barcode already exists
    const existing = await this.db.get('SELECT id FROM shelf_items WHERE barcode = ?', [data.barcode]);
    if (existing) {
      throw new BadRequestException('Barcode already exists');
    }

    await this.db.run(
      'INSERT INTO shelf_items (name, barcode, price, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [data.name, data.barcode, data.price, data.quantity],
    );
    const id = await this.db.getLastInsertRowId();

    // Fetch the created item using the ID we just got
    const createdRow = await this.db.get(
      'SELECT id, name, barcode, price, quantity, created_at as createdAt, updated_at as updatedAt FROM shelf_items WHERE id = ?',
      [id],
    );
    if (!createdRow) {
      throw new Error('Failed to retrieve created shelf item');
    }
    return createdRow as ShelfItem;
  }

  async update(id: number, data: Partial<Omit<ShelfItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ShelfItem> {
    const existing = await this.findOneById(id);

    // If barcode is being updated, check for duplicates
    if (data.barcode && data.barcode !== existing.barcode) {
      const duplicate = await this.db.get(
        'SELECT id FROM shelf_items WHERE barcode = ? AND id != ?',
        [data.barcode, id],
      );
      if (duplicate) {
        throw new BadRequestException('Barcode already exists');
      }
    }

    // Proceed with update
    const merged = { ...existing, ...data };
    await this.db.run(
      'UPDATE shelf_items SET name = ?, barcode = ?, price = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.name, merged.barcode, merged.price, merged.quantity, id],
    );
    return merged;
  }

  async remove(id: number): Promise<void> {
    await this.findOneById(id);
    await this.db.run('DELETE FROM shelf_items WHERE id = ?', [id]);
  }

  async decreaseStock(id: number, quantity: number): Promise<ShelfItem> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const existing = await this.findOneById(id);

    if (existing.quantity < quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${existing.quantity}, Requested: ${quantity}`);
    }

    const newQuantity = existing.quantity - quantity;
    await this.db.run(
      'UPDATE shelf_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, id],
    );
    return { ...existing, quantity: newQuantity };
  }

  async sell(barcode: string, quantity: number = 1): Promise<{ item: ShelfItem; sale: ShelfSale }> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const item = await this.findOneByBarcode(barcode);

    if (item.quantity < quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${item.quantity}, Requested: ${quantity}`);
    }

    const newQuantity = item.quantity - quantity;

    try {
      // Decrease stock
      await this.db.run(
        'UPDATE shelf_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, item.id],
      );

      const shiftFields = await resolveOrderShiftFields();
      await this.db.run(
        'INSERT INTO shelf_sales (shelf_item_id, quantity, price, created_at, business_date) VALUES (?, ?, ?, datetime(\'now\', \'localtime\'), ?)',
        [item.id, quantity, item.price, shiftFields.business_date],
      );
      const saleId = await this.db.getLastInsertRowId();

      // Fetch the created sale using the ID we just got
      const saleRow = await this.db.get(
        'SELECT id, shelf_item_id, quantity, price, created_at FROM shelf_sales WHERE id = ?',
        [saleId],
      );

      if (!saleRow) {
        throw new Error('Failed to retrieve created sale');
      }

      return {
        item: { ...item, quantity: newQuantity },
        sale: saleRow as ShelfSale,
      };
    } catch (error) {
      // Rollback: restore stock
      await this.db.run(
        'UPDATE shelf_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.id],
      );
      throw error;
    }
  }

  async getTodaySales(): Promise<(ShelfSale & { item_name: string; item_barcode: string })[]> {
    const today = await getCurrentBusinessDateFromSettings();
    const rows = await this.db.all(
      `SELECT 
        ss.id,
        ss.shelf_item_id,
        ss.quantity,
        ss.price,
        ss.created_at,
        si.name as item_name,
        si.barcode as item_barcode
      FROM shelf_sales ss
      INNER JOIN shelf_items si ON ss.shelf_item_id = si.id
      WHERE ss.business_date = ?
      ORDER BY ss.created_at DESC`,
      [today],
    );
    return rows as (ShelfSale & { item_name: string; item_barcode: string })[];
  }
}

let shelvesInstance: ShelvesService | null = null;

export function initializeShelves(db: DatabaseService): void {
  shelvesInstance = new ShelvesService(db);
}

export function requireShelves(): ShelvesService {
  if (!shelvesInstance) {
    throw new Error('Shelves not initialized');
  }
  return shelvesInstance;
}

export function findAll(): ReturnType<ShelvesService['findAll']> {
  return requireShelves().findAll();
}

export function findOneById(
  ...args: Parameters<ShelvesService['findOneById']>
): ReturnType<ShelvesService['findOneById']> {
  return requireShelves().findOneById(...args);
}

export function findOneByBarcode(
  ...args: Parameters<ShelvesService['findOneByBarcode']>
): ReturnType<ShelvesService['findOneByBarcode']> {
  return requireShelves().findOneByBarcode(...args);
}

export function create(
  ...args: Parameters<ShelvesService['create']>
): ReturnType<ShelvesService['create']> {
  return requireShelves().create(...args);
}

export function update(
  ...args: Parameters<ShelvesService['update']>
): ReturnType<ShelvesService['update']> {
  return requireShelves().update(...args);
}

export function remove(
  ...args: Parameters<ShelvesService['remove']>
): ReturnType<ShelvesService['remove']> {
  return requireShelves().remove(...args);
}

export function decreaseStock(
  ...args: Parameters<ShelvesService['decreaseStock']>
): ReturnType<ShelvesService['decreaseStock']> {
  return requireShelves().decreaseStock(...args);
}

export function sell(
  ...args: Parameters<ShelvesService['sell']>
): ReturnType<ShelvesService['sell']> {
  return requireShelves().sell(...args);
}

export function getTodaySales(): ReturnType<ShelvesService['getTodaySales']> {
  return requireShelves().getTodaySales();
}
