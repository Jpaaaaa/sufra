/**
 * Single entry for production ncc bundle.
 * Exports all backend surfaces used by electron/init/backend-loader.ts.
 */
import { initializeBackend, shutdownBackend } from './main';
import { generateReportTemplate } from './modules/reports/generate-report-template';
import { getHealth } from './modules/health/health.service';
import * as usersService from './modules/users/users.service';
import * as authService from './modules/auth/auth.service';
import * as itemsService from './modules/items/items.service';
import * as uploadService from './modules/items/upload.service';
import * as categoriesService from './modules/categories/categories.service';
import * as ordersService from './modules/orders/orders.service';
import * as dineInOrdersService from './modules/orders/dine-in-orders.service';
import * as pickupOrdersService from './modules/orders/pickup-orders.service';
import * as deliveryOrdersService from './modules/orders/delivery-orders.service';
import * as deliveryPlatformsService from './modules/orders/delivery-platforms.service';
import * as tablesService from './modules/tables/tables.service';
import * as hallsService from './modules/halls/halls.service';
import * as floorsService from './modules/floors/floors.service';
import * as kitchensService from './modules/kitchens/kitchens.service';
import * as printersService from './modules/printers/printers.service';
import * as offersService from './modules/offers/offers.service';
import * as reportsService from './modules/reports/reports.service';
import * as shelvesService from './modules/shelves/shelves.service';
import * as shiftsService from './modules/shifts/shifts.service';
import * as financeService from './modules/finance/finance.service';
import * as businessDayService from './modules/business-day/business-day.service';
import * as settingsService from './modules/settings/settings.service';
import * as shiftDefinitionsService from './modules/settings/shift-definitions.service';

export const packagedBackend = {
  initializeBackend,
  shutdownBackend,
  generateReportTemplate,
  getHealth,
  usersService,
  authService,
  itemsService,
  uploadService,
  categoriesService,
  ordersService,
  dineInOrdersService,
  pickupOrdersService,
  deliveryOrdersService,
  deliveryPlatformsService,
  tablesService,
  hallsService,
  floorsService,
  kitchensService,
  printersService,
  offersService,
  reportsService,
  shelvesService,
  shiftsService,
  financeService,
  businessDayService,
  settingsService,
  shiftDefinitionsService,
};
