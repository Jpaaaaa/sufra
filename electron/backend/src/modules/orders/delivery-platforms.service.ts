import { BadRequestException, NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface DeliveryPlatform {
  id: number;
  name: string;
  commission_percent: number;
  sort_order: number;
  created_at: string;
}

class DeliveryPlatformsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<DeliveryPlatform[]> {
    const rows = await this.db.all(
      `SELECT id, name, commission_percent, sort_order, created_at
       FROM delivery_platforms
       ORDER BY sort_order ASC, id ASC`,
    );
    return rows as DeliveryPlatform[];
  }

  async create(data: { name: string; commission_percent: number }): Promise<DeliveryPlatform> {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const pct = Number(data.commission_percent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new BadRequestException('commission_percent must be between 0 and 100');
    }
    const maxSort = await this.db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM delivery_platforms');
    const sortOrder = ((maxSort as { m: number })?.m ?? 0) + 1;

    await this.db.run(
      `INSERT INTO delivery_platforms (name, commission_percent, sort_order, created_at)
       VALUES (?, ?, ?, datetime('now', 'localtime'))`,
      [name, pct, sortOrder],
    );
    const row = await this.db.get(
      `SELECT id, name, commission_percent, sort_order, created_at FROM delivery_platforms ORDER BY id DESC LIMIT 1`,
    );
    return row as DeliveryPlatform;
  }

  async update(
    id: number,
    data: { name?: string; commission_percent?: number; sort_order?: number },
  ): Promise<DeliveryPlatform> {
    const existing = await this.db.get('SELECT id FROM delivery_platforms WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundException('Delivery platform not found');
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      fields.push('name = ?');
      values.push(name);
    }
    if (data.commission_percent !== undefined) {
      const pct = Number(data.commission_percent);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        throw new BadRequestException('commission_percent must be between 0 and 100');
      }
      fields.push('commission_percent = ?');
      values.push(pct);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    if (fields.length === 0) {
      const row = await this.db.get(
        `SELECT id, name, commission_percent, sort_order, created_at FROM delivery_platforms WHERE id = ?`,
        [id],
      );
      return row as DeliveryPlatform;
    }
    values.push(id);
    await this.db.run(`UPDATE delivery_platforms SET ${fields.join(', ')} WHERE id = ?`, values);
    const row = await this.db.get(
      `SELECT id, name, commission_percent, sort_order, created_at FROM delivery_platforms WHERE id = ?`,
      [id],
    );
    return row as DeliveryPlatform;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.db.get('SELECT id FROM delivery_platforms WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundException('Delivery platform not found');
    }
    await this.db.run('DELETE FROM delivery_platforms WHERE id = ?', [id]);
  }
}

let deliveryPlatformsInstance: DeliveryPlatformsService | null = null;

export function initializeDeliveryPlatforms(db: DatabaseService): void {
  deliveryPlatformsInstance = new DeliveryPlatformsService(db);
}

function requireDeliveryPlatforms(): DeliveryPlatformsService {
  if (!deliveryPlatformsInstance) {
    throw new Error('Delivery platforms not initialized');
  }
  return deliveryPlatformsInstance;
}

export function findAll(): ReturnType<DeliveryPlatformsService['findAll']> {
  return requireDeliveryPlatforms().findAll();
}

export function create(
  ...args: Parameters<DeliveryPlatformsService['create']>
): ReturnType<DeliveryPlatformsService['create']> {
  return requireDeliveryPlatforms().create(...args);
}

export function update(
  ...args: Parameters<DeliveryPlatformsService['update']>
): ReturnType<DeliveryPlatformsService['update']> {
  return requireDeliveryPlatforms().update(...args);
}

export function remove(
  ...args: Parameters<DeliveryPlatformsService['remove']>
): ReturnType<DeliveryPlatformsService['remove']> {
  return requireDeliveryPlatforms().remove(...args);
}
