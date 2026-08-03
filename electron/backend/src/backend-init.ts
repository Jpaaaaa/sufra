import { DatabaseService } from './database/database.service';
import { initializeUsers } from './modules/users/users.service';
import { initializeAuth } from './modules/auth/auth.service';
import { initializeItems } from './modules/items/items.service';
import { initializeItemOptions } from './modules/items/item-options.service';
import { initializeUpload } from './modules/items/upload.service';
import { initializeCategories } from './modules/categories/categories.service';
import { initializeFloors } from './modules/floors/floors.service';
import { initializeHalls } from './modules/halls/halls.service';
import { initializeTables } from './modules/tables/tables.service';
import { initializeKitchens } from './modules/kitchens/kitchens.service';
import { initializeShelves } from './modules/shelves/shelves.service';
import { initializeOrdersCluster } from './modules/orders/orders-bootstrap';
import { initializePrinters } from './modules/printers/printers.service';
import { initializeReports } from './modules/reports/reports.service';
import { initializeFinance } from './modules/finance/finance.service';
import { initializeHealth } from './modules/health/health.service';
import { initializeBusinessDay } from './modules/business-day/business-day.service';
import { initializeOffers } from './modules/offers/offers.service';
import { initializeShifts } from './modules/shifts/shifts.service';
import { initializeSettings } from './modules/settings/settings.service';
import { initializeShiftDefinitions } from './modules/settings/shift-definitions.service';

/** Wire all domain services after database is ready. */
export function initializeAllServices(db: DatabaseService): void {
  initializeUsers(db);
  initializeAuth();
  initializeItems(db);
  initializeItemOptions(db);
  initializeUpload();
  initializeCategories(db);
  initializeFloors(db);
  initializeHalls(db);
  initializeTables(db);
  initializeKitchens(db);
  initializeSettings(db);
  initializeShiftDefinitions(db);
  initializeShelves(db);
  initializeOrdersCluster(db);
  initializePrinters(db);
  initializeReports(db);
  initializeFinance(db);
  initializeHealth(db);
  initializeBusinessDay(db);
  initializeOffers(db);
  initializeShifts(db);
}
