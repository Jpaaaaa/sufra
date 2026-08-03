import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type IpcActorPayload = { __sufraActor: true; id: number; username: string; role: string };

function readActor(): IpcActorPayload | undefined {
  try {
    const s = localStorage.getItem('sufra_auth_user');
    if (!s) return undefined;
    const u = JSON.parse(s) as { id?: number; username?: string; role?: string };
    if (u == null || typeof u.id !== 'number') return undefined;
    return {
      __sufraActor: true,
      id: u.id,
      username: String(u.username ?? ''),
      role: String(u.role ?? ''),
    };
  } catch {
    return undefined;
  }
}

/** Appends current user as last arg for audit logging (main process strips it). */
function invoke(channel: string, ...args: unknown[]) {
  const a = args as any[];
  if (channel === 'auth:login') {
    return ipcRenderer.invoke(channel, ...a);
  }
  const actor = readActor();
  if (actor) {
    return ipcRenderer.invoke(channel, ...a, actor);
  }
  return ipcRenderer.invoke(channel, ...a);
}

contextBridge.exposeInMainWorld('sufra', {
  auth: {
    login: (username: string, password: string) =>
      invoke('auth:login', username, password),
    me: (userId: number) =>
      invoke('auth:me', userId),
    verifyToken: (token: string) =>
      invoke('auth:verifyToken', token),
    verifyPassword: (userId: number, password: string) =>
      invoke('auth:verifyPassword', userId, password),
  },
  print: {
    order: (orderData: any, kitchenId?: number | null) =>
      invoke('print:order', orderData, kitchenId),
    receipt: (receiptData: any) =>
      invoke('print:receipt', receiptData),
    getPrinters: () => invoke('print:getPrinters'),
  },
  printers: {
    getSettings: () => invoke('printers:getSettings'),
    saveSettings: (settings: { kitchen_id: number | null; printer_ip: string | null; printer_port?: number }) =>
      invoke('printers:saveSettings', settings),
    test: (settings: { printer_ip: string; printer_port?: number }) =>
      invoke('printers:test', settings),
    available: () => invoke('printers:available'),
    scan: () => invoke('printers:scan'),
  },
  recipePrint: {
    getSettings: () => invoke('recipePrint:getSettings'),
    saveSettings: (settings: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) =>
      invoke('recipePrint:saveSettings', settings),
    preview: (branding: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) =>
      invoke('recipePrint:preview', branding),
    print: (branding: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) =>
      invoke('recipePrint:print', branding),
  },
  support: {
    openAnyDesk: () => invoke('support:anydeskOpen'),
    openAnyDeskDownloadPage: () => invoke('support:anydeskDownloadPage'),
  },
  backup: {
    getSettings: () => invoke('backup:getSettings'),
    updateSettings: (settings: {
      enabled?: boolean;
      scheduleHour?: number;
      scheduleMinute?: number;
      retentionCount?: number;
    }) => invoke('backup:updateSettings', settings),
    runNow: () => invoke('backup:runNow'),
    list: () => invoke('backup:list'),
    getStatus: () => invoke('backup:getStatus'),
    restore: (backupId: string, accessToken: string) => invoke('backup:restore', backupId, accessToken),
  },
  halls: {
    findAll: () => invoke('halls:findAll'),
    findOne: (id: number) => invoke('halls:findOne', id),
    create: (data: any) => invoke('halls:create', data),
    update: (id: number, data: any) => invoke('halls:update', id, data),
    remove: (id: number) => invoke('halls:remove', id),
  },
  tables: {
    findAll: () => invoke('tables:findAll'),
    findByHall: (hallId: number) => invoke('tables:findByHall', hallId),
    findOne: (id: number) => invoke('tables:findOne', id),
    create: (data: any) => invoke('tables:create', data),
    update: (id: number, data: any) => invoke('tables:update', id, data),
    remove: (id: number) => invoke('tables:remove', id),
  },
  floors: {
    findAll: () => invoke('floors:findAll'),
    findOne: (id: number) => invoke('floors:findOne', id),
    create: (data: any) => invoke('floors:create', data),
    update: (id: number, data: any) => invoke('floors:update', id, data),
    remove: (id: number) => invoke('floors:remove', id),
  },
  kitchens: {
    findAll: () => invoke('kitchens:findAll'),
    findOne: (id: number) => invoke('kitchens:findOne', id),
    create: (data: any) => invoke('kitchens:create', data),
    update: (id: number, data: any) => invoke('kitchens:update', id, data),
    remove: (id: number) => invoke('kitchens:remove', id),
  },
  items: {
    findAll: (kitchen_id?: number) => invoke('items:findAll', kitchen_id),
    findOne: (id: number) => invoke('items:findOne', id),
    create: (data: any) => invoke('items:create', data),
    update: (id: number, data: any) => invoke('items:update', id, data),
    remove: (id: number) => invoke('items:remove', id),
    copyOptionsFromItem: (targetId: number, sourceId: number) =>
      invoke('items:copyOptionsFromItem', targetId, sourceId),
  },
  categories: {
    findAll: () => invoke('categories:findAll'),
    findOne: (id: number) => invoke('categories:findOne', id),
    create: (data: any) => invoke('categories:create', data),
    update: (id: number, data: any) => invoke('categories:update', id, data),
    remove: (id: number) => invoke('categories:remove', id),
    reorder: (ids: number[]) => invoke('categories:reorder', ids),
  },
  orders: {
    findActive: () => invoke('orders:findActive'),
    findByTable: (tableId: number) => invoke('orders:findByTable', tableId),
    findByHall: (hallId: number) => invoke('orders:findByHall', hallId),
    create: (data: any) => invoke('orders:create', data),
    createDineIn: (data: any) => invoke('orders:createDineIn', data),
    findActiveDineIn: () => invoke('orders:findActiveDineIn'),
    findArchivedDineIn: () => invoke('orders:findArchivedDineIn'),
    clearArchivedDineIn: () => invoke('orders:clearArchivedDineIn'),
    getById: (id: number) => invoke('orders:getById', id),
    findDineInByTable: (tableId: number) => invoke('orders:findDineInByTable', tableId),
    findDineInByHall: (hallId: number) => invoke('orders:findDineInByHall', hallId),
    update: (id: number, data: any) => invoke('orders:update', id, data),
    updateStatus: (id: number, status: string) => invoke('orders:updateStatus', id, status),
    updateDineInStatus: (id: number, status: string) => invoke('orders:updateDineInStatus', id, status),
    updateDineIn: (id: number, data: any) => invoke('orders:updateDineIn', id, data),
    setTableGlobalDiscount: (tableId: number, globalDiscount: { percent: number; amount: number } | null) =>
      invoke('orders:setTableGlobalDiscount', tableId, globalDiscount),
    moveTable: (sourceTableId: number, targetTableId: number) =>
      invoke('orders:moveTable', sourceTableId, targetTableId),
    moveOrders: (orderIds: number[], targetTableId: number) =>
      invoke('orders:moveOrders', orderIds, targetTableId),
    remove: (id: number) => invoke('orders:remove', id),
    // Pickup orders
    findActivePickup: () => invoke('orders:findActivePickup'),
    findArchivedPickup: () => invoke('orders:findArchivedPickup'),
    findPickupById: (id: number) => invoke('orders:findPickupById', id),
    createPickup: (data: any) => invoke('orders:createPickup', data),
    updatePickupStatus: (id: number, status: string) => invoke('orders:updatePickupStatus', id, status),
    updatePickup: (id: number, data: any) => invoke('orders:updatePickup', id, data),
    removePickup: (id: number) => invoke('orders:removePickup', id),
    clearArchivedPickup: () => invoke('orders:clearArchivedPickup'),
    // Delivery orders
    findAllDeliveryPlatforms: () => invoke('orders:findAllDeliveryPlatforms'),
    createDeliveryPlatform: (data: any) => invoke('orders:createDeliveryPlatform', data),
    updateDeliveryPlatform: (id: number, data: any) => invoke('orders:updateDeliveryPlatform', id, data),
    removeDeliveryPlatform: (id: number) => invoke('orders:removeDeliveryPlatform', id),
    findActiveDelivery: () => invoke('orders:findActiveDelivery'),
    findArchivedDelivery: () => invoke('orders:findArchivedDelivery'),
    findDeliveryById: (id: number) => invoke('orders:findDeliveryById', id),
    createDelivery: (data: any) => invoke('orders:createDelivery', data),
    updateDeliveryStatus: (id: number, status: string) => invoke('orders:updateDeliveryStatus', id, status),
    updateDelivery: (id: number, data: any) => invoke('orders:updateDelivery', id, data),
    removeDelivery: (id: number) => invoke('orders:removeDelivery', id),
    clearArchivedDelivery: () => invoke('orders:clearArchivedDelivery'),
  },
  users: {
    findAll: () => invoke('users:findAll'),
    findOne: (id: number) => invoke('users:findOne', id),
    create: (data: any) => invoke('users:create', data),
    update: (id: number, data: any) => invoke('users:update', id, data),
    remove: (id: number) => invoke('users:remove', id),
  },
  offers: {
    dailyDeals: () => invoke('offers:dailyDeals'),
    createDailyDeal: (data: any) => invoke('offers:createDailyDeal', data),
    updateDailyDeal: (id: number, data: any) => invoke('offers:updateDailyDeal', id, data),
    deleteDailyDeal: (id: number) => invoke('offers:deleteDailyDeal', id),
    combos: () => invoke('offers:combos'),
    createCombo: (data: any) => invoke('offers:createCombo', data),
    updateCombo: (id: number, data: any) => invoke('offers:updateCombo', id, data),
    deleteCombo: (id: number) => invoke('offers:deleteCombo', id),
    scheduledOffers: () => invoke('offers:scheduledOffers'),
    createScheduledOffer: (data: any) => invoke('offers:createScheduledOffer', data),
    updateScheduledOffer: (id: number, data: any) => invoke('offers:updateScheduledOffer', id, data),
    deleteScheduledOffer: (id: number) => invoke('offers:deleteScheduledOffer', id),
    happyHour: () => invoke('offers:happyHour'),
    createHappyHour: (data: any) => invoke('offers:createHappyHour', data),
    updateHappyHour: (id: number, data: any) => invoke('offers:updateHappyHour', id, data),
    deleteHappyHour: (id: number) => invoke('offers:deleteHappyHour', id),
    featuredItems: () => invoke('offers:featuredItems'),
    createFeaturedItem: (data: any) => invoke('offers:createFeaturedItem', data),
    setFeatured: (productId: number, featured: boolean) => invoke('offers:setFeatured', productId, featured),
    deleteFeaturedItem: (id: number) => invoke('offers:deleteFeaturedItem', id),
  },
  shelves: {
    findAll: () => invoke('shelves:findAll'),
    findOne: (id: number) => invoke('shelves:findOne', id),
    findByBarcode: (barcode: string) => invoke('shelves:findByBarcode', barcode),
    create: (data: any) => invoke('shelves:create', data),
    update: (id: number, data: any) => invoke('shelves:update', id, data),
    remove: (id: number) => invoke('shelves:remove', id),
    sell: (data: any) => invoke('shelves:sell', data),
  },
  shifts: {
    findAll: () => invoke('shifts:findAll'),
    findOne: (id: number) => invoke('shifts:findOne', id),
    create: (data: any) => invoke('shifts:create', data),
    update: (id: number, data: any) => invoke('shifts:update', id, data),
    remove: (id: number) => invoke('shifts:remove', id),
    getCurrent: () => invoke('shifts:getCurrent'),
    start: (data: any) => invoke('shifts:start', data),
    end: (id: number, data: any) => invoke('shifts:end', id, data),
    finish: (data: any) => invoke('shifts:end', data), // alias for end (close shift)
  },
  finance: {
    cashFlow: (startDate?: string, endDate?: string) => invoke('finance:cashFlow', startDate, endDate),
    createCashFlow: (data: any) => invoke('finance:createCashFlow', data),
    revenues: (startDate?: string, endDate?: string) => invoke('finance:revenues', startDate, endDate),
    createRevenue: (data: any) => invoke('finance:createRevenue', data),
    expenses: (startDate?: string, endDate?: string) => invoke('finance:expenses', startDate, endDate),
    createExpense: (data: any) => invoke('finance:createExpense', data),
    updateExpense: (id: number, data: any) => invoke('finance:updateExpense', id, data),
    deleteExpense: (id: number) => invoke('finance:deleteExpense', id),
    syncRevenue: (date: string) => invoke('finance:syncRevenue', date),
    syncCashFlow: (date: string) => invoke('finance:syncCashFlow', date),
    profit: (startDate?: string, endDate?: string) => invoke('finance:profit', startDate, endDate),
    export: (data: any) => invoke('finance:export', data),
  },
  'business-day': {
    getCurrent: () => invoke('business-day:getCurrent'),
    start: (data: any) => invoke('business-day:start', data),
    reset: (data?: any) => invoke('business-day:reset', data),
    ensure: () => invoke('business-day:ensure'),
  },
  reports: {
    dailySummary: () => invoke('reports:dailySummary'),
    getReport: (period: string, date: string) => invoke('reports:getReport', period, date),
  },
  settings: {
    getShiftHours: () => invoke('settings:getShiftHours'),
    updateShiftHours: (data: {
      shift_mode?: 'single' | 'multi';
      business_day_start_time?: string;
      shift_start_time?: string;
      shift_end_time?: string;
    }) => invoke('settings:updateShiftHours', data),
    getShiftDefinitions: () => invoke('settings:getShiftDefinitions'),
    createShiftDefinition: (data: {
      name: string;
      start_time: string;
      end_time: string;
      sort_order?: number;
    }) => invoke('settings:createShiftDefinition', data),
    updateShiftDefinition: (
      id: number,
      data: {
        name?: string;
        start_time?: string;
        end_time?: string;
        sort_order?: number;
        is_active?: boolean;
      },
    ) => invoke('settings:updateShiftDefinition', id, data),
    removeShiftDefinition: (id: number) => invoke('settings:removeShiftDefinition', id),
    replaceShiftDefinitions: (shifts: Array<{
      id?: number;
      name: string;
      start_time: string;
      end_time: string;
      sort_order?: number;
    }>) => invoke('settings:replaceShiftDefinitions', shifts),
  },
  export: {
    pdf: (exportData: {
      type: 'daily' | 'weekly' | 'monthly' | 'yearly';
      date: string;
      data: {
        summary: any;
        items: any[];
        employees: any[];
        orders: any[];
        drawer?: any;
      };
    }) => invoke('export-pdf', exportData),
  },
  // Generic API method for routing any endpoint via IPC
  api: (endpoint: string, method: string = 'GET', body?: any) => {
    // This will be handled by fetchViaIPC in the frontend
    // For now, return a promise that will be handled by the IPC router
    return invoke('api:request', { endpoint, method, body });
  },
});

