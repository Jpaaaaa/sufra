"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsService = void 0;
const exceptions_1 = require("../utils/exceptions");
class ItemsService {
    constructor(db) {
        this.db = db;
    }
    async findAll(kitchen_id) {
        let query = 'SELECT id, name, price, categoryId, kitchen_id, image_url, COALESCE(is_out_of_stock, 0) as is_out_of_stock FROM items';
        const params = [];
        if (kitchen_id !== undefined) {
            query += ' WHERE kitchen_id = ?';
            params.push(kitchen_id);
        }
        const rows = await this.db.all(query, params);
        return rows.map((row) => ({
            ...row,
            is_out_of_stock: Boolean(row.is_out_of_stock),
        }));
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name, price, categoryId, kitchen_id, image_url, COALESCE(is_out_of_stock, 0) as is_out_of_stock FROM items WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Item not found');
        }
        return {
            ...row,
            is_out_of_stock: Boolean(row.is_out_of_stock),
        };
    }
    async create(data) {
        await this.db.run('INSERT INTO items (name, price, categoryId, kitchen_id, image_url, is_out_of_stock) VALUES (?, ?, ?, ?, ?, ?)', [
            data.name,
            data.price,
            data.categoryId ?? null,
            data.kitchen_id ?? null,
            data.image_url ?? null,
            data.is_out_of_stock ? 1 : 0,
        ]);
        const id = await this.db.getLastInsertRowId();
        return { id, ...data };
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = { ...existing, ...data };
        await this.db.run('UPDATE items SET name = ?, price = ?, categoryId = ?, kitchen_id = ?, image_url = ?, is_out_of_stock = ? WHERE id = ?', [
            merged.name,
            merged.price,
            merged.categoryId ?? null,
            merged.kitchen_id ?? null,
            merged.image_url ?? null,
            merged.is_out_of_stock ? 1 : 0,
            id,
        ]);
        return merged;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM items WHERE id = ?', [id]);
    }
}
exports.ItemsService = ItemsService;
