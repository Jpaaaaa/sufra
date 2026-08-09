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
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

// Combo interfaces
export type ComboPricingMode = 'fixed' | 'sum';

export interface ComboProductRef {
  id: number;
  name: string;
  price: number;
  quantity: number;
  kitchen_id?: number | null;
}

export interface Combo {
  id: number;
  combo_name: string;
  combo_price: number;
  /** fixed = use combo_price; sum = price is sum of (product.price × quantity) */
  pricing_mode: ComboPricingMode;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_ids?: number[];
  products?: ComboProductRef[];
  /** 0–6 (Sun–Sat); empty/undefined = كل الأيام */
  weekdays?: number[];
}

export interface ComboItem {
  id: number;
  combo_id: number;
  product_id: number;
  quantity: number;
}

export type ComboItemInput = { product_id: number; quantity: number };

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
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

// Featured Item interfaces (legacy table; UI removed)
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
  pricing_mode?: ComboPricingMode;
  product_ids?: number[];
  products?: ComboProductRef[];
}

function isSingleUnitOffer(products?: ComboProductRef[]): boolean {
  if (!products || products.length === 0) return true;
  if (products.length > 1) return false;
  return Math.max(1, Number(products[0]?.quantity) || 1) === 1;
}

class OffersService {
  constructor(private readonly db: DatabaseService) {}

  // ========== Daily Deals ==========
  private mapOfferProducts(itemRows: any[]): ComboProductRef[] {
    return itemRows.map((item: any) => ({
      id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: Math.max(1, Number(item.quantity) || 1),
      kitchen_id: item.kitchen_id ?? null,
    }));
  }

  private async loadOfferItemRows(
    table: 'daily_deal_items' | 'happy_hour_items' | 'scheduled_offer_items',
    fk: string,
    ids: number[],
  ): Promise<any[]> {
    if (ids.length === 0) return [];
    return this.db.all(
      `SELECT ci.*, i.name, i.price, i.kitchen_id
       FROM ${table} ci
       INNER JOIN items i ON ci.product_id = i.id
       WHERE ci.${fk} IN (${ids.join(',')})`,
    );
  }

  private async replaceOfferItems(
    table: 'daily_deal_items' | 'happy_hour_items' | 'scheduled_offer_items',
    fk: string,
    parentId: number,
    items: ComboItemInput[],
  ): Promise<void> {
    await this.db.run(`DELETE FROM ${table} WHERE ${fk} = ?`, [parentId]);
    for (const row of items) {
      await this.db.run(
        `INSERT INTO ${table} (${fk}, product_id, quantity) VALUES (?, ?, ?)`,
        [parentId, row.product_id, row.quantity],
      );
    }
  }

  private hydrateDailyDeal(row: any, itemRows: any[]): DailyDeal {
    const products = this.mapOfferProducts(itemRows);
    return {
      ...(row as DailyDeal),
      pricing_mode: row.pricing_mode === 'sum' ? 'sum' : 'fixed',
      product_ids: products.map((p) => p.id),
      products,
      product_name: products[0]?.name ?? row.product_name,
    };
  }

