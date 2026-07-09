import { NotFoundException, BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { parseWeekdaysJson } from './weekday-helpers';
import { happyHourRowMatchesNow } from './happy-hour-match';

// Daily Deal interfaces
export interface DailyDeal {
  id: number;
  product_id: number;
  special_price: number;
  date: string;
  created_at: string;
  product_name?: string;
  /** 1 = applied in POS; 0 = disabled */
  is_active?: number;
}

// Combo interfaces
export interface Combo {
  id: number;
  combo_name: string;
  combo_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_ids?: number[];
  products?: Array<{ id: number; name: string; price: number }>;
  /** 0–6 (Sun–Sat); empty/undefined = كل الأيام */
  weekdays?: number[];
}

export interface ComboItem {
  id: number;
  combo_id: number;
  product_id: number;
}

// Scheduled Offer interfaces
export interface ScheduledOffer {
  id: number;
  product_id: number | null;
  combo_id: number | null;
  special_price: number;
  start_datetime: string;
  end_datetime: string;
  is_active: number;
  created_at: string;
  product_name?: string;
  combo_name?: string;
}

// Featured Item interfaces
export interface FeaturedItem {
  id: number;
  product_id: number;
  featured: number;
  created_at: string;
  product_name?: string;
}

// Happy Hour interfaces
export interface HappyHour {
  id: number;
  product_id: number;
  happy_hour_price: number;
  time_start: string;
  time_end: string;
  is_active: number;
  created_at: string;
  product_name?: string;
  /** 0–6 (Sun–Sat); empty/undefined = كل الأيام */
  weekdays?: number[];
}

class OffersService {
  constructor(private readonly db: DatabaseService) {}

  // ========== Daily Deals ==========
  async createDailyDeal(data: { product_id: number; special_price: number; date: string }): Promise<DailyDeal> {
    // Check if product exists
    const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.db.run(
      'INSERT INTO daily_deals (product_id, special_price, date, is_active) VALUES (?, ?, ?, 1)',
      [data.product_id, data.special_price, data.date],
    );
    const id = await this.db.getLastInsertRowId();
    return {
      id: id,
      product_id: data.product_id,
      special_price: data.special_price,
      date: data.date,
      created_at: new Date().toISOString(),
      product_name: product.name,
      is_active: 1,
    };
  }

  async getDailyDealByDate(date: string): Promise<DailyDeal | null> {
    const row = await this.db.get(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.date = ?`,
      [date],
    );
    return (row as DailyDeal) || null;
  }

  async getActiveDailyDeal(): Promise<DailyDeal | null> {
    const today = new Date().toISOString().split('T')[0];
    const row = await this.db.get(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.date = ? AND COALESCE(d.is_active, 1) = 1`,
      [today],
    );
    return (row as DailyDeal) || null;
  }

  async updateDailyDeal(id: number, data: { is_active?: number }): Promise<DailyDeal> {
    const existing = await this.db.get('SELECT id FROM daily_deals WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundException('Daily deal not found');
    }
    if (data.is_active === undefined) {
      return this.getDailyDealRowById(id);
    }
    await this.db.run('UPDATE daily_deals SET is_active = ? WHERE id = ?', [data.is_active, id]);
    return this.getDailyDealRowById(id);
  }

  private async getDailyDealRowById(id: number): Promise<DailyDeal> {
    const row = await this.db.get(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Daily deal not found');
    }
    return row as DailyDeal;
  }

  async getAllDailyDeals(): Promise<DailyDeal[]> {
    const rows = await this.db.all(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       ORDER BY d.date DESC`,
    );
    return (rows as DailyDeal[]) || [];
  }

  async deleteDailyDeal(id: number): Promise<void> {
    await this.db.run('DELETE FROM daily_deals WHERE id = ?', [id]);
  }

  // ========== Combos ==========
  async createCombo(data: {
    combo_name: string;
    combo_price: number;
    product_ids: number[];
    weekdays?: number[] | null;
  }): Promise<Combo> {
    if (data.product_ids.length === 0) {
      throw new BadRequestException('Combo must have at least one product');
    }

    // Verify all products exist
    const productIds = data.product_ids.join(',');
    const products = await this.db.all(
      `SELECT id, name, price FROM items WHERE id IN (${productIds})`,
    );
    if (products.length !== data.product_ids.length) {
      throw new NotFoundException('One or more products not found');
    }

    const weekdaysJson =
      data.weekdays && data.weekdays.length > 0 ? JSON.stringify(data.weekdays) : null;
    await this.db.run(
      'INSERT INTO combos (combo_name, combo_price, weekdays) VALUES (?, ?, ?)',
      [data.combo_name, data.combo_price, weekdaysJson],
    );
    // sql.js last_insert_rowid() is unreliable; fetch the actual id instead
    const inserted = await this.db.get(
      'SELECT id FROM combos ORDER BY id DESC LIMIT 1',
    );
    const comboId = (inserted as { id: number })?.id;
    if (!comboId) {
      throw new Error('Failed to retrieve created combo id');
    }

    // Insert each combo item so products are stored and returned by getAllCombos
    for (const productId of data.product_ids) {
      await this.db.run(
        'INSERT INTO combo_items (combo_id, product_id) VALUES (?, ?)',
        [comboId, productId],
      );
    }

    return {
      id: comboId,
      combo_name: data.combo_name,
      combo_price: data.combo_price,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      product_ids: data.product_ids,
      products: products as Array<{ id: number; name: string; price: number }>,
      weekdays: data.weekdays && data.weekdays.length > 0 ? data.weekdays : undefined,
    };
  }

  async getAllCombos(): Promise<Combo[]> {
    const comboRows = await this.db.all('SELECT * FROM combos ORDER BY created_at DESC');

    if (comboRows.length === 0) {
      return [];
    }

    const comboIds = comboRows.map((c: any) => c.id);
    const itemRows = await this.db.all(
      `SELECT ci.*, i.name, i.price 
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id IN (${comboIds.join(',')})`,
    );

    const combos: Combo[] = comboRows.map((combo: any) => {
      const items = itemRows.filter((item: any) => item.combo_id === combo.id);
      return {
        ...combo,
        weekdays: parseWeekdaysJson(combo.weekdays),
        product_ids: items.map((item: any) => item.product_id),
        products: items.map((item: any) => ({
          id: item.product_id,
          name: item.name,
          price: item.price,
        })),
      };
    });

    return combos;
  }

  async getCombo(id: number): Promise<Combo> {
    const combo = await this.db.get('SELECT * FROM combos WHERE id = ?', [id]);
    if (!combo) {
      throw new NotFoundException('Combo not found');
    }

    const itemRows = await this.db.all(
      `SELECT ci.*, i.name, i.price 
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id = ?`,
      [id],
    );

    return {
      ...combo,
      weekdays: parseWeekdaysJson((combo as any).weekdays),
      product_ids: itemRows.map((item: any) => item.product_id),
      products: itemRows.map((item: any) => ({
        id: item.product_id,
        name: item.name,
        price: item.price,
      })),
    } as Combo;
  }

  async updateCombo(id: number, data: {
    combo_name?: string;
    combo_price?: number;
    product_ids?: number[];
    is_active?: number;
    weekdays?: number[] | null;
  }): Promise<Combo> {
    await this.getCombo(id); // Ensure combo exists

    // Update combo basic info
    if (
      data.combo_name !== undefined ||
      data.combo_price !== undefined ||
      data.is_active !== undefined ||
      data.weekdays !== undefined
    ) {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.combo_name !== undefined) {
        updates.push('combo_name = ?');
        values.push(data.combo_name);
      }
      if (data.combo_price !== undefined) {
        updates.push('combo_price = ?');
        values.push(data.combo_price);
      }
      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(data.is_active);
      }
      if (data.weekdays !== undefined) {
        updates.push('weekdays = ?');
        values.push(
          data.weekdays === null || data.weekdays.length === 0 ? null : JSON.stringify(data.weekdays),
        );
      }
      updates.push('updated_at = datetime("now")');
      values.push(id);

      await this.db.run(
        `UPDATE combos SET ${updates.join(', ')} WHERE id = ?`,
        values,
      );
    }

    // Update combo items if provided
    if (data.product_ids !== undefined) {
      if (data.product_ids.length === 0) {
        throw new BadRequestException('Combo must have at least one product');
      }

      // Verify all products exist
      const productIds = data.product_ids.join(',');
      const products = await this.db.all(
        `SELECT id FROM items WHERE id IN (${productIds})`,
      );
      if (products.length !== data.product_ids.length) {
        throw new NotFoundException('One or more products not found');
      }

      // Delete old combo items
      await this.db.run('DELETE FROM combo_items WHERE combo_id = ?', [id]);

      // Insert new combo items
      for (const productId of data.product_ids) {
        await this.db.run(
          'INSERT INTO combo_items (combo_id, product_id) VALUES (?, ?)',
          [id, productId],
        );
      }
    }

    return this.getCombo(id);
  }

  async deleteCombo(id: number): Promise<void> {
    await this.getCombo(id); // Ensure combo exists
    // Delete combo items first (should cascade, but being explicit)
    await this.db.run('DELETE FROM combo_items WHERE combo_id = ?', [id]);
    // Delete combo
    await this.db.run('DELETE FROM combos WHERE id = ?', [id]);
  }

  // ========== Scheduled Offers ==========
  async createScheduledOffer(data: {
    product_id?: number;
    combo_id?: number;
    special_price: number;
    start_datetime: string;
    end_datetime: string;
  }): Promise<ScheduledOffer> {
    if (!data.product_id && !data.combo_id) {
      throw new BadRequestException('Either product_id or combo_id must be provided');
    }
    if (data.product_id && data.combo_id) {
      throw new BadRequestException('Cannot provide both product_id and combo_id');
    }

    // Verify product or combo exists
    if (data.product_id) {
      const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      await this.db.run(
        'INSERT INTO scheduled_offers (product_id, special_price, start_datetime, end_datetime) VALUES (?, ?, ?, ?)',
        [data.product_id, data.special_price, data.start_datetime, data.end_datetime],
      );
      const id = await this.db.getLastInsertRowId();
      return {
        id: id,
        product_id: data.product_id!,
        combo_id: null,
        special_price: data.special_price,
        start_datetime: data.start_datetime,
        end_datetime: data.end_datetime,
        is_active: 1,
        created_at: new Date().toISOString(),
        product_name: product.name,
      };
    } else {
      const combo = await this.getCombo(data.combo_id!);

      await this.db.run(
        'INSERT INTO scheduled_offers (combo_id, special_price, start_datetime, end_datetime) VALUES (?, ?, ?, ?)',
        [data.combo_id, data.special_price, data.start_datetime, data.end_datetime],
      );
      const id = await this.db.getLastInsertRowId();
      return {
        id: id,
        product_id: null,
        combo_id: data.combo_id!,
        special_price: data.special_price,
        start_datetime: data.start_datetime,
        end_datetime: data.end_datetime,
        is_active: 1,
        created_at: new Date().toISOString(),
        combo_name: combo.combo_name,
      };
    }
  }

  async getAllScheduledOffers(): Promise<ScheduledOffer[]> {
    const rows = await this.db.all(
      `SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       ORDER BY s.start_datetime DESC`,
    );
    return (rows as ScheduledOffer[]) || [];
  }

  async getActiveScheduledOffers(): Promise<ScheduledOffer[]> {
    const now = new Date().toISOString();
    const rows = await this.db.all(
      `SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       WHERE s.is_active = 1 
       AND s.start_datetime <= ?
       AND s.end_datetime >= ?`,
      [now, now],
    );
    return (rows as ScheduledOffer[]) || [];
  }

  async getScheduledOffer(id: number): Promise<ScheduledOffer> {
    const row = await this.db.get(
      `SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       WHERE s.id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Scheduled offer not found');
    }
    return row as ScheduledOffer;
  }

  async updateScheduledOffer(
    id: number,
    data: { special_price?: number; start_datetime?: string; end_datetime?: string; is_active?: number },
  ): Promise<ScheduledOffer> {
    await this.getScheduledOffer(id);

    const updates: string[] = [];
    const values: any[] = [];

    if (data.special_price !== undefined) {
      updates.push('special_price = ?');
      values.push(data.special_price);
    }
    if (data.start_datetime !== undefined) {
      updates.push('start_datetime = ?');
      values.push(data.start_datetime);
    }
    if (data.end_datetime !== undefined) {
      updates.push('end_datetime = ?');
      values.push(data.end_datetime);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return this.getScheduledOffer(id);
    }

    values.push(id);

    await this.db.run(
      `UPDATE scheduled_offers SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
    return this.getScheduledOffer(id);
  }

  async deleteScheduledOffer(id: number): Promise<void> {
    await this.getScheduledOffer(id);
    await this.db.run('DELETE FROM scheduled_offers WHERE id = ?', [id]);
  }

  // ========== Featured Items ==========
  async setFeatured(product_id: number, featured: boolean): Promise<FeaturedItem> {
    // Check if product exists
    const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [product_id]);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (featured) {
      // Insert or replace
      await this.db.run(
        'INSERT OR REPLACE INTO featured_items (product_id, featured) VALUES (?, ?)',
        [product_id, 1],
      );
      const id = await this.db.getLastInsertRowId();
      return {
        id: id || product_id, // SQLite may return 0 for REPLACE
        product_id,
        featured: 1,
        created_at: new Date().toISOString(),
        product_name: product.name,
      };
    } else {
      // Delete
      await this.db.run('DELETE FROM featured_items WHERE product_id = ?', [product_id]);
      // Return a deleted item structure for consistency
      return {
        id: product_id,
        product_id,
        featured: 0,
        created_at: new Date().toISOString(),
        product_name: product.name,
      };
    }
  }

  async getAllFeaturedItems(): Promise<FeaturedItem[]> {
    const rows = await this.db.all(
      `SELECT f.*, i.name as product_name 
       FROM featured_items f 
       INNER JOIN items i ON f.product_id = i.id 
       WHERE f.featured = 1
       ORDER BY f.created_at DESC`,
    );
    return (rows as FeaturedItem[]) || [];
  }

  async isFeatured(product_id: number): Promise<boolean> {
    const row = await this.db.get(
      'SELECT COUNT(*) as count FROM featured_items WHERE product_id = ? AND featured = 1',
      [product_id],
    );
    return row?.count > 0;
  }

  // ========== Happy Hour ==========
  async createHappyHour(data: {
    product_id: number;
    happy_hour_price: number;
    time_start: string;
    time_end: string;
    weekdays?: number[] | null;
  }): Promise<HappyHour> {
    // Check if product exists
    const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wdJson =
      data.weekdays && data.weekdays.length > 0 ? JSON.stringify(data.weekdays) : null;
    await this.db.run(
      'INSERT INTO happy_hour (product_id, happy_hour_price, time_start, time_end, weekdays) VALUES (?, ?, ?, ?, ?)',
      [data.product_id, data.happy_hour_price, data.time_start, data.time_end, wdJson],
    );
    const id = await this.db.getLastInsertRowId();
    return {
      id: id,
      product_id: data.product_id,
      happy_hour_price: data.happy_hour_price,
      time_start: data.time_start,
      time_end: data.time_end,
      is_active: 1,
      created_at: new Date().toISOString(),
      product_name: product.name,
      weekdays: data.weekdays && data.weekdays.length > 0 ? data.weekdays : undefined,
    };
  }

  async getAllHappyHours(): Promise<HappyHour[]> {
    const rows = await this.db.all(
      `SELECT h.*, i.name as product_name 
       FROM happy_hour h 
       INNER JOIN items i ON h.product_id = i.id 
       ORDER BY h.created_at DESC`,
    );
    return (
      (rows as any[]).map((row) => ({
        ...row,
        weekdays: parseWeekdaysJson(row.weekdays),
      })) as HappyHour[]
    );
  }

  async getHappyHour(id: number): Promise<HappyHour> {
    const row = await this.db.get(
      `SELECT h.*, i.name as product_name 
       FROM happy_hour h 
       INNER JOIN items i ON h.product_id = i.id 
       WHERE h.id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Happy hour not found');
    }
    return {
      ...(row as object),
      weekdays: parseWeekdaysJson((row as any).weekdays),
    } as HappyHour;
  }

  async updateHappyHour(
    id: number,
    data: {
      happy_hour_price?: number;
      time_start?: string;
      time_end?: string;
      is_active?: number;
      weekdays?: number[] | null;
    },
  ): Promise<HappyHour> {
    await this.getHappyHour(id);

    const updates: string[] = [];
    const values: any[] = [];

    if (data.happy_hour_price !== undefined) {
      updates.push('happy_hour_price = ?');
      values.push(data.happy_hour_price);
    }
    if (data.time_start !== undefined) {
      updates.push('time_start = ?');
      values.push(data.time_start);
    }
    if (data.time_end !== undefined) {
      updates.push('time_end = ?');
      values.push(data.time_end);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }
    if (data.weekdays !== undefined) {
      updates.push('weekdays = ?');
      values.push(
        data.weekdays === null || data.weekdays.length === 0 ? null : JSON.stringify(data.weekdays),
      );
    }

    if (updates.length === 0) {
      return this.getHappyHour(id);
    }

    values.push(id);

    await this.db.run(
      `UPDATE happy_hour SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
    return this.getHappyHour(id);
  }

  async deleteHappyHour(id: number): Promise<void> {
    await this.getHappyHour(id);
    await this.db.run('DELETE FROM happy_hour WHERE id = ?', [id]);
  }

  async getActiveHappyHourPrice(product_id: number): Promise<number | null> {
    const rows = await this.db.all(
      `SELECT time_start, time_end, weekdays, happy_hour_price 
       FROM happy_hour 
       WHERE product_id = ? AND is_active = 1`,
      [product_id],
    );
    const now = new Date();
    for (const row of rows as any[]) {
      if (happyHourRowMatchesNow(row, now)) {
        return row.happy_hour_price;
      }
    }
    return null;
  }

  // ========== Helper: Get effective price for a product ==========
  async getEffectivePrice(product_id: number): Promise<number | null> {
    const conn = this.db.getConnection();
    
    // 1. Check daily deal (highest priority)
    const dailyDeal = await this.getActiveDailyDeal();
    if (dailyDeal && dailyDeal.product_id === product_id) {
      return dailyDeal.special_price;
    }
    
    // 2. Check scheduled offer
    const activeScheduledOffers = await this.getActiveScheduledOffers();
    const scheduledOffer = activeScheduledOffers.find((so) => so.product_id === product_id);
    if (scheduledOffer) {
      return scheduledOffer.special_price;
    }
    
    // 3. Check happy hour
    const happyHourPrice = await this.getActiveHappyHourPrice(product_id);
    if (happyHourPrice !== null) {
      return happyHourPrice;
    }
    
    // 4. Return base price (null means use original)
    return null;
  }

  // ========== Helper: Enrich items with offer prices and featured status ==========
  async enrichItemsWithOffers(items: Array<{ id: number; name: string; price: number; categoryId?: number | null; kitchen_id?: number | null }>): Promise<Array<{
    id: number;
    name: string;
    price: number;
    original_price: number;
    categoryId?: number | null;
    kitchen_id?: number | null;
    is_featured: boolean;
  }>> {
    // Batch fetch all offers for efficiency
    const [dailyDeal, activeScheduledOffers, featuredItems, activeHappyHours] = await Promise.all([
      this.getActiveDailyDeal(),
      this.getActiveScheduledOffers(),
      this.getAllFeaturedItems(),
      this.getAllHappyHours().then(hh => hh.filter(h => h.is_active === 1)),
    ]);

    const featuredSet = new Set(featuredItems.map(fi => fi.product_id));
    const now = new Date();

    return items.map((item) => {
      let effectivePrice: number | null = null;
      const originalPrice = item.price;

      // Priority 1: Daily Deal
      if (dailyDeal && dailyDeal.product_id === item.id) {
        effectivePrice = dailyDeal.special_price;
      } else {
        // Priority 2: Scheduled Offer
        const scheduledOffer = activeScheduledOffers.find((so) => so.product_id === item.id);
        if (scheduledOffer) {
          effectivePrice = scheduledOffer.special_price;
        } else {
          // Priority 3: Happy Hour (time + optional weekdays)
          const happyHour = activeHappyHours.find((hh) => {
            if (hh.product_id !== item.id) return false;
            return happyHourRowMatchesNow(
              { time_start: hh.time_start, time_end: hh.time_end, weekdays: hh.weekdays ?? null },
              now,
            );
          });
          if (happyHour) {
            effectivePrice = happyHour.happy_hour_price;
          }
        }
      }

      return {
        ...item,
        original_price: originalPrice,
        price: effectivePrice !== null ? effectivePrice : originalPrice,
        is_featured: featuredSet.has(item.id),
      };
    });
  }
}

let offersInstance: OffersService | null = null;

export function initializeOffers(db: DatabaseService): void {
  offersInstance = new OffersService(db);
}

function requireOffers(): OffersService {
  if (!offersInstance) {
    throw new Error('Offers not initialized');
  }
  return offersInstance;
}

export function createDailyDeal(
  ...args: Parameters<OffersService['createDailyDeal']>
): ReturnType<OffersService['createDailyDeal']> {
  return requireOffers().createDailyDeal(...args);
}

export function getDailyDealByDate(
  ...args: Parameters<OffersService['getDailyDealByDate']>
): ReturnType<OffersService['getDailyDealByDate']> {
  return requireOffers().getDailyDealByDate(...args);
}

export function getActiveDailyDeal(): ReturnType<OffersService['getActiveDailyDeal']> {
  return requireOffers().getActiveDailyDeal();
}

export function updateDailyDeal(
  ...args: Parameters<OffersService['updateDailyDeal']>
): ReturnType<OffersService['updateDailyDeal']> {
  return requireOffers().updateDailyDeal(...args);
}

export function getAllDailyDeals(): ReturnType<OffersService['getAllDailyDeals']> {
  return requireOffers().getAllDailyDeals();
}

export function deleteDailyDeal(
  ...args: Parameters<OffersService['deleteDailyDeal']>
): ReturnType<OffersService['deleteDailyDeal']> {
  return requireOffers().deleteDailyDeal(...args);
}

export function createCombo(
  ...args: Parameters<OffersService['createCombo']>
): ReturnType<OffersService['createCombo']> {
  return requireOffers().createCombo(...args);
}

export function getAllCombos(): ReturnType<OffersService['getAllCombos']> {
  return requireOffers().getAllCombos();
}

export function getCombo(
  ...args: Parameters<OffersService['getCombo']>
): ReturnType<OffersService['getCombo']> {
  return requireOffers().getCombo(...args);
}

export function updateCombo(
  ...args: Parameters<OffersService['updateCombo']>
): ReturnType<OffersService['updateCombo']> {
  return requireOffers().updateCombo(...args);
}

export function deleteCombo(
  ...args: Parameters<OffersService['deleteCombo']>
): ReturnType<OffersService['deleteCombo']> {
  return requireOffers().deleteCombo(...args);
}

export function createScheduledOffer(
  ...args: Parameters<OffersService['createScheduledOffer']>
): ReturnType<OffersService['createScheduledOffer']> {
  return requireOffers().createScheduledOffer(...args);
}

export function getAllScheduledOffers(): ReturnType<OffersService['getAllScheduledOffers']> {
  return requireOffers().getAllScheduledOffers();
}

export function getActiveScheduledOffers(): ReturnType<OffersService['getActiveScheduledOffers']> {
  return requireOffers().getActiveScheduledOffers();
}

export function getScheduledOffer(
  ...args: Parameters<OffersService['getScheduledOffer']>
): ReturnType<OffersService['getScheduledOffer']> {
  return requireOffers().getScheduledOffer(...args);
}

export function updateScheduledOffer(
  ...args: Parameters<OffersService['updateScheduledOffer']>
): ReturnType<OffersService['updateScheduledOffer']> {
  return requireOffers().updateScheduledOffer(...args);
}

export function deleteScheduledOffer(
  ...args: Parameters<OffersService['deleteScheduledOffer']>
): ReturnType<OffersService['deleteScheduledOffer']> {
  return requireOffers().deleteScheduledOffer(...args);
}

export function setFeatured(
  ...args: Parameters<OffersService['setFeatured']>
): ReturnType<OffersService['setFeatured']> {
  return requireOffers().setFeatured(...args);
}

export function getAllFeaturedItems(): ReturnType<OffersService['getAllFeaturedItems']> {
  return requireOffers().getAllFeaturedItems();
}

export function isFeatured(
  ...args: Parameters<OffersService['isFeatured']>
): ReturnType<OffersService['isFeatured']> {
  return requireOffers().isFeatured(...args);
}

export function createHappyHour(
  ...args: Parameters<OffersService['createHappyHour']>
): ReturnType<OffersService['createHappyHour']> {
  return requireOffers().createHappyHour(...args);
}

export function getAllHappyHours(): ReturnType<OffersService['getAllHappyHours']> {
  return requireOffers().getAllHappyHours();
}

export function getHappyHour(
  ...args: Parameters<OffersService['getHappyHour']>
): ReturnType<OffersService['getHappyHour']> {
  return requireOffers().getHappyHour(...args);
}

export function updateHappyHour(
  ...args: Parameters<OffersService['updateHappyHour']>
): ReturnType<OffersService['updateHappyHour']> {
  return requireOffers().updateHappyHour(...args);
}

export function deleteHappyHour(
  ...args: Parameters<OffersService['deleteHappyHour']>
): ReturnType<OffersService['deleteHappyHour']> {
  return requireOffers().deleteHappyHour(...args);
}

export function getEffectivePrice(
  ...args: Parameters<OffersService['getEffectivePrice']>
): ReturnType<OffersService['getEffectivePrice']> {
  return requireOffers().getEffectivePrice(...args);
}

export function enrichItemsWithOffers(
  ...args: Parameters<OffersService['enrichItemsWithOffers']>
): ReturnType<OffersService['enrichItemsWithOffers']> {
  return requireOffers().enrichItemsWithOffers(...args);
}

