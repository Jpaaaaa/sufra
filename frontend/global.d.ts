/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  // Add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    /** LM + auto-update (Electron preload). Optional in browser. */
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
    sufra?: {
      license?: {
        getStatus: () => Promise<{
          valid: boolean;
          license_type: 'trial' | 'yearly' | null;
          days_remaining: number;
          minutes_remaining: number;
          seconds_remaining: number;
          expires_at: string | null;
          error: string | null;
        }>;
        refresh: () => Promise<{
          valid: boolean;
          license_type: 'trial' | 'yearly' | null;
          days_remaining: number;
          minutes_remaining: number;
          seconds_remaining: number;
          expires_at: string | null;
          error: string | null;
        }>;
      };
      auth: {
        login: (username: string, password: string) => Promise<{ access_token: string; user: any }>;
        me: (userId: number) => Promise<any>;
        verifyToken: (token: string) => Promise<any>;
        verifyPassword: (userId: number, password: string) => Promise<{ valid: boolean }>;
        setSessionUser?: (user: { id: number; username: string; role: string } | null) => void;
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
          connection_type: 'network' | 'windows_spooler';
          printer_ip: string | null;
          printer_port: number;
          printer_name: string | null;
          printer_type: 'kitchen' | 'customer';
          is_active: boolean;
        }>>;
        saveSettings: (settings: {
          kitchen_id: number | null;
          connection_type?: 'network' | 'windows_spooler';
          printer_ip?: string | null;
          printer_port?: number;
          printer_name?: string | null;
        }) => Promise<any>;
        test: (settings: {
          connection_type?: 'network' | 'windows_spooler';
          printer_ip?: string | null;
          printer_port?: number;
          printer_name?: string | null;
          kitchen_id?: number | null;
          kind?: 'customer' | 'kitchen';
          kitchen_name?: string;
          use_saved?: boolean;
        }) => Promise<{ success: boolean; error?: string; message?: string }>;
        preview: (settings?: {
          kind?: 'customer' | 'kitchen';
          kitchen_id?: number | null;
          kitchen_name?: string;
        }) => Promise<
          | { success: true; imageBase64: string; kind: 'customer' | 'kitchen' }
          | { success: false; error: string }
        >;
        available: (forceRefresh?: boolean) => Promise<Array<{ name: string; isDefault: boolean; status?: string }>>;
        scan: () => Promise<Array<{ ip: string; port: number }>>;
      };
      recipePrint?: {
        getSettings: () => Promise<{
          restaurantName: string;
          thankYouLine: string;
          mobileNumber: string;
          logoPath: string;
        }>;
        saveSettings: (settings: {
          restaurantName?: string;
          thankYouLine?: string;
          mobileNumber?: string;
        }) => Promise<{
          restaurantName: string;
          thankYouLine: string;
          mobileNumber: string;
          logoPath: string;
        }>;
        pickLogo: () => Promise<
          | {
              success: true;
              branding: {
                restaurantName: string;
                thankYouLine: string;
                mobileNumber: string;
                logoPath: string;
              };
              logoPreviewBase64: string | null;
            }
          | { success: false; error: string }
        >;
        removeLogo: () => Promise<
          | {
              success: true;
              branding: {
                restaurantName: string;
                thankYouLine: string;
                mobileNumber: string;
                logoPath: string;
              };
            }
          | { success: false; error: string }
        >;
        logoPreview: () => Promise<
          | { success: true; logoPreviewBase64: string | null }
          | { success: false; error: string }
        >;
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
      support?: {
        openAnyDesk: () => Promise<
          { ok: true; action: 'launched' | 'openedDownloadPage' } | { ok: false; error: string }
        >;
        openAnyDeskDownloadPage: () => Promise<{ ok: true } | { ok: false; error: string }>;
        openExternalUrl: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
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
        copyOptionsFromItem: (targetId: number, sourceId: number) => Promise<any>;
      };
      categories: {
        findAll: () => Promise<any[]>;
        findOne: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
        reorder: (ids: number[]) => Promise<void>;
      };
      orders: {
        findActive: () => Promise<any[]>;
        findByTable: (tableId: number) => Promise<any[]>;
        findByHall: (hallId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        createDineIn: (data: any) => Promise<any>;
        createPickup: (data: any) => Promise<any>;
        createDelivery: (data: any) => Promise<any>;
        findAllDeliveryPlatforms: () => Promise<any[]>;
        createDeliveryPlatform: (data: any) => Promise<any>;
        updateDeliveryPlatform: (id: number, data: any) => Promise<any>;
        removeDeliveryPlatform: (id: number) => Promise<void>;
        createEmptyPickup: () => Promise<any>;
        createEmptyDelivery: () => Promise<any>;
        findActiveDineIn: () => Promise<any[]>;
        findArchivedDineIn: () => Promise<any[]>;
        clearArchivedDineIn: () => Promise<{ deletedCount: number }>;
        findActivePickup: () => Promise<any[]>;
        findArchivedPickup: () => Promise<any[]>;
        findActiveDelivery: () => Promise<any[]>;
        findArchivedDelivery: () => Promise<any[]>;
        getById: (id: number) => Promise<any | null>;
        findDineInByTable: (tableId: number) => Promise<any[]>;
        findDineInByHall: (hallId: number) => Promise<any[]>;
        findPickupById: (id: number) => Promise<any | null>;
        findDeliveryById: (id: number) => Promise<any | null>;
        update: (id: number, data: any) => Promise<any>;
        updateStatus: (id: number, status: string) => Promise<any>;
        updateDineInStatus: (id: number, status: string) => Promise<any>;
        updateDineIn: (id: number, data: any) => Promise<any>;
        setTableGlobalDiscount: (tableId: number, globalDiscount: { percent: number; amount: number } | null) => Promise<{ updatedCount: number }>;
        moveTable: (sourceTableId: number, targetTableId: number) => Promise<{ movedCount: number }>;
        moveOrders: (orderIds: number[], targetTableId: number) => Promise<{ movedCount: number }>;
        updatePickupStatus: (id: number, status: string) => Promise<any>;
        updateDeliveryStatus: (id: number, status: string) => Promise<any>;
        updatePickup: (id: number, data: any) => Promise<any>;
        updateDelivery: (id: number, data: any) => Promise<any>;
        remove: (id: number) => Promise<any>;
        removePickup: (id: number) => Promise<any>;
        clearArchivedPickup: () => Promise<{ deletedCount: number }>;
        removeDelivery: (id: number) => Promise<any>;
        clearArchivedDelivery: () => Promise<{ deletedCount: number }>;
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
        archiveDailyDeal?: (id: number) => Promise<any>;
        duplicateDailyDeal?: (id: number) => Promise<any>;
        combos: () => Promise<any[]>;
        createCombo: (data: any) => Promise<any>;
        updateCombo: (id: number, data: any) => Promise<any>;
        deleteCombo: (id: number) => Promise<any>;
        archiveCombo?: (id: number) => Promise<any>;
        duplicateCombo?: (id: number) => Promise<any>;
        scheduledOffers: () => Promise<any[]>;
        createScheduledOffer: (data: any) => Promise<any>;
        updateScheduledOffer: (id: number, data: any) => Promise<any>;
        deleteScheduledOffer: (id: number) => Promise<any>;
        archiveScheduledOffer?: (id: number) => Promise<any>;
        duplicateScheduledOffer?: (id: number) => Promise<any>;
        happyHour: () => Promise<any[]>;
        createHappyHour: (data: any) => Promise<any>;
        updateHappyHour: (id: number, data: any) => Promise<any>;
        deleteHappyHour: (id: number) => Promise<any>;
        archiveHappyHour?: (id: number) => Promise<any>;
        duplicateHappyHour?: (id: number) => Promise<any>;
        featuredItems: () => Promise<any[]>;
        createFeaturedItem: (data: any) => Promise<any>;
        setFeatured: (productId: number, featured: boolean) => Promise<any>;
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
        syncCashFlow: (date: string) => Promise<{ success: boolean }>;
        revenues: (startDate?: string, endDate?: string) => Promise<any[]>;
        createRevenue: (data: any) => Promise<any>;
        syncRevenue: (date: string) => Promise<any | null>;
        expenses: (startDate?: string, endDate?: string) => Promise<any[]>;
        recurringExpenses: () => Promise<any[]>;
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
        replaceShiftDefinitions: (shifts: Array<{
          id?: number;
          name: string;
          start_time: string;
          end_time: string;
          sort_order?: number;
        }>) => Promise<unknown>;
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
      api: (endpoint: string, method?: string, body?: any) => Promise<any>;
    };
  }
}

export {};
