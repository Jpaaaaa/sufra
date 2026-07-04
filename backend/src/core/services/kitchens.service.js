"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchensService = void 0;
const exceptions_1 = require("../utils/exceptions");
class KitchensService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        const rows = await this.db.all('SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens ORDER BY name ASC');
        return rows;
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Kitchen not found');
        }
        return row;
    }
    async create(data) {
        await this.db.run('INSERT INTO kitchens (name, description, floor_id) VALUES (?, ?, ?)', [data.name, data.description ?? null, data.floor_id ?? null]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?', [id]);
        return row;
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = {
            ...existing,
            ...data,
        };
        await this.db.run('UPDATE kitchens SET name = ?, description = ?, floor_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [merged.name, merged.description ?? null, merged.floor_id ?? null, merged.is_active, id]);
        const row = await this.db.get('SELECT id, name, description, floor_id, is_active, created_at, updated_at FROM kitchens WHERE id = ?', [id]);
        return row;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM kitchens WHERE id = ?', [id]);
    }
    async getItemsServiceTypes(itemId) {
        // Get distinct service types used for this item in recent orders
        const rows = await this.db.all(`SELECT DISTINCT service_type 
       FROM order_items 
       WHERE item_id = ? AND service_type IS NOT NULL
       ORDER BY service_type`, [itemId]);
        const serviceTypes = [];
        for (const row of rows) {
            if (row.service_type === 'dine-in' || row.service_type === 'pickup') {
                serviceTypes.push(row.service_type);
            }
        }
        // If no service types found in orders, default to dine-in (most common)
        return serviceTypes.length > 0 ? serviceTypes : ['dine-in'];
    }
}
exports.KitchensService = KitchensService;
