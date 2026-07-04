"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffersService = void 0;
const exceptions_1 = require("../utils/exceptions");
class OffersService {
    constructor(db) {
        this.db = db;
    }
    // ========== Daily Deals ==========
    async createDailyDeal(data) {
        // Check if product exists
        const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
        if (!product) {
            throw new exceptions_1.NotFoundException('Product not found');
        }
        await this.db.run('INSERT INTO daily_deals (product_id, special_price, date) VALUES (?, ?, ?)', [data.product_id, data.special_price, data.date]);
        const id = await this.db.getLastInsertRowId();
        return {
            id: id,
            product_id: data.product_id,
            special_price: data.special_price,
            date: data.date,
            created_at: new Date().toISOString(),
            product_name: product.name,
        };
    }
    async getDailyDealByDate(date) {
        const row = await this.db.get(`SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       WHERE d.date = ?`, [date]);
        return row || null;
    }
    async getActiveDailyDeal() {
        const today = new Date().toISOString().split('T')[0];
        return this.getDailyDealByDate(today);
    }
    async getAllDailyDeals() {
        const rows = await this.db.all(`SELECT d.*, i.name as product_name 
       FROM daily_deals d 
       INNER JOIN items i ON d.product_id = i.id 
       ORDER BY d.date DESC`);
        return rows || [];
    }
    async deleteDailyDeal(id) {
        await this.db.run('DELETE FROM daily_deals WHERE id = ?', [id]);
    }
    // ========== Combos ==========
    async createCombo(data) {
        if (data.product_ids.length === 0) {
            throw new exceptions_1.BadRequestException('Combo must have at least one product');
        }
        // Verify all products exist
        const productIds = data.product_ids.join(',');
        const products = await this.db.all(`SELECT id, name, price FROM items WHERE id IN (${productIds})`);
        if (products.length !== data.product_ids.length) {
            throw new exceptions_1.NotFoundException('One or more products not found');
        }
        await this.db.run('INSERT INTO combos (combo_name, combo_price) VALUES (?, ?)', [data.combo_name, data.combo_price]);
        const comboId = await this.db.getLastInsertRowId();
        // Insert combo items using prepared statement
        const stmt = this.db.getConnection().prepare('INSERT INTO combo_items (combo_id, product_id) VALUES (?, ?)');
        try {
            for (const productId of data.product_ids) {
                stmt.bind([comboId, productId]);
                stmt.step();
                stmt.reset();
            }
        }
        catch (error) {
            // Rollback combo creation
            await this.db.run('DELETE FROM combos WHERE id = ?', [comboId]);
            throw error;
        }
        finally {
            stmt.free();
        }
        return {
            id: comboId,
            combo_name: data.combo_name,
            combo_price: data.combo_price,
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            product_ids: data.product_ids,
            products: products,
        };
    }
    async getAllCombos() {
        const comboRows = await this.db.all('SELECT * FROM combos ORDER BY created_at DESC');
        if (comboRows.length === 0) {
            return [];
        }
        const comboIds = comboRows.map((c) => c.id);
        const itemRows = await this.db.all(`SELECT ci.*, i.name, i.price 
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id IN (${comboIds.join(',')})`);
        const combos = comboRows.map((combo) => {
            const items = itemRows.filter((item) => item.combo_id === combo.id);
            return {
                ...combo,
                product_ids: items.map((item) => item.product_id),
                products: items.map((item) => ({
                    id: item.product_id,
                    name: item.name,
                    price: item.price,
                })),
            };
        });
        return combos;
    }
    async getCombo(id) {
        const combo = await this.db.get('SELECT * FROM combos WHERE id = ?', [id]);
        if (!combo) {
            throw new exceptions_1.NotFoundException('Combo not found');
        }
        const itemRows = await this.db.all(`SELECT ci.*, i.name, i.price 
       FROM combo_items ci 
       INNER JOIN items i ON ci.product_id = i.id 
       WHERE ci.combo_id = ?`, [id]);
        return {
            ...combo,
            product_ids: itemRows.map((item) => item.product_id),
            products: itemRows.map((item) => ({
                id: item.product_id,
                name: item.name,
                price: item.price,
            })),
        };
    }
    async updateCombo(id, data) {
        await this.getCombo(id); // Ensure combo exists
        // Update combo basic info
        if (data.combo_name !== undefined || data.combo_price !== undefined || data.is_active !== undefined) {
            const updates = [];
            const values = [];
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
            updates.push('updated_at = datetime("now")');
            values.push(id);
            await this.db.run(`UPDATE combos SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        // Update combo items if provided
        if (data.product_ids !== undefined) {
            if (data.product_ids.length === 0) {
                throw new exceptions_1.BadRequestException('Combo must have at least one product');
            }
            // Verify all products exist
            const productIds = data.product_ids.join(',');
            const products = await this.db.all(`SELECT id FROM items WHERE id IN (${productIds})`);
            if (products.length !== data.product_ids.length) {
                throw new exceptions_1.NotFoundException('One or more products not found');
            }
            // Delete old combo items
            await this.db.run('DELETE FROM combo_items WHERE combo_id = ?', [id]);
            // Insert new combo items using prepared statement
            const stmt = this.db.getConnection().prepare('INSERT INTO combo_items (combo_id, product_id) VALUES (?, ?)');
            try {
                for (const productId of data.product_ids) {
                    stmt.bind([id, productId]);
                    stmt.step();
                    stmt.reset();
                }
            }
            finally {
                stmt.free();
            }
        }
        return this.getCombo(id);
    }
    async deleteCombo(id) {
        await this.getCombo(id); // Ensure combo exists
        // Delete combo items first (should cascade, but being explicit)
        await this.db.run('DELETE FROM combo_items WHERE combo_id = ?', [id]);
        // Delete combo
        await this.db.run('DELETE FROM combos WHERE id = ?', [id]);
    }
    // ========== Scheduled Offers ==========
    async createScheduledOffer(data) {
        if (!data.product_id && !data.combo_id) {
            throw new exceptions_1.BadRequestException('Either product_id or combo_id must be provided');
        }
        if (data.product_id && data.combo_id) {
            throw new exceptions_1.BadRequestException('Cannot provide both product_id and combo_id');
        }
        // Verify product or combo exists
        if (data.product_id) {
            const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
            if (!product) {
                throw new exceptions_1.NotFoundException('Product not found');
            }
            await this.db.run('INSERT INTO scheduled_offers (product_id, special_price, start_datetime, end_datetime) VALUES (?, ?, ?, ?)', [data.product_id, data.special_price, data.start_datetime, data.end_datetime]);
            const id = await this.db.getLastInsertRowId();
            return {
                id: id,
                product_id: data.product_id,
                combo_id: null,
                special_price: data.special_price,
                start_datetime: data.start_datetime,
                end_datetime: data.end_datetime,
                is_active: 1,
                created_at: new Date().toISOString(),
                product_name: product.name,
            };
        }
        else {
            const combo = await this.getCombo(data.combo_id);
            await this.db.run('INSERT INTO scheduled_offers (combo_id, special_price, start_datetime, end_datetime) VALUES (?, ?, ?, ?)', [data.combo_id, data.special_price, data.start_datetime, data.end_datetime]);
            const id = await this.db.getLastInsertRowId();
            return {
                id: id,
                product_id: null,
                combo_id: data.combo_id,
                special_price: data.special_price,
                start_datetime: data.start_datetime,
                end_datetime: data.end_datetime,
                is_active: 1,
                created_at: new Date().toISOString(),
                combo_name: combo.combo_name,
            };
        }
    }
    async getAllScheduledOffers() {
        const rows = await this.db.all(`SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       ORDER BY s.start_datetime DESC`);
        return rows || [];
    }
    async getActiveScheduledOffers() {
        const now = new Date().toISOString();
        const rows = await this.db.all(`SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       WHERE s.is_active = 1 
       AND s.start_datetime <= ?
       AND s.end_datetime >= ?`, [now, now]);
        return rows || [];
    }
    async getScheduledOffer(id) {
        const row = await this.db.get(`SELECT s.*, 
       i.name as product_name,
       c.combo_name
       FROM scheduled_offers s
       LEFT JOIN items i ON s.product_id = i.id
       LEFT JOIN combos c ON s.combo_id = c.id
       WHERE s.id = ?`, [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Scheduled offer not found');
        }
        return row;
    }
    async updateScheduledOffer(id, data) {
        await this.getScheduledOffer(id);
        const updates = [];
        const values = [];
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
        await this.db.run(`UPDATE scheduled_offers SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.getScheduledOffer(id);
    }
    async deleteScheduledOffer(id) {
        await this.getScheduledOffer(id);
        await this.db.run('DELETE FROM scheduled_offers WHERE id = ?', [id]);
    }
    // ========== Featured Items ==========
    async setFeatured(product_id, featured) {
        // Check if product exists
        const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [product_id]);
        if (!product) {
            throw new exceptions_1.NotFoundException('Product not found');
        }
        if (featured) {
            // Insert or replace
            await this.db.run('INSERT OR REPLACE INTO featured_items (product_id, featured) VALUES (?, ?)', [product_id, 1]);
            const id = await this.db.getLastInsertRowId();
            return {
                id: id || product_id, // SQLite may return 0 for REPLACE
                product_id,
                featured: 1,
                created_at: new Date().toISOString(),
                product_name: product.name,
            };
        }
        else {
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
    async getAllFeaturedItems() {
        const rows = await this.db.all(`SELECT f.*, i.name as product_name 
       FROM featured_items f 
       INNER JOIN items i ON f.product_id = i.id 
       WHERE f.featured = 1
       ORDER BY f.created_at DESC`);
        return rows || [];
    }
    async isFeatured(product_id) {
        const row = await this.db.get('SELECT COUNT(*) as count FROM featured_items WHERE product_id = ? AND featured = 1', [product_id]);
        return row?.count > 0;
    }
    // ========== Happy Hour ==========
    async createHappyHour(data) {
        // Check if product exists
        const product = await this.db.get('SELECT id, name FROM items WHERE id = ?', [data.product_id]);
        if (!product) {
            throw new exceptions_1.NotFoundException('Product not found');
        }
        await this.db.run('INSERT INTO happy_hour (product_id, happy_hour_price, time_start, time_end) VALUES (?, ?, ?, ?)', [data.product_id, data.happy_hour_price, data.time_start, data.time_end]);
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
        };
    }
    async getAllHappyHours() {
        const rows = await this.db.all(`SELECT h.*, i.name as product_name 
       FROM happy_hour h 
       INNER JOIN items i ON h.product_id = i.id 
       ORDER BY h.created_at DESC`);
        return rows || [];
    }
    async getHappyHour(id) {
        const row = await this.db.get(`SELECT h.*, i.name as product_name 
       FROM happy_hour h 
       INNER JOIN items i ON h.product_id = i.id 
       WHERE h.id = ?`, [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Happy hour not found');
        }
        return row;
    }
    async updateHappyHour(id, data) {
        await this.getHappyHour(id);
        const updates = [];
        const values = [];
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
        if (updates.length === 0) {
            return this.getHappyHour(id);
        }
        values.push(id);
        await this.db.run(`UPDATE happy_hour SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.getHappyHour(id);
    }
    async deleteHappyHour(id) {
        await this.getHappyHour(id);
        await this.db.run('DELETE FROM happy_hour WHERE id = ?', [id]);
    }
    async getActiveHappyHourPrice(product_id) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const row = await this.db.get(`SELECT happy_hour_price 
       FROM happy_hour 
       WHERE product_id = ? 
       AND is_active = 1 
       AND time_start <= ? 
       AND time_end >= ?`, [product_id, currentTime, currentTime]);
        return row?.happy_hour_price || null;
    }
    // ========== Helper: Get effective price for a product ==========
    async getEffectivePrice(product_id) {
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
    async enrichItemsWithOffers(items) {
        // Batch fetch all offers for efficiency
        const [dailyDeal, activeScheduledOffers, featuredItems, activeHappyHours] = await Promise.all([
            this.getActiveDailyDeal(),
            this.getActiveScheduledOffers(),
            this.getAllFeaturedItems(),
            this.getAllHappyHours().then(hh => hh.filter(h => h.is_active === 1)),
        ]);
        const featuredSet = new Set(featuredItems.map(fi => fi.product_id));
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return items.map((item) => {
            let effectivePrice = null;
            const originalPrice = item.price;
            // Priority 1: Daily Deal
            if (dailyDeal && dailyDeal.product_id === item.id) {
                effectivePrice = dailyDeal.special_price;
            }
            else {
                // Priority 2: Scheduled Offer
                const scheduledOffer = activeScheduledOffers.find((so) => so.product_id === item.id);
                if (scheduledOffer) {
                    effectivePrice = scheduledOffer.special_price;
                }
                else {
                    // Priority 3: Happy Hour
                    const happyHour = activeHappyHours.find((hh) => {
                        if (hh.product_id !== item.id)
                            return false;
                        return hh.time_start <= currentTime && hh.time_end >= currentTime;
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
exports.OffersService = OffersService;
