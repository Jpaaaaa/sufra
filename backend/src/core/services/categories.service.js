"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const exceptions_1 = require("../utils/exceptions");
class CategoriesService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        const rows = await this.db.all('SELECT id, name FROM categories');
        return rows;
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name FROM categories WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Category not found');
        }
        return row;
    }
    async create(data) {
        await this.db.run('INSERT INTO categories (name) VALUES (?)', [data.name]);
        const id = await this.db.getLastInsertRowId();
        return { id, ...data };
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = { ...existing, ...data };
        await this.db.run('UPDATE categories SET name = ? WHERE id = ?', [merged.name, id]);
        return merged;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}
exports.CategoriesService = CategoriesService;
