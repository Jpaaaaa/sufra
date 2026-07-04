"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("./database/database.module");
const items_module_1 = require("./modules/items/items.module");
const categories_module_1 = require("./modules/categories/categories.module");
const floors_module_1 = require("./modules/floors/floors.module");
const halls_module_1 = require("./modules/halls/halls.module");
const tables_module_1 = require("./modules/tables/tables.module");
const kitchens_module_1 = require("./modules/kitchens/kitchens.module");
const orders_module_1 = require("./modules/orders/orders.module");
const printers_module_1 = require("./modules/printers/printers.module");
const reports_module_1 = require("./modules/reports/reports.module");
const finance_module_1 = require("./modules/finance/finance.module");
const health_module_1 = require("./modules/health/health.module");
const users_module_1 = require("./modules/users/users.module");
const auth_module_1 = require("./modules/auth/auth.module");
const business_day_module_1 = require("./modules/business-day/business-day.module");
const admin_module_1 = require("./modules/admin/admin.module");
const shelves_module_1 = require("./modules/shelves/shelves.module");
const print_module_1 = require("./modules/print/print.module");
const offers_module_1 = require("./modules/offers/offers.module");
const shifts_module_1 = require("./modules/shifts/shifts.module");
let AppModule = (() => {
    let _classDecorators = [(0, common_1.Module)({
            imports: [
                database_module_1.DatabaseModule,
                auth_module_1.AuthModule,
                users_module_1.UsersModule,
                items_module_1.ItemsModule,
                categories_module_1.CategoriesModule,
                floors_module_1.FloorsModule,
                halls_module_1.HallsModule,
                tables_module_1.TablesModule,
                kitchens_module_1.KitchensModule,
                orders_module_1.OrdersModule,
                printers_module_1.PrintersModule,
                print_module_1.PrintModule,
                reports_module_1.ReportsModule,
                finance_module_1.FinanceModule,
                health_module_1.HealthModule,
                business_day_module_1.BusinessDayModule,
                admin_module_1.AdminModule,
                shelves_module_1.ShelvesModule,
                offers_module_1.OffersModule,
                shifts_module_1.ShiftsModule,
            ],
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AppModule = _classThis = class {
    };
    __setFunctionName(_classThis, "AppModule");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
})();
exports.AppModule = AppModule;
