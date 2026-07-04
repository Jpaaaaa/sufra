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
exports.BusinessDayService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const app_data_path_1 = require("../../utils/app-data-path");
class BusinessDayService {
    constructor(db) {
        this.db = db;
        // Use Electron's userData directory in production, or local data in dev
        this.reportsHistoryDir = (0, app_data_path_1.getAppDataPath)('reports-history');
        // Ensure directory exists
        (0, app_data_path_1.ensureDirectoryExists)(this.reportsHistoryDir);
        console.log('[BUSINESS-DAY] Reports history directory:', this.reportsHistoryDir);
    }
    async getCurrentBusinessDay() {
        const row = await this.db.get('SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE is_active = 1 ORDER BY start_at DESC LIMIT 1');
        if (!row) {
            return null;
        }
        return {
            id: row.id,
            start_at: row.start_at,
            end_at: row.end_at,
            is_active: Boolean(row.is_active),
            created_at: row.created_at,
        };
    }
    async getBusinessDayStartTime() {
        const businessDay = await this.getCurrentBusinessDay();
        return businessDay ? businessDay.start_at : null;
    }
    async startNewBusinessDay(username) {
        // Get current business day before ending it
        const currentDay = await this.getCurrentBusinessDay();
        if (!currentDay) {
            // No current day, just create a new one
            return await this.createNewBusinessDay();
        }
        // Calculate and save daily summary before ending the day
        try {
            const summary = await this.calculateDailySummary(currentDay.start_at);
            const resetTimestamp = new Date().toISOString();
            // Write summary to TXT file
            await this.writeDailySummaryToFile(summary, username || 'Unknown', resetTimestamp);
            // Store summary in database (optional - can be used for future features)
            // This is already done via the business_days table end_at timestamp
        }
        catch (summaryError) {
            console.error('Failed to calculate/save daily summary:', summaryError);
            // Continue with reset even if summary fails
        }
        // End the current active day
        await this.db.run("UPDATE business_days SET end_at = datetime('now'), is_active = 0 WHERE is_active = 1");
        // Then create a new active business day
        return await this.createNewBusinessDay();
    }
    async createNewBusinessDay() {
        await this.db.run("INSERT INTO business_days (start_at, is_active) VALUES (datetime('now'), 1)");
        const id = await this.db.getLastInsertRowId();
        // Return the newly created day
        const row = await this.db.get('SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE id = ?', [id]);
        if (!row) {
            throw new Error('Failed to retrieve created business day');
        }
        return {
            id: row.id,
            start_at: row.start_at,
            end_at: row.end_at,
            is_active: Boolean(row.is_active),
            created_at: row.created_at,
        };
    }
    async calculateDailySummary(businessDayStart) {
        const businessDayEnd = new Date().toISOString();
        // Get all completed orders for the current business day
        const orders = await this.db.all(`SELECT id, total, discount, globalDiscount, created_at 
       FROM orders 
       WHERE created_at >= ? AND created_at < ? AND status = 'completed'`, [businessDayStart, businessDayEnd]);
        let totalSales = 0;
        let totalDiscounts = 0;
        let numberOfOrders = orders.length;
        orders.forEach((order) => {
            // Calculate discount amount
            let discountAmount = 0;
            // Handle globalDiscount (stored as JSON string)
            if (order.globalDiscount) {
                try {
                    const globalDiscount = typeof order.globalDiscount === 'string'
                        ? JSON.parse(order.globalDiscount)
                        : order.globalDiscount;
                    if (globalDiscount && globalDiscount.amount) {
                        discountAmount += globalDiscount.amount;
                    }
                }
                catch (e) {
                    // Invalid JSON, skip
                }
            }
            // Also check the discount column (legacy)
            if (order.discount) {
                discountAmount += order.discount;
            }
            // Total before discount (assuming order.total is the final amount after discount)
            // We need to add back the discount to get the original amount
            const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
            totalSales += orderTotalBeforeDiscount;
            totalDiscounts += discountAmount;
        });
        const averageOrderValue = numberOfOrders > 0
            ? Math.round(totalSales / numberOfOrders)
            : 0;
        const netProfit = totalSales - totalDiscounts;
        return {
            totalSales,
            totalDiscounts,
            netProfit,
            numberOfOrders,
            averageOrderValue,
            businessDayStart,
            businessDayEnd,
        };
    }
    async writeDailySummaryToFile(summary, username, timestamp) {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const filename = `daily-summary-${dateStr}.txt`;
        const filepath = path.join(this.reportsHistoryDir, filename);
        const content = `
=== تقرير يومي ===
التاريخ: ${dateStr}
المستخدم: ${username}
وقت الإغلاق: ${timestamp}

=== الملخص ===
إجمالي المبيعات: ${summary.totalSales.toLocaleString('ar-IQ')} د.ع
إجمالي الخصومات: ${summary.totalDiscounts.toLocaleString('ar-IQ')} د.ع
صافي الربح: ${summary.netProfit.toLocaleString('ar-IQ')} د.ع
عدد الطلبات: ${summary.numberOfOrders}
متوسط قيمة الطلب: ${summary.averageOrderValue.toLocaleString('ar-IQ')} د.ع

وقت بداية اليوم: ${summary.businessDayStart}
وقت نهاية اليوم: ${summary.businessDayEnd}
`;
        fs.writeFileSync(filepath, content, 'utf-8');
    }
}
exports.BusinessDayService = BusinessDayService;
