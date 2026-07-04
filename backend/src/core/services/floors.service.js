"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloorsService = void 0;
const exceptions_1 = require("../utils/exceptions");
class FloorsService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        const rows = await this.db.all('SELECT id, name, floor_number, created_at, updated_at FROM floors ORDER BY floor_number');
        return rows;
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Floor not found');
        }
        return row;
    }
    async create(data) {
        await this.db.run('INSERT INTO floors (name, floor_number) VALUES (?, ?)', [data.name, data.floor_number]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created floor');
        }
        return row;
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = {
            ...existing,
            ...data,
        };
        await this.db.run('UPDATE floors SET name = ?, floor_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [merged.name, merged.floor_number, id]);
        const row = await this.db.get('SELECT id, name, floor_number, created_at, updated_at FROM floors WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Floor not found after update');
        }
        return row;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM floors WHERE id = ?', [id]);
    }
}
exports.FloorsService = FloorsService;