  async createDailyDeal(data: {
    product_id?: number;
    special_price?: number;
    date: string;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }): Promise<DailyDeal> {
    const items = this.normalizeComboItems({
      items: data.items,
      product_ids:
        data.product_ids ??
        (data.product_id != null ? [data.product_id] : undefined),
    });
    if (items.length === 0) {
      throw new BadRequestException('Daily deal must have at least one product');
    }
    if (!data.date) {
      throw new BadRequestException('Date is required');
    }

    const productIds = [...new Set(items.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode = data.pricing_mode === 'sum' ? 'sum' : 'fixed';
    const special_price = await this.resolveComboPrice({
      pricing_mode,
      combo_price: data.special_price,
      items,
      productRows: products as Array<{ id: number; price: number }>,
    });
    const primaryId = items[0].product_id;

    await this.db.run(
      'INSERT INTO daily_deals (product_id, special_price, date, is_active, pricing_mode) VALUES (?, ?, ?, 1, ?)',
      [primaryId, special_price, data.date, pricing_mode],
    );
    const id = await this.db.getLastInsertRowId();
    await this.replaceOfferItems('daily_deal_items', 'daily_deal_id', id, items);
    return this.getDailyDealRowById(id);
  }

  async getDailyDealByDate(date: string): Promise<DailyDeal | null> {
    const row = await this.db.get(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.date = ?`,
      [date],
    );
    if (!row) return null;
    const items = await this.loadOfferItemRows('daily_deal_items', 'daily_deal_id', [row.id]);
    return this.hydrateDailyDeal(row, items);
  }

  async getActiveDailyDeal(): Promise<DailyDeal | null> {
    const today = new Date().toISOString().split('T')[0];
    const row = await this.db.get(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.date = ? AND COALESCE(d.is_active, 1) = 1 AND d.archived_at IS NULL`,
      [today],
    );
    if (!row) return null;
    const items = await this.loadOfferItemRows('daily_deal_items', 'daily_deal_id', [row.id]);
    return this.hydrateDailyDeal(row, items);
  }

  async updateDailyDeal(
    id: number,
    data: {
      is_active?: number;
      special_price?: number;
      date?: string;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ): Promise<DailyDeal> {
    const existing = await this.getDailyDealRowById(id);
    const hasItemsUpdate = data.items !== undefined || data.product_ids !== undefined;
    const nextItems = hasItemsUpdate
      ? this.normalizeComboItems(data)
      : (existing.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity }));

    if (hasItemsUpdate && nextItems.length === 0) {
      throw new BadRequestException('Daily deal must have at least one product');
    }

    const productIds = [...new Set(nextItems.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode =
      data.pricing_mode === 'sum' || data.pricing_mode === 'fixed'
        ? data.pricing_mode
        : existing.pricing_mode || 'fixed';

    const shouldResolvePrice =
      data.special_price !== undefined || data.pricing_mode !== undefined || hasItemsUpdate;

    const special_price = shouldResolvePrice
      ? await this.resolveComboPrice({
          pricing_mode,
          combo_price: data.special_price !== undefined ? data.special_price : existing.special_price,
          items: nextItems,
          productRows: products as Array<{ id: number; price: number }>,
        })
      : existing.special_price;

    const updates: string[] = [];
    const values: any[] = [];
    if (shouldResolvePrice || hasItemsUpdate) {
      updates.push('special_price = ?');
      values.push(special_price);
      updates.push('pricing_mode = ?');
      values.push(pricing_mode);
      updates.push('product_id = ?');
      values.push(nextItems[0].product_id);
    }
    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }
    if (updates.length > 0) {
      values.push(id);
      await this.db.run(`UPDATE daily_deals SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    if (hasItemsUpdate) {
      await this.replaceOfferItems('daily_deal_items', 'daily_deal_id', id, nextItems);
    }
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
    const items = await this.loadOfferItemRows('daily_deal_items', 'daily_deal_id', [id]);
    return this.hydrateDailyDeal(row, items);
  }

  async getAllDailyDeals(): Promise<DailyDeal[]> {
    const rows = await this.db.all(
      `SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       ORDER BY d.date DESC`,
    );
    if (!rows.length) return [];
    const ids = rows.map((r: any) => r.id);
    const itemRows = await this.loadOfferItemRows('daily_deal_items', 'daily_deal_id', ids);
    return rows.map((row: any) =>
      this.hydrateDailyDeal(
        row,
        itemRows.filter((i: any) => i.daily_deal_id === row.id),
      ),
    );
  }

  async deleteDailyDeal(id: number): Promise<void> {
    await this.db.run('DELETE FROM daily_deal_items WHERE daily_deal_id = ?', [id]);
    await this.db.run('DELETE FROM daily_deals WHERE id = ?', [id]);
  }

  // ========== Combos ==========
  private normalizeComboItems(
    data: {
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ): ComboItemInput[] {
    if (data.items && data.items.length > 0) {
      return data.items.map((row) => ({
        product_id: Number(row.product_id),
        quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
      }));
    }
    if (data.product_ids && data.product_ids.length > 0) {
      return data.product_ids.map((product_id) => ({
        product_id: Number(product_id),
        quantity: 1,
      }));
    }
    return [];
  }

  private async resolveComboPrice(opts: {
    pricing_mode: ComboPricingMode;
    combo_price?: number;
    items: ComboItemInput[];
    productRows: Array<{ id: number; price: number }>;
  }): Promise<number> {
    if (opts.pricing_mode === 'sum') {
      const priceById = new Map(opts.productRows.map((p) => [p.id, p.price]));
      return opts.items.reduce((sum, row) => {
        const unit = priceById.get(row.product_id) ?? 0;
        return sum + unit * row.quantity;
      }, 0);
    }
    const price = Number(opts.combo_price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Combo price must be a non-negative number');
    }
    return price;
  }

  private mapComboRow(
    combo: any,
    itemRows: any[],
  ): Combo {
    const products: ComboProductRef[] = itemRows.map((item: any) => ({
      id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: Math.max(1, Number(item.quantity) || 1),
      kitchen_id: item.kitchen_id ?? null,
    }));
    return {
      ...combo,
      pricing_mode: (combo.pricing_mode === 'sum' ? 'sum' : 'fixed') as ComboPricingMode,
      weekdays: parseWeekdaysJson(combo.weekdays),
      product_ids: products.map((p) => p.id),
      products,
    };
  }

  async createCombo(data: {
    combo_name: string;
    combo_price?: number;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
    weekdays?: number[] | null;
  }): Promise<Combo> {
    const items = this.normalizeComboItems(data);
    if (!String(data.combo_name || '').trim()) {
      throw new BadRequestException('Combo name is required');
    }
    if (items.length === 0) {
      throw new BadRequestException('Combo must have at least one product');
    }

    const productIds = [...new Set(items.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode = data.pricing_mode === 'sum' ? 'sum' : 'fixed';
    const combo_price = await this.resolveComboPrice({
      pricing_mode,
      combo_price: data.combo_price,
      items,
      productRows: products as Array<{ id: number; price: number }>,
    });

    const weekdaysJson =
      data.weekdays && data.weekdays.length > 0 ? JSON.stringify(data.weekdays) : null;
    await this.db.run(
      'INSERT INTO combos (combo_name, combo_price, pricing_mode, weekdays) VALUES (?, ?, ?, ?)',
      [data.combo_name.trim(), combo_price, pricing_mode, weekdaysJson],
    );
    const comboId = await this.db.getLastInsertRowId();
    if (!comboId) {
      throw new Error('Failed to retrieve created combo id');
    }

    for (const row of items) {
      await this.db.run(
        'INSERT INTO combo_items (combo_id, product_id, quantity) VALUES (?, ?, ?)',
        [comboId, row.product_id, row.quantity],
      );
    }

    return this.getCombo(comboId);
  }

  async getAllCombos(): Promise<Combo[]> {
    const comboRows = await this.db.all('SELECT * FROM combos ORDER BY created_at DESC');

    if (comboRows.length === 0) {
      return [];
    }

    const comboIds = comboRows.map((c: any) => c.id);
    const itemRows = await this.db.all(
      `SELECT ci.*, i.name, i.price, i.kitchen_id
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id IN (${comboIds.join(',')})`,
    );

    return comboRows.map((combo: any) => {
      const items = itemRows.filter((item: any) => item.combo_id === combo.id);
      return this.mapComboRow(combo, items);
    });
  }

  async getCombo(id: number): Promise<Combo> {
    const combo = await this.db.get('SELECT * FROM combos WHERE id = ?', [id]);
    if (!combo) {
      throw new NotFoundException('Combo not found');
    }

    const itemRows = await this.db.all(
      `SELECT ci.*, i.name, i.price, i.kitchen_id
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id = ?`,
      [id],
    );

    return this.mapComboRow(combo, itemRows);
  }

  async updateCombo(id: number, data: {
    combo_name?: string;
    combo_price?: number;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
    is_active?: number;
    weekdays?: number[] | null;
  }): Promise<Combo> {
    const existing = await this.getCombo(id);

    const hasItemsUpdate = data.items !== undefined || data.product_ids !== undefined;
    const nextItems = hasItemsUpdate
      ? this.normalizeComboItems(data)
      : (existing.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity }));

    if (hasItemsUpdate && nextItems.length === 0) {
      throw new BadRequestException('Combo must have at least one product');
    }

    const productIds = [...new Set(nextItems.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode =
      data.pricing_mode === 'sum' || data.pricing_mode === 'fixed'
        ? data.pricing_mode
        : existing.pricing_mode || 'fixed';

    const shouldResolvePrice =
      data.combo_price !== undefined ||
      data.pricing_mode !== undefined ||
      hasItemsUpdate;

    const combo_price = shouldResolvePrice
      ? await this.resolveComboPrice({
          pricing_mode,
          combo_price: data.combo_price !== undefined ? data.combo_price : existing.combo_price,
          items: nextItems,
          productRows: products as Array<{ id: number; price: number }>,
        })
      : existing.combo_price;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.combo_name !== undefined) {
      updates.push('combo_name = ?');
      values.push(data.combo_name);
    }
    if (shouldResolvePrice || data.combo_price !== undefined || data.pricing_mode !== undefined) {
      updates.push('combo_price = ?');
      values.push(combo_price);
      updates.push('pricing_mode = ?');
      values.push(pricing_mode);
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

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await this.db.run(`UPDATE combos SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (hasItemsUpdate) {
      await this.db.run('DELETE FROM combo_items WHERE combo_id = ?', [id]);
      for (const row of nextItems) {
        await this.db.run(
          'INSERT INTO combo_items (combo_id, product_id, quantity) VALUES (?, ?, ?)',
          [id, row.product_id, row.quantity],
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
  private hydrateScheduledOffer(row: any, itemRows: any[]): ScheduledOffer {
    const products = this.mapOfferProducts(itemRows);
    return {
      ...(row as ScheduledOffer),
      pricing_mode: row.pricing_mode === 'sum' ? 'sum' : 'fixed',
      product_ids: products.map((p) => p.id),
      products,
      product_name: products[0]?.name ?? row.product_name,
    };
  }

  async createScheduledOffer(data: {
    product_id?: number;
    combo_id?: number;
    special_price?: number;
    start_datetime: string;
    end_datetime: string;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }): Promise<ScheduledOffer> {
    const items = this.normalizeComboItems(data);
    const hasItems = items.length > 0;

    if (!hasItems && !data.product_id && !data.combo_id) {
      throw new BadRequestException('Provide products, product_id, or combo_id');
    }
    if (!hasItems && data.product_id && data.combo_id) {
      throw new BadRequestException('Cannot provide both product_id and combo_id');
    }
    if (!data.start_datetime || !data.end_datetime) {
      throw new BadRequestException('Start and end datetime are required');
    }

    if (hasItems) {
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const products = await this.db.all(
        `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
      );
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }
      const pricing_mode: ComboPricingMode = data.pricing_mode === 'sum' ? 'sum' : 'fixed';
      const special_price = await this.resolveComboPrice({
        pricing_mode,
        combo_price: data.special_price,
        items,
        productRows: products as Array<{ id: number; price: number }>,
      });
      const primaryId = items[0].product_id;
      await this.db.run(
        'INSERT INTO scheduled_offers (product_id, combo_id, special_price, start_datetime, end_datetime, pricing_mode) VALUES (?, NULL, ?, ?, ?, ?)',
        [primaryId, special_price, data.start_datetime, data.end_datetime, pricing_mode],
      );
      const id = await this.db.getLastInsertRowId();
      await this.replaceOfferItems('scheduled_offer_items', 'scheduled_offer_id', id, items);
      return this.getScheduledOffer(id);
    }

    if (data.product_id) {
      const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
      if (!product) throw new NotFoundException('Product not found');
      const special_price = Number(data.special_price);
      if (!Number.isFinite(special_price) || special_price < 0) {
        throw new BadRequestException('Special price must be a non-negative number');
      }
      await this.db.run(
        'INSERT INTO scheduled_offers (product_id, special_price, start_datetime, end_datetime, pricing_mode) VALUES (?, ?, ?, ?, ?)',
        [data.product_id, special_price, data.start_datetime, data.end_datetime, 'fixed'],
      );
      const id = await this.db.getLastInsertRowId();
      await this.replaceOfferItems('scheduled_offer_items', 'scheduled_offer_id', id, [
        { product_id: data.product_id, quantity: 1 },
      ]);
      return this.getScheduledOffer(id);
    }

    const combo = await this.getCombo(data.combo_id!);
    const special_price = Number(data.special_price);
    if (!Number.isFinite(special_price) || special_price < 0) {
      throw new BadRequestException('Special price must be a non-negative number');
    }
    await this.db.run(
      'INSERT INTO scheduled_offers (combo_id, special_price, start_datetime, end_datetime, pricing_mode) VALUES (?, ?, ?, ?, ?)',
      [data.combo_id, special_price, data.start_datetime, data.end_datetime, 'fixed'],
    );
    const id = await this.db.getLastInsertRowId();
    return {
      ...(await this.getScheduledOffer(id)),
      combo_name: combo.combo_name,
    };
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
    if (!rows.length) return [];
    const ids = rows.map((r: any) => r.id);
    const itemRows = await this.loadOfferItemRows(
      'scheduled_offer_items',
      'scheduled_offer_id',
      ids,
    );
    return rows.map((row: any) =>
      this.hydrateScheduledOffer(
        row,
        itemRows.filter((i: any) => i.scheduled_offer_id === row.id),
      ),
    );
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
       AND s.archived_at IS NULL
       AND s.start_datetime <= ?
       AND s.end_datetime >= ?`,
      [now, now],
    );
    if (!rows.length) return [];
    const ids = rows.map((r: any) => r.id);
    const itemRows = await this.loadOfferItemRows(
      'scheduled_offer_items',
      'scheduled_offer_id',
      ids,
    );
    return rows.map((row: any) =>
      this.hydrateScheduledOffer(
        row,
        itemRows.filter((i: any) => i.scheduled_offer_id === row.id),
      ),
    );
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
    const items = await this.loadOfferItemRows('scheduled_offer_items', 'scheduled_offer_id', [id]);
    return this.hydrateScheduledOffer(row, items);
  }

  async updateScheduledOffer(
    id: number,
    data: {
      special_price?: number;
      start_datetime?: string;
      end_datetime?: string;
      is_active?: number;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ): Promise<ScheduledOffer> {
    const existing = await this.getScheduledOffer(id);
    const hasItemsUpdate = data.items !== undefined || data.product_ids !== undefined;
    const nextItems = hasItemsUpdate
      ? this.normalizeComboItems(data)
      : (existing.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity }));

    if (hasItemsUpdate && nextItems.length === 0 && !existing.combo_id) {
      throw new BadRequestException('Scheduled offer must have at least one product');
    }

    let special_price = existing.special_price;
    let pricing_mode: ComboPricingMode = existing.pricing_mode || 'fixed';

    if (nextItems.length > 0 && (hasItemsUpdate || data.special_price !== undefined || data.pricing_mode !== undefined)) {
      const productIds = [...new Set(nextItems.map((i) => i.product_id))];
      const products = await this.db.all(
        `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
      );
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }
      pricing_mode =
        data.pricing_mode === 'sum' || data.pricing_mode === 'fixed'
          ? data.pricing_mode
          : existing.pricing_mode || 'fixed';
      special_price = await this.resolveComboPrice({
        pricing_mode,
        combo_price: data.special_price !== undefined ? data.special_price : existing.special_price,
        items: nextItems,
        productRows: products as Array<{ id: number; price: number }>,
      });
    } else if (data.special_price !== undefined) {
      special_price = data.special_price;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (
      hasItemsUpdate ||
      data.special_price !== undefined ||
      data.pricing_mode !== undefined
    ) {
      updates.push('special_price = ?');
      values.push(special_price);
      updates.push('pricing_mode = ?');
      values.push(pricing_mode);
      if (nextItems.length > 0) {
        updates.push('product_id = ?');
        values.push(nextItems[0].product_id);
        updates.push('combo_id = NULL');
      }
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

    if (updates.length > 0) {
      values.push(id);
      await this.db.run(`UPDATE scheduled_offers SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    if (hasItemsUpdate && nextItems.length > 0) {
      await this.replaceOfferItems('scheduled_offer_items', 'scheduled_offer_id', id, nextItems);
    }
    return this.getScheduledOffer(id);
  }

  async deleteScheduledOffer(id: number): Promise<void> {
    await this.getScheduledOffer(id);
    await this.db.run('DELETE FROM scheduled_offer_items WHERE scheduled_offer_id = ?', [id]);
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
  private hydrateHappyHour(row: any, itemRows: any[]): HappyHour {
    const products = this.mapOfferProducts(itemRows);
    return {
      ...(row as object),
      weekdays: parseWeekdaysJson(row.weekdays),
      pricing_mode: row.pricing_mode === 'sum' ? 'sum' : 'fixed',
      product_ids: products.map((p) => p.id),
      products,
      product_name: products[0]?.name ?? row.product_name,
    } as HappyHour;
  }

  async createHappyHour(data: {
    product_id?: number;
    happy_hour_price?: number;
    time_start: string;
    time_end: string;
    weekdays?: number[] | null;
    pricing_mode?: ComboPricingMode;
    product_ids?: number[];
    items?: ComboItemInput[];
  }): Promise<HappyHour> {
    const items = this.normalizeComboItems({
      items: data.items,
      product_ids:
        data.product_ids ??
        (data.product_id != null ? [data.product_id] : undefined),
    });
    if (items.length === 0) {
      throw new BadRequestException('Happy hour must have at least one product');
    }
    if (!data.time_start || !data.time_end) {
      throw new BadRequestException('Time start and end are required');
    }

    const productIds = [...new Set(items.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode = data.pricing_mode === 'sum' ? 'sum' : 'fixed';
    const happy_hour_price = await this.resolveComboPrice({
      pricing_mode,
      combo_price: data.happy_hour_price,
      items,
      productRows: products as Array<{ id: number; price: number }>,
    });
    const primaryId = items[0].product_id;
    const wdJson =
      data.weekdays && data.weekdays.length > 0 ? JSON.stringify(data.weekdays) : null;

    await this.db.run(
      'INSERT INTO happy_hour (product_id, happy_hour_price, time_start, time_end, weekdays, pricing_mode) VALUES (?, ?, ?, ?, ?, ?)',
      [primaryId, happy_hour_price, data.time_start, data.time_end, wdJson, pricing_mode],
    );
    const id = await this.db.getLastInsertRowId();
    await this.replaceOfferItems('happy_hour_items', 'happy_hour_id', id, items);
    return this.getHappyHour(id);
  }

  async getAllHappyHours(): Promise<HappyHour[]> {
    const rows = await this.db.all(
      `SELECT h.*, i.name as product_name 
       FROM happy_hour h 
       INNER JOIN items i ON h.product_id = i.id 
       ORDER BY h.created_at DESC`,
    );
    if (!rows.length) return [];
    const ids = rows.map((r: any) => r.id);
    const itemRows = await this.loadOfferItemRows('happy_hour_items', 'happy_hour_id', ids);
    return rows.map((row: any) =>
      this.hydrateHappyHour(
        row,
        itemRows.filter((i: any) => i.happy_hour_id === row.id),
      ),
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
    const items = await this.loadOfferItemRows('happy_hour_items', 'happy_hour_id', [id]);
    return this.hydrateHappyHour(row, items);
  }

  async updateHappyHour(
    id: number,
    data: {
      happy_hour_price?: number;
      time_start?: string;
      time_end?: string;
      is_active?: number;
      weekdays?: number[] | null;
      pricing_mode?: ComboPricingMode;
      product_ids?: number[];
      items?: ComboItemInput[];
    },
  ): Promise<HappyHour> {
    const existing = await this.getHappyHour(id);
    const hasItemsUpdate = data.items !== undefined || data.product_ids !== undefined;
    const nextItems = hasItemsUpdate
      ? this.normalizeComboItems(data)
      : (existing.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity }));

    if (hasItemsUpdate && nextItems.length === 0) {
      throw new BadRequestException('Happy hour must have at least one product');
    }

    const productIds = [...new Set(nextItems.map((i) => i.product_id))];
    const products = await this.db.all(
      `SELECT id, name, price, kitchen_id FROM items WHERE id IN (${productIds.join(',')})`,
    );
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const pricing_mode: ComboPricingMode =
      data.pricing_mode === 'sum' || data.pricing_mode === 'fixed'
        ? data.pricing_mode
        : existing.pricing_mode || 'fixed';

    const shouldResolvePrice =
      data.happy_hour_price !== undefined || data.pricing_mode !== undefined || hasItemsUpdate;

    const happy_hour_price = shouldResolvePrice
      ? await this.resolveComboPrice({
          pricing_mode,
          combo_price:
            data.happy_hour_price !== undefined ? data.happy_hour_price : existing.happy_hour_price,
          items: nextItems,
          productRows: products as Array<{ id: number; price: number }>,
        })
      : existing.happy_hour_price;

    const updates: string[] = [];
    const values: any[] = [];

    if (shouldResolvePrice || hasItemsUpdate) {
      updates.push('happy_hour_price = ?');
      values.push(happy_hour_price);
      updates.push('pricing_mode = ?');
      values.push(pricing_mode);
      updates.push('product_id = ?');
      values.push(nextItems[0].product_id);
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

    if (updates.length > 0) {
      values.push(id);
      await this.db.run(`UPDATE happy_hour SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    if (hasItemsUpdate) {
      await this.replaceOfferItems('happy_hour_items', 'happy_hour_id', id, nextItems);
    }
    return this.getHappyHour(id);
  }

  async deleteHappyHour(id: number): Promise<void> {
    await this.getHappyHour(id);
    await this.db.run('DELETE FROM happy_hour_items WHERE happy_hour_id = ?', [id]);
    await this.db.run('DELETE FROM happy_hour WHERE id = ?', [id]);
  }

  async getActiveHappyHourPrice(product_id: number): Promise<number | null> {
    const all = await this.getAllHappyHours();
    const now = new Date();
    for (const row of all) {
      if (row.is_active !== 1 || (row as any).archived_at) continue;
      if (!isSingleUnitOffer(row.products)) continue;
      if (row.product_id !== product_id) continue;
      if (
        happyHourRowMatchesNow(
          {
            time_start: row.time_start,
            time_end: row.time_end,
            weekdays: row.weekdays,
          },
          now,
        )
      ) {
        return row.happy_hour_price;
      }
    }
    return null;
  }

  // ========== Helper: Get effective price for a product ==========
  async getEffectivePrice(product_id: number): Promise<number | null> {
    // Priority (unified with FE): Daily → Happy Hour → Scheduled → catalog
    // Multi-product trays are not applied as single-product price overrides.
    const dailyDeal = await this.getActiveDailyDeal();
    if (
      dailyDeal &&
      dailyDeal.product_id === product_id &&
      !(dailyDeal as any).archived_at &&
      isSingleUnitOffer(dailyDeal.products)
    ) {
      return dailyDeal.special_price;
    }

    const happyHourPrice = await this.getActiveHappyHourPrice(product_id);
    if (happyHourPrice !== null) {
      return happyHourPrice;
    }

    const activeScheduledOffers = await this.getActiveScheduledOffers();
    const scheduledOffer = activeScheduledOffers.find(
      (so) => so.product_id === product_id && isSingleUnitOffer(so.products),
    );
    if (scheduledOffer) {
      return scheduledOffer.special_price;
    }

    return null;
  }

  async getEffectiveComboPrice(combo_id: number, baseComboPrice: number): Promise<number> {
    const activeScheduledOffers = await this.getActiveScheduledOffers();
    const scheduled = activeScheduledOffers.find((so) => so.combo_id === combo_id);
    if (scheduled) return scheduled.special_price;
    return baseComboPrice;
  }

  private async writeOfferAudit(opts: {
    event: string;
    offer_type: string;
    offer_id: number | null;
    actor?: { id?: number; username?: string } | null;
    before?: unknown;
    after?: unknown;
  }): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO offer_audit_log (event, offer_type, offer_id, user_id, username, before_json, after_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          opts.event,
          opts.offer_type,
          opts.offer_id,
          opts.actor?.id ?? null,
          opts.actor?.username ?? null,
          opts.before != null ? JSON.stringify(opts.before) : null,
          opts.after != null ? JSON.stringify(opts.after) : null,
        ],
      );
    } catch (e) {
      console.error('[Offers] audit log failed', e);
    }
  }

  async archiveDailyDeal(id: number, actor?: { id?: number; username?: string } | null): Promise<DailyDeal> {
    const before = await this.getDailyDealRowById(id);
    await this.db.run(
      `UPDATE daily_deals SET archived_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?`,
      [id],
    );
    const after = await this.getDailyDealRowById(id);
    await this.writeOfferAudit({
      event: 'offer_archived',
      offer_type: 'daily_deal',
      offer_id: id,
      actor,
      before,
      after,
    });
    return after;
  }

  async archiveCombo(id: number, actor?: { id?: number; username?: string } | null): Promise<Combo> {
    const before = await this.getCombo(id);
    await this.db.run(
      `UPDATE combos SET archived_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
    const after = await this.getCombo(id);
    await this.writeOfferAudit({
      event: 'offer_archived',
      offer_type: 'combo',
      offer_id: id,
      actor,
      before,
      after,
    });
    return after;
  }

  async archiveScheduledOffer(
    id: number,
    actor?: { id?: number; username?: string } | null,
  ): Promise<ScheduledOffer> {
    const before = await this.getScheduledOffer(id);
    await this.db.run(
      `UPDATE scheduled_offers SET archived_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?`,
      [id],
    );
    const after = await this.getScheduledOffer(id);
    await this.writeOfferAudit({
      event: 'offer_archived',
      offer_type: 'scheduled',
      offer_id: id,
      actor,
      before,
      after,
    });
    return after;
  }

  async archiveHappyHour(id: number, actor?: { id?: number; username?: string } | null): Promise<HappyHour> {
    const before = await this.getHappyHour(id);
    await this.db.run(
      `UPDATE happy_hour SET archived_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?`,
      [id],
    );
    const after = await this.getHappyHour(id);
    await this.writeOfferAudit({
      event: 'offer_archived',
      offer_type: 'happy_hour',
      offer_id: id,
      actor,
      before,
      after,
    });
    return after;
  }

  async duplicateCombo(id: number, actor?: { id?: number; username?: string } | null): Promise<Combo> {
    const src = await this.getCombo(id);
    const created = await this.createCombo({
      combo_name: `نسخة - ${src.combo_name}`,
      combo_price: src.combo_price,
      pricing_mode: src.pricing_mode || 'fixed',
      items: (src.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity || 1 })),
      weekdays: src.weekdays ?? null,
    });
    await this.db.run('UPDATE combos SET is_active = 0 WHERE id = ?', [created.id]);
    const inactive = await this.getCombo(created.id);
    await this.writeOfferAudit({
      event: 'offer_created',
      offer_type: 'combo',
      offer_id: inactive.id,
      actor,
      after: inactive,
    });
    return inactive;
  }

  async duplicateDailyDeal(
    id: number,
    actor?: { id?: number; username?: string } | null,
  ): Promise<DailyDeal> {
    const src = await this.getDailyDealRowById(id);
    const created = await this.createDailyDeal({
      special_price: src.special_price,
      date: src.date,
      pricing_mode: src.pricing_mode || 'fixed',
      items: (src.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity || 1 })),
    });
    await this.db.run('UPDATE daily_deals SET is_active = 0 WHERE id = ?', [created.id]);
    const row = await this.getDailyDealRowById(created.id);
    await this.writeOfferAudit({
      event: 'offer_created',
      offer_type: 'daily_deal',
      offer_id: row.id,
      actor,
      after: row,
    });
    return row;
  }

  async duplicateHappyHour(
    id: number,
    actor?: { id?: number; username?: string } | null,
  ): Promise<HappyHour> {
    const src = await this.getHappyHour(id);
    const created = await this.createHappyHour({
      happy_hour_price: src.happy_hour_price,
      time_start: src.time_start,
      time_end: src.time_end,
      weekdays: src.weekdays ?? null,
      pricing_mode: src.pricing_mode || 'fixed',
      items: (src.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity || 1 })),
    });
    await this.db.run('UPDATE happy_hour SET is_active = 0 WHERE id = ?', [created.id]);
    const row = await this.getHappyHour(created.id);
    await this.writeOfferAudit({
      event: 'offer_created',
      offer_type: 'happy_hour',
      offer_id: row.id,
      actor,
      after: row,
    });
    return row;
  }

  async duplicateScheduledOffer(
    id: number,
    actor?: { id?: number; username?: string } | null,
  ): Promise<ScheduledOffer> {
    const src = await this.getScheduledOffer(id);
    const created = await this.createScheduledOffer({
      product_id: src.products?.length ? undefined : src.product_id ?? undefined,
      combo_id: src.products?.length ? undefined : src.combo_id ?? undefined,
      special_price: src.special_price,
      start_datetime: src.start_datetime,
      end_datetime: src.end_datetime,
      pricing_mode: src.pricing_mode || 'fixed',
      items: (src.products || []).map((p) => ({ product_id: p.id, quantity: p.quantity || 1 })),
    });
    await this.db.run('UPDATE scheduled_offers SET is_active = 0 WHERE id = ?', [created.id]);
    const row = await this.getScheduledOffer(created.id);
    await this.writeOfferAudit({
      event: 'offer_created',
      offer_type: 'scheduled',
      offer_id: row.id,
      actor,
      after: row,
    });
    return row;
  }

  // ========== Helper: Enrich items with offer prices ==========
  async enrichItemsWithOffers(items: Array<{ id: number; name: string; price: number; categoryId?: number | null; kitchen_id?: number | null }>): Promise<Array<{
    id: number;
    name: string;
    price: number;
    original_price: number;
    categoryId?: number | null;
    kitchen_id?: number | null;
    is_featured: boolean;
  }>> {
    const [dailyDeal, activeScheduledOffers, activeHappyHours] = await Promise.all([
      this.getActiveDailyDeal(),
      this.getActiveScheduledOffers(),
      this.getAllHappyHours().then((hh) => hh.filter((h) => h.is_active === 1 && !(h as any).archived_at)),
    ]);

    const now = new Date();

    return items.map((item) => {
      let price = item.price;
      let original_price = item.price;

      if (
        dailyDeal &&
        dailyDeal.product_id === item.id &&
        !(dailyDeal as any).archived_at &&
        isSingleUnitOffer(dailyDeal.products)
      ) {
        price = dailyDeal.special_price;
      } else {
        const hh = activeHappyHours.find(
          (h) =>
            h.product_id === item.id &&
            isSingleUnitOffer(h.products) &&
            happyHourRowMatchesNow(
              { time_start: h.time_start, time_end: h.time_end, weekdays: h.weekdays },
              now,
            ),
        );
        if (hh) {
          price = hh.happy_hour_price;
        } else {
          const scheduled = activeScheduledOffers.find(
            (so) => so.product_id === item.id && isSingleUnitOffer(so.products),
          );
          if (scheduled) price = scheduled.special_price;
        }
      }

      return {
        ...item,
        price,
        original_price,
        is_featured: false,
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

export function archiveDailyDeal(
  ...args: Parameters<OffersService['archiveDailyDeal']>
): ReturnType<OffersService['archiveDailyDeal']> {
  return requireOffers().archiveDailyDeal(...args);
}

export function archiveCombo(
  ...args: Parameters<OffersService['archiveCombo']>
): ReturnType<OffersService['archiveCombo']> {
  return requireOffers().archiveCombo(...args);
}

export function archiveScheduledOffer(
  ...args: Parameters<OffersService['archiveScheduledOffer']>
): ReturnType<OffersService['archiveScheduledOffer']> {
  return requireOffers().archiveScheduledOffer(...args);
}

export function archiveHappyHour(
  ...args: Parameters<OffersService['archiveHappyHour']>
): ReturnType<OffersService['archiveHappyHour']> {
  return requireOffers().archiveHappyHour(...args);
}

export function duplicateCombo(
  ...args: Parameters<OffersService['duplicateCombo']>
): ReturnType<OffersService['duplicateCombo']> {
  return requireOffers().duplicateCombo(...args);
}

export function duplicateDailyDeal(
  ...args: Parameters<OffersService['duplicateDailyDeal']>
): ReturnType<OffersService['duplicateDailyDeal']> {
  return requireOffers().duplicateDailyDeal(...args);
}

export function duplicateHappyHour(
  ...args: Parameters<OffersService['duplicateHappyHour']>
): ReturnType<OffersService['duplicateHappyHour']> {
  return requireOffers().duplicateHappyHour(...args);
}

export function duplicateScheduledOffer(
  ...args: Parameters<OffersService['duplicateScheduledOffer']>
): ReturnType<OffersService['duplicateScheduledOffer']> {
  return requireOffers().duplicateScheduledOffer(...args);
}

export function getEffectiveComboPrice(
  ...args: Parameters<OffersService['getEffectiveComboPrice']>
): ReturnType<OffersService['getEffectiveComboPrice']> {
  return requireOffers().getEffectiveComboPrice(...args);
}

