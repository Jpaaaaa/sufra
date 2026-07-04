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
exports.AuthService = void 0;
const exceptions_1 = require("../utils/exceptions");
const jwt = __importStar(require("jsonwebtoken"));
class AuthService {
    constructor(usersService) {
        this.usersService = usersService;
        this.jwtSecret = process.env.JWT_SECRET || 'sufra-lite-secret-key-change-in-production';
        this.jwtExpiresIn = '24h';
    }
    async login(username, password) {
        const user = await this.usersService.findByUsername(username);
        if (!user) {
            throw new exceptions_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await this.usersService.validatePassword(user, password);
        if (!isPasswordValid) {
            throw new exceptions_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { sub: user.id, username: user.username, role: user.role };
        return {
            access_token: jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn }),
        };
    }
    async getMe(userId) {
        const user = await this.usersService.findOne(userId);
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            // Only return permissions for customer role
            require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
            customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
        };
    }
    async verifyPassword(userId, password) {
        const user = await this.usersService.findByUsername((await this.usersService.findOne(userId)).username);
        if (!user) {
            return { valid: false };
        }
        // Only customer (captain), manager, or admin can verify password for printing
        if (!['customer', 'manager', 'admin'].includes(user.role)) {
            return { valid: false };
        }
        const isValid = await this.usersService.validatePassword(user, password);
        return { valid: isValid };
    }
}
exports.AuthService = AuthService;