/** License server + auto-update (same IPC contract as `amaan-platform`; Sufra uses product sufra_lite). */
const LAN_HTTP_DEFAULT = 3333;
contextBridge.exposeInMainWorld('amaan', {
  apiPort: LAN_HTTP_DEFAULT,
  getApiPort: (): Promise<number> => ipcRenderer.invoke('amaan-get-api-port'),
  licenseGetStatus: () => ipcRenderer.invoke('license-get-status'),
  licenseGetPlatformUrlSettings: () => ipcRenderer.invoke('license-get-platform-url-settings'),
  licenseSetPlatformUrl: (url: string) => ipcRenderer.invoke('license-set-platform-url', url),
  licenseGetPollIntervalMs: () => ipcRenderer.invoke('license-get-poll-interval-ms'),
  licenseImportFromPath: (absolutePath: string) => ipcRenderer.invoke('license-import-path', absolutePath),
  licensePickAndImport: () => ipcRenderer.invoke('license-pick-and-import'),
  licenseImportJson: (jsonText: string) => ipcRenderer.invoke('license-import-json', jsonText),
  licenseCopyMachineId: () => ipcRenderer.invoke('license-copy-machine-id'),
  updateGetState: () => ipcRenderer.invoke('amaan-update-get-state'),
  updateCheckNow: () => ipcRenderer.invoke('amaan-update-check-now'),
  updateDownload: () => ipcRenderer.invoke('amaan-update-download'),
  updateInstallNow: () => ipcRenderer.invoke('amaan-update-install'),
  updateOnStateChange: (cb: (state: unknown) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: { state?: unknown }): void => {
      if (payload && payload.state) cb(payload.state)
    }
    ipcRenderer.on('amaan-update-state', listener)
    return () => {
      ipcRenderer.removeListener('amaan-update-state', listener)
    }
  },
});

