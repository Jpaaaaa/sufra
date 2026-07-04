import { app, dialog } from 'electron';
import { requireBackendModule } from '../utils/backend-loader';
import { getBackendApp, setBackendApp } from '../state';

export let generateReportTemplate: (...args: any[]) => any;
export let initializeBackend: (userDataPath?: string) => Promise<any>;
export let HealthController: new (...args: any[]) => any;
export let UsersService: new (...args: any[]) => any;
export let AuthService: new (...args: any[]) => any;
export let ItemsService: new (...args: any[]) => any;
export let UploadService: new (...args: any[]) => any;
export let CategoriesService: new (...args: any[]) => any;
export let OrdersService: new (...args: any[]) => any;
export let DineInOrdersService: new (...args: any[]) => any;
export let TablesService: new (...args: any[]) => any;
export let HallsService: new (...args: any[]) => any;
export let FloorsService: new (...args: any[]) => any;
export let KitchensService: new (...args: any[]) => any;
export let PrintersService: new (...args: any[]) => any;
export let OffersService: new (...args: any[]) => any;
export let ReportsService: new (...args: any[]) => any;
export let ShelvesService: new (...args: any[]) => any;
export let ShiftsService: new (...args: any[]) => any;
export let FinanceService: new (...args: any[]) => any;
export let BusinessDayService: new (...args: any[]) => any;
export let PickupOrdersService: new (...args: any[]) => any;
export let DeliveryOrdersService: new (...args: any[]) => any;
export let DeliveryPlatformsService: new (...args: any[]) => any;

export function loadBackendModules(): void {
  try {
    console.log('[MAIN] Loading backend modules dynamically...');
    generateReportTemplate = requireBackendModule('modules/reports/generate-report-template').generateReportTemplate;
    initializeBackend = requireBackendModule('main').initializeBackend;
    HealthController = requireBackendModule('modules/health/health.controller').HealthController;
    UsersService = requireBackendModule('modules/users/users.service').UsersService;
    AuthService = requireBackendModule('modules/auth/auth.service').AuthService;
    ItemsService = requireBackendModule('modules/items/items.service').ItemsService;
    UploadService = requireBackendModule('modules/items/upload.service').UploadService;
    CategoriesService = requireBackendModule('modules/categories/categories.service').CategoriesService;
    OrdersService = requireBackendModule('modules/orders/orders.service').OrdersService;
    DineInOrdersService = requireBackendModule('modules/orders/dine-in-orders.service').DineInOrdersService;
    PickupOrdersService = requireBackendModule('modules/orders/pickup-orders.service').PickupOrdersService;
    DeliveryOrdersService = requireBackendModule('modules/orders/delivery-orders.service').DeliveryOrdersService;
    DeliveryPlatformsService = requireBackendModule('modules/orders/delivery-platforms.service').DeliveryPlatformsService;
    TablesService = requireBackendModule('modules/tables/tables.service').TablesService;
    HallsService = requireBackendModule('modules/halls/halls.service').HallsService;
    FloorsService = requireBackendModule('modules/floors/floors.service').FloorsService;
    KitchensService = requireBackendModule('modules/kitchens/kitchens.service').KitchensService;
    PrintersService = requireBackendModule('modules/printers/printers.service').PrintersService;
    OffersService = requireBackendModule('modules/offers/offers.service').OffersService;
    ReportsService = requireBackendModule('modules/reports/reports.service').ReportsService;
    ShelvesService = requireBackendModule('modules/shelves/shelves.service').ShelvesService;
    ShiftsService = requireBackendModule('modules/shifts/shifts.service').ShiftsService;
    FinanceService = requireBackendModule('modules/finance/finance.service').FinanceService;
    BusinessDayService = requireBackendModule('modules/business-day/business-day.service').BusinessDayService;
    console.log('[MAIN] ✓ Backend modules loaded successfully');
  } catch (error: any) {
    console.error('[MAIN] ✗ Failed to load backend modules:', error);
    throw error;
  }
}

export async function initializeBackendLibrary(): Promise<boolean> {
  console.log('[BACKEND] Initializing backend as library...');

  try {
    const userDataPath = app.getPath('userData');
    console.log('[BACKEND] User data path:', userDataPath);

    console.log('[BACKEND] Calling initializeBackend()...');
    const backendAppInstance = await initializeBackend(userDataPath);
    console.log('[BACKEND] initializeBackend() completed');

    if (!backendAppInstance) {
      throw new Error('initializeBackend() returned null or undefined');
    }

    setBackendApp(backendAppInstance);
    console.log('[BACKEND] ✓ Backend initialized as library');
    return true;
  } catch (error: any) {
    console.error('[BACKEND] ✗✗✗ FAILED TO INITIALIZE BACKEND ✗✗✗');
    console.error('[BACKEND] Error:', error);
    console.error('[BACKEND] Message:', error?.message);

    const errorDetails = [
      `Error: ${error?.message || String(error)}`,
      `Type: ${error?.constructor?.name || 'Unknown'}`,
      '',
      'Check logs at:',
      app.getPath('userData'),
      '',
      'Full error:',
      error?.stack || String(error),
    ].join('\n');

    try {
      dialog.showErrorBox('Backend Initialization Failed', errorDetails);
    } catch (e) {
      console.error('[BACKEND] Failed to show error dialog:', e);
    }

    return false;
  }
}

export function getService<T = any>(serviceClass: new (...args: any[]) => T): T {
  const backendAppInstance = getBackendApp();
  if (!backendAppInstance) {
    throw new Error('Backend not initialized. Call initializeBackendLibrary() first.');
  }
  return backendAppInstance.get(serviceClass);
}
