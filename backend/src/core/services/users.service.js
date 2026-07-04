"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const exceptions_1 = require("../utils/exceptions");
const bcrypt = __importStar(require("bcrypt"));
class UsersService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        const rows = await this.db.all('SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users ORDER BY created_at DESC');
        return rows.map((row) => ({
            ...row,
            // Only return permissions for customer role
            require_captain_approval: row.role === 'customer' ? Boolean(row.require_captain_approval) : false,
            customer_free_order: row.role === 'customer' ? Boolean(row.customer_free_order) : false,
        }));
    }
    async findOne(id) {
        const row = await this.db.get('SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('User not found');
        }
        return {
            ...row,
            // Only return permissions for customer role
            require_captain_approval: row.role === 'customer' ? Boolean(row.require_captain_approval) : false,
            customer_free_order: row.role === 'customer' ? Boolean(row.customer_free_order) : false,
        };
    }
    async findByUsername(username) {
        const row = await this.db.get('SELECT id, username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE username = ?', [username]);
        if (!row) {
            return null;
        }
        return {
            ...row,
            require_captain_approval: Boolean(row.require_captain_approval),
            customer_free_order: Boolean(row.customer_free_order),
        };
    }
    async create(dto) {
        // Check if username already exists
        const existing = await this.findByUsername(dto.username);
        if (existing) {
            throw new exceptions_1.ConflictException('Username already exists');
        }
        // Hash password
        const password_hash = await bcrypt.hash(dto.password, 10);
        // Only apply permissions for customer role
        const isCustomer = dto.role === 'customer';
        const require_captain_approval = isCustomer && dto.customer_free_order ? 0 : (isCustomer && dto.require_captain_approval ? 1 : 0);
        const customer_free_order = isCustomer && dto.customer_free_order ? 1 : 0;
        await this.db.run('INSERT INTO users (username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))', [dto.username, password_hash, dto.role, require_captain_approval, customer_free_order]);
        // Fetch by username to avoid relying on last_insert_rowid() in sql.js
        const row = await this.db.get('SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE username = ? ORDER BY id DESC LIMIT 1', [dto.username]);
        if (!row) {
            throw new Error('Failed to retrieve created user');
        }
        return {
            ...row,
            require_captain_approval: Boolean(row.require_captain_approval),
            customer_free_order: Boolean(row.customer_free_order),
        };
    }
    async update(id, dto) {
        const existing = await this.findOne(id);
        // Check if username is being changed and if it already exists
        if (dto.username && dto.username !== existing.username) {
            const usernameExists = await this.findByUsername(dto.username);
            if (usernameExists) {
                throw new exceptions_1.ConflictException('Username already exists');
            }
        }
        const updates = [];
        const values = [];
        if (dto.username) {
            updates.push('username = ?');
            values.push(dto.username);
        }
        if (dto.password) {
            const password_hash = await bcrypt.hash(dto.password, 10);
            updates.push('password_hash = ?');
            values.push(password_hash);
        }
        if (dto.role) {
            updates.push('role = ?');
            values.push(dto.role);
        }
        // Handle permissions with logic: customer_free_order overrides require_captain_approval
        // Only apply permissions for customer role
        const newRole = dto.role || existing.role;
        const isCustomer = newRole === 'customer';
        // Always update permissions based on final role
        if (isCustomer) {
            // If role is customer, allow setting permissions
            const currentRequire = dto.require_captain_approval !== undefined
                ? dto.require_captain_approval
                : (existing.role === 'customer' ? existing.require_captain_approval : false);
            const currentFree = dto.customer_free_order !== undefined
                ? dto.customer_free_order
                : (existing.role === 'customer' ? existing.customer_free_order : false);
            // Apply logic: customer_free_order overrides require_captain_approval
            const finalRequire = currentFree ? false : currentRequire;
            const finalFree = currentFree;
            updates.push('require_captain_approval = ?');
            values.push(finalRequire ? 1 : 0);
            updates.push('customer_free_order = ?');
            values.push(finalFree ? 1 : 0);
        }
        else {
            // If role is not customer, always clear permissions
            updates.push('require_captain_approval = ?');
            values.push(0);
            updates.push('customer_free_order = ?');
            values.push(0);
        }
        if (updates.length === 0) {
            return existing;
        }
        updates.push('updated_at = datetime("now")');
        values.push(id);
        await this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        const row = await this.db.get('SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE id = ?', [id]);
        if (!row) {
            throw new exceptions_1.NotFoundException('User not found after update');
        }
        return {
            ...row,
            require_captain_approval: Boolean(row.require_captain_approval),
            customer_free_order: Boolean(row.customer_free_order),
        };
    }
    async remove(id) {
        await this.findOne(id); // Check if exists
        await this.db.run('DELETE FROM users WHERE id = ?', [id]);
    }
    async validatePassword(user, password) {
        return bcrypt.compare(password, user.password_hash);
    }
}
exports.UsersService = UsersService;