declare global {
  interface Window {
    sufra: {
      auth: {
        login: (username: string, password: string) => Promise<{ access_token: string; user: any }>;
        me: (userId: number) => Promise<any>;
        verifyToken: (token: string) => Promise<any>;
        verifyPassword: (userId: number, password: string) => Promise<{ valid: boolean }>;
      };
      print: {
        order: (orderData: any, kitchenId?: number | null) => Promise<{ success: boolean; error?: string }>;
        receipt: (receiptData: any) => Promise<{ success: boolean; error?: string }>;
        getPrinters: () => Promise<Array<{ name: string; isDefault: boolean }>>;
      };
      printers: {
        getSettings: () => Promise<Array<{
          id: number;
          kitchen_id: number | null;
          printer_ip: string | null;
          printer_port: number;
          printer_type: 'kitchen' | 'customer';
          is_active: boolean;
        }>>;
        saveSettings: (settings: { kitchen_id: number | null; printer_ip: string | null; printer_port?: number }) => Promise<any>;
        test: (settings: { printer_ip: string; printer_port?: number }) => Promise<{ success: boolean; error?: string; message?: string }>;
        available: () => Promise<Array<{ name: string; isDefault: boolean }>>;
        scan: () => Promise<Array<{ ip: string; port: number }>>;
      };
      recipePrint: {
        getSettings: () => Promise<{ restaurantName: string; thankYouLine: string; mobileNumber: string }>;
        saveSettings: (settings: {
          restaurantName?: string;
          thankYouLine?: string;
          mobileNumber?: string;
        }) => Promise<{ restaurantName: string; thankYouLine: string; mobileNumber: string }>;
        preview: (branding: {
          restaurantName?: string;
          thankYouLine?: string;
          mobileNumber?: string;
        }) => Promise<{ success: true; imageBase64: string } | { success: false; error: string }>;
        print: (branding: {
          restaurantName?: string;
          thankYouLine?: string;
          mobileNumber?: string;
        }) => Promise<{ success: true } | { success: false; error: string }>;
      };
      support: {
        openAnyDesk: () => Promise<
          { ok: true; action: 'launched' | 'openedDownloadPage' } | { ok: false; error: string }
        >;
        openAnyDeskDownloadPage: () => Promise<{ ok: true } | { ok: false; error: string }>;
      };
      backup?: {
        getSettings: () => Promise<{
          enabled: boolean;
          scheduleHour: number;
          scheduleMinute: number;
          retentionCount: number;
          lastRunAt: string | null;
          lastRunSizeBytes: number | null;
          lastBackupId: string | null;
          lastError: string | null;
          nextRunAt: string | null;
        }>;
        updateSettings: (settings: {
          enabled?: boolean;
          scheduleHour?: number;
          scheduleMinute?: number;
          retentionCount?: number;
        }) => Promise<unknown>;
        runNow: () => Promise<
          { ok: true; backupId: string; sizeBytes: number } | { ok: false; error: string }
        >;
        list: () => Promise<
          Array<{ id: string; createdAt: string; sizeBytes: number; storeName: string }>
        >;
        getStatus: () => Promise<{
          settings: {
            enabled: boolean;
            scheduleHour: number;
            scheduleMinute: number;
            retentionCount: number;
            lastRunAt: string | null;
            lastRunSizeBytes: number | null;
            lastBackupId: string | null;
            lastError: string | null;
            nextRunAt: string | null;
          };
          inProgress: boolean;
          backups: Array<{ id: string; createdAt: string; sizeBytes: number; storeName: string }>;
        }>;
        restore: (
          backupId: string,
          accessToken: string,
        ) => Promise<{ ok: true } | { ok: false; error: string }>;
      };
      orders: {
        findActive: () => Promise<any[]>;
        findByTable: (tableId: number) => Promise<any[]>;
        findByHall: (hallId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        createDineIn: (data: any) => Promise<any>;
        findActiveDineIn: () => Promise<any[]>;
        findDineInByTable: (tableId: number) => Promise<any[]>;
        findDineInByHall: (hallId: number) => Promise<any[]>;
        update: (id: number, data: any) => Promise<any>;
        updateStatus: (id: number, status: string) => Promise<any>;
        updateDineInStatus: (id: number, status: string) => Promise<any>;
        setTableGlobalDiscount: (tableId: number, globalDiscount: { percent: number; amount: number } | null) => Promise<any>;
        moveTable: (sourceTableId: number, targetTableId: number) => Promise<{ movedCount: number }>;
        remove: (id: number) => Promise<any>;
        findActivePickup: () => Promise<any[]>;
        findArchivedPickup: () => Promise<any[]>;
        findPickupById: (id: number) => Promise<any>;
        createPickup: (data: any) => Promise<any>;
        updatePickupStatus: (id: number, status: string) => Promise<any>;
        updatePickup: (id: number, data: any) => Promise<any>;
        removePickup: (id: number) => Promise<any>;
        clearArchivedPickup: () => Promise<{ deletedCount: number }>;
        findAllDeliveryPlatforms: () => Promise<any[]>;
        createDeliveryPlatform: (data: any) => Promise<any>;
        updateDeliveryPlatform: (id: number, data: any) => Promise<any>;
        removeDeliveryPlatform: (id: number) => Promise<void>;
        findActiveDelivery: () => Promise<any[]>;
        findArchivedDelivery: () => Promise<any[]>;
        findDeliveryById: (id: number) => Promise<any>;
        createDelivery: (data: any) => Promise<any>;
        updateDeliveryStatus: (id: number, status: string) => Promise<any>;
        updateDelivery: (id: number, data: any) => Promise<any>;
        removeDelivery: (id: number) => Promise<any>;
        clearArchivedDelivery: () => Promise<{ deletedCount: number }>;
      };
      reports: {
        dailySummary: () => Promise<any>;
        getReport: (period: string, date: string) => Promise<any>;
      };
      settings: {
        getShiftHours: () => Promise<{
          shift_mode: 'single' | 'multi';
          business_day_start_time: string;
          shift_start_time: string;
          shift_end_time: string;
          current_business_date: string;
        }>;
        updateShiftHours: (data: {
          shift_mode?: 'single' | 'multi';
          business_day_start_time?: string;
          shift_start_time?: string;
          shift_end_time?: string;
        }) => Promise<{
          shift_mode: 'single' | 'multi';
          business_day_start_time: string;
          shift_start_time: string;
          shift_end_time: string;
          current_business_date: string;
        }>;
        getShiftDefinitions: () => Promise<Array<{
          id: number;
          name: string;
          start_time: string;
          end_time: string;
          sort_order: number;
          is_active: boolean;
        }>>;
        createShiftDefinition: (data: {
          name: string;
          start_time: string;
          end_time: string;
          sort_order?: number;
        }) => Promise<unknown>;
        updateShiftDefinition: (
          id: number,
          data: {
            name?: string;
            start_time?: string;
            end_time?: string;
            sort_order?: number;
            is_active?: boolean;
          },
        ) => Promise<unknown>;
        removeShiftDefinition: (id: number) => Promise<unknown>;
      };
      halls: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      tables: {
        findAll: () => Promise<any[]>;
        findByHall: (hallId: number) => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      floors: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      kitchens: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      items: {
        findAll: (kitchen_id?: number) => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      categories: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
        reorder: (ids: number[]) => Promise<void>;
      };
      users: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
      };
      offers: {
        dailyDeals: () => Promise<any[]>;
        createDailyDeal: (data: any) => Promise<any>;
        updateDailyDeal: (id: number, data: any) => Promise<any>;
        deleteDailyDeal: (id: number) => Promise<any>;
        combos: () => Promise<any[]>;
        createCombo: (data: any) => Promise<any>;
        updateCombo: (id: number, data: any) => Promise<any>;
        deleteCombo: (id: number) => Promise<any>;
        scheduledOffers: () => Promise<any[]>;
        createScheduledOffer: (data: any) => Promise<any>;
        updateScheduledOffer: (id: number, data: any) => Promise<any>;
        deleteScheduledOffer: (id: number) => Promise<any>;
        happyHour: () => Promise<any[]>;
        createHappyHour: (data: any) => Promise<any>;
        updateHappyHour: (id: number, data: any) => Promise<any>;
        deleteHappyHour: (id: number) => Promise<any>;
        featuredItems: () => Promise<any[]>;
        createFeaturedItem: (data: any) => Promise<any>;
        deleteFeaturedItem: (id: number) => Promise<any>;
      };
      shelves: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        findByBarcode: (barcode: string) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
        sell: (data: any) => Promise<any>;
      };
      shifts: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
        getCurrent: () => Promise<any>;
        start: (data: any) => Promise<any>;
        end: (id: number, data: any) => Promise<any>;
        finish: (data: any) => Promise<any>;
      };
      finance: {
        cashFlow: (startDate?: string, endDate?: string) => Promise<any[]>;
        createCashFlow: (data: any) => Promise<any>;
        revenues: (startDate?: string, endDate?: string) => Promise<any[]>;
        createRevenue: (data: any) => Promise<any>;
        expenses: (startDate?: string, endDate?: string) => Promise<any[]>;
        createExpense: (data: any) => Promise<any>;
        updateExpense: (id: number, data: any) => Promise<any>;
        deleteExpense: (id: number) => Promise<any>;
        profit: (startDate?: string, endDate?: string) => Promise<any>;
        export: (data: any) => Promise<any>;
      };
      'business-day': {
        getCurrent: () => Promise<any>;
        start: (data: any) => Promise<any>;
        reset: (data?: any) => Promise<any>;
        ensure: () => Promise<any>;
      };
      export: {
        pdf: (exportData: {
          type: 'daily' | 'weekly' | 'monthly' | 'yearly';
          date: string;
          data: {
            summary: any;
            items: any[];
            employees: any[];
            orders: any[];
            drawer?: any;
          };
        }) => Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }>;
      };
    };
    /** LM + updates (Electron preload). */
    amaan?: {
      apiPort: number;
      getApiPort: () => Promise<number>;
      licenseGetStatus: () => Promise<unknown>;
      licenseGetPlatformUrlSettings: () => Promise<unknown>;
      licenseSetPlatformUrl: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
      licenseGetPollIntervalMs: () => Promise<number | null>;
      licenseImportFromPath: (absolutePath: string) => Promise<{ ok: true } | { ok: false; error: string }>;
      licensePickAndImport: () => Promise<{ ok: true } | { ok: false; error: string }>;
      licenseImportJson: (jsonText: string) => Promise<{ ok: true } | { ok: false; error: string }>;
      licenseCopyMachineId: () => Promise<string>;
      updateGetState: () => Promise<unknown>;
      updateCheckNow: () => Promise<{ ok: true } | { ok: false; error: string }>;
      updateDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
      updateInstallNow: () => Promise<{ ok: true } | { ok: false; error: string }>;
      updateOnStateChange?: (cb: (state: unknown) => void) => () => void;
    };
  }
}


