"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HallsService = void 0;
const exceptions_1 = require("../utils/exceptions");
class HallsService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        const rows = await this.db.all('SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls');
        return rows;
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Hall not found');
        }
        return row;
    }
    async create(data) {
        await this.db.run('INSERT INTO halls (name, hall_number, floor_id) VALUES (?, ?, ?)', [data.name, data.hall_number, data.floor_id ?? null]);
        const id = await this.db.getLastInsertRowId();
        const row = await this.db.get('SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created hall');
        }
        return row;
    }
    async update(id, data) {
        const existing = await this.findOne(id);
        const merged = {
            ...existing,
            ...data,
        };
        await this.db.run('UPDATE halls SET name = ?, hall_number = ?, floor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [merged.name, merged.hall_number, merged.floor_id ?? null, id]);
        const row = await this.db.get('SELECT id, name, hall_number, floor_id, created_at, updated_at FROM halls WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('Hall not found after update');
        }
        return row;
    }
    async remove(id) {
        await this.findOne(id);
        await this.db.run('DELETE FROM halls WHERE id = ?', [id]);
    }
}
exports.HallsService = HallsService;
