import { NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface Kitchen {
  id: number;
  name: string;
  description?: string | null;
  floor_id?: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

class KitchensService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Kitchen[]> {
    const rows = await this.db.all(
      'SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens ORDER BY name ASC',
    );
    return rows as Kitchen[];
  }

  async findOne(id: number): Promise<Kitchen> {
    const row = await this.db.get(
      'SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('Kitchen not found');
    }
    return row as Kitchen;
  }

  async create(data: { name: string; description?: string; floor_id?: number | null }): Promise<Kitchen> {
    await this.db.run(
      'INSERT INTO kitchens (name, description, floor_id) VALUES (?, ?, ?)',
      [data.name, data.description ?? null, data.floor_id ?? null],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get(
      'SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?',
      [id],
    );
    return row as Kitchen;
  }

  async update(
    id: number,
    data: { name?: string; description?: string; floor_id?: number | null; is_active?: number },
  ): Promise<Kitchen> {
    const existing = await this.findOne(id);
    const merged = {
      ...existing,
      ...data,
    };

    await this.db.run(
      'UPDATE kitchens SET name = ?, description = ?, floor_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merged.name, merged.description ?? null, merged.floor_id ?? null, merged.is_active, id],
    );
    const row = await this.db.get(
      'SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?',
      [id],
    );
    return row as Kitchen;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM kitchens WHERE id = ?', [id]);
  }

  async getItemsServiceTypes(itemId: number): Promise<('dine-in' | 'pickup' | 'delivery')[]> {
    // Get distinct service types used for this item in recent orders from order_items
    const rows = await this.db.all(
      `SELECT DISTINCT service_type 
       FROM order_items 
       WHERE item_id = ? AND service_type IS NOT NULL
       ORDER BY service_type`,
      [itemId],
    );
    
    const serviceTypes: ('dine-in' | 'pickup' | 'delivery')[] = [];
    for (const row of rows) {
      const serviceType = row.service_type;
      if (serviceType === 'dine-in' || serviceType === 'pickup' || serviceType === 'delivery') {
        serviceTypes.push(serviceType);
      }
    }
    
    // If no service types found in orders, default to dine-in (most common)
    return serviceTypes.length > 0 ? serviceTypes : ['dine-in'];
  }
}

let kitchensInstance: KitchensService | null = null;

export function initializeKitchens(db: DatabaseService): void {
  kitchensInstance = new KitchensService(db);
}

function requireKitchens(): KitchensService {
  if (!kitchensInstance) {
    throw new Error('Kitchens not initialized');
  }
  return kitchensInstance;
}

export function findAll(): ReturnType<KitchensService['findAll']> {
  return requireKitchens().findAll();
}

export function findOne(
  ...args: Parameters<KitchensService['findOne']>
): ReturnType<KitchensService['findOne']> {
  return requireKitchens().findOne(...args);
}

export function create(
  ...args: Parameters<KitchensService['create']>
): ReturnType<KitchensService['create']> {
  return requireKitchens().create(...args);
}

export function update(
  ...args: Parameters<KitchensService['update']>
): ReturnType<KitchensService['update']> {
  return requireKitchens().update(...args);
}

export function remove(
  ...args: Parameters<KitchensService['remove']>
): ReturnType<KitchensService['remove']> {
  return requireKitchens().remove(...args);
}

export function getItemsServiceTypes(
  ...args: Parameters<KitchensService['getItemsServiceTypes']>
): ReturnType<KitchensService['getItemsServiceTypes']> {
  return requireKitchens().getItemsServiceTypes(...args);
}
