/**
 * IPC handlers - orchestrates all domain-specific handler modules.
 */
import { patchIpcMainHandleForActivityLogging } from '../patch-ipc-activity-log';
import { registerAuthHandlers } from './auth';
import { registerCatalogHandlers } from './catalog';
import { registerOrdersHandlers } from './orders';
import { registerVenueHandlers } from './venue';
import { registerPrintHandlers } from './print';
import { registerOffersHandlers } from './offers';
import { registerShelvesHandlers } from './shelves';
import { registerShiftsHandlers } from './shifts';
import { registerFinanceHandlers } from './finance';
import { registerSupportHandlers } from './support';

export function setupIpcHandlers() {
  console.log('[IPC] Setting up IPC handlers...');
  patchIpcMainHandleForActivityLogging();
  registerAuthHandlers();
  registerCatalogHandlers();
  registerOrdersHandlers();
  registerVenueHandlers();
  registerPrintHandlers();
  registerOffersHandlers();
  registerShelvesHandlers();
  registerShiftsHandlers();
  registerFinanceHandlers();
  registerSupportHandlers();
  console.log('[IPC] ✓ IPC handlers registered');
}
