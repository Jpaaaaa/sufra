/**
 * IPC API Client for Electron
 * Routes HTTP-like requests through Electron IPC when available
 * NO HTTP FALLBACK - IPC ONLY in Electron mode
 */

/**
 * Check if running in Electron
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.sufra;
}

/**
 * Map HTTP endpoint to IPC call
 */
async function callIPC(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  if (!isElectron()) {
    return null; // Not in Electron, return null to indicate IPC not available
  }

  const sufra = window.sufra!;
  // Split endpoint into path and query string (query string handled separately)
  const [pathPart, queryString] = endpoint.split('?');
  let normalizedEndpoint = pathPart.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
  // Strip /api prefix if present (some configs use it)
  if (normalizedEndpoint.startsWith('api/')) {
    normalizedEndpoint = normalizedEndpoint.slice(4);
  }
  const parts = normalizedEndpoint.split('/').filter(p => p.length > 0);
  const [resource, idOrAction, ...rest] = parts;

  try {
    // Explicit mapping for GET /shifts/active (avoids "not mapped" e.g. on focus refresh)
    if (method === 'GET' && (normalizedEndpoint === 'shifts/active' || normalizedEndpoint === 'shifts/current')) {
      return await sufra.shifts.getCurrent();
    }

    // GET /orders/delivery/platforms — explicit (avoid || null when preload method missing)
    if (method === 'GET' && normalizedEndpoint === 'orders/delivery/platforms') {
      const fn = sufra.orders?.findAllDeliveryPlatforms;
      if (typeof fn === 'function') {
        return await fn();
      }
      return [];
    }

    // POST /orders/delivery/platforms
    if (method === 'POST' && normalizedEndpoint === 'orders/delivery/platforms') {
      const fn = sufra.orders?.createDeliveryPlatform;
      if (typeof fn === 'function') {
        return await fn(body);
      }
      throw new Error(
        'IPC: createDeliveryPlatform غير متوفر. أعد تشغيل تطبيق Electron بعد التحديث.',
      );
    }

    // Explicit mapping for POST /finance/revenue/sync and /finance/cashflow/sync (must match before generic finance)
    const isRevenueSyncEndpoint =
      normalizedEndpoint === 'finance/revenue/sync' ||
      normalizedEndpoint.endsWith('/finance/revenue/sync') ||
      (parts.length >= 3 && parts[parts.length - 3] === 'finance' && parts[parts.length - 2] === 'revenue' && parts[parts.length - 1] === 'sync');
    const isCashflowSyncEndpoint =
      normalizedEndpoint === 'finance/cashflow/sync' ||
      normalizedEndpoint.endsWith('/finance/cashflow/sync') ||
      (parts.length >= 3 && parts[parts.length - 3] === 'finance' && parts[parts.length - 2] === 'cashflow' && parts[parts.length - 1] === 'sync');
    if (method === 'POST') {
      if (isRevenueSyncEndpoint) {
        const date = body?.date ?? new Date().toISOString().split('T')[0];
        if (sufra.finance?.syncRevenue) {
          return await sufra.finance.syncRevenue(date);
        }
        // Fallback: generic api:request handler (main process routes to finance service)
        if (typeof sufra.api === 'function') {
          const result = await sufra.api(endpoint, method, body);
          return result ?? null;
        }
        throw new Error('IPC: finance.syncRevenue not available. Run the app in Electron with preload loaded.');
      }
      if (isCashflowSyncEndpoint) {
        const date = body?.date ?? new Date().toISOString().split('T')[0];
        if (sufra.finance?.syncCashFlow) {
          await sufra.finance.syncCashFlow(date);
          return { success: true };
        }
        if (typeof sufra.api === 'function') {
          await sufra.api(endpoint, method, body);
          return { success: true };
        }
        throw new Error('IPC: finance.syncCashFlow not available. Run the app in Electron with preload loaded.');
      }
    }

    // Auth endpoints
    if (resource === 'auth') {
      if (idOrAction === 'login' && method === 'POST') {
        return await sufra.auth.login(body?.username || body?.username, body?.password || body?.password);
      }
      if (idOrAction === 'me' && method === 'GET') {
        // Extract userId from token if needed, or use body
        const userId = body?.userId || body?.user_id;
        if (userId) return await sufra.auth.me(userId);
      }
      if (idOrAction === 'verify-token' && method === 'POST') {
        return await sufra.auth.verifyToken(body?.token || body);
      }
      if (idOrAction === 'verify-password' && method === 'POST') {
        return await sufra.auth.verifyPassword(body?.userId || body?.user_id, body?.password);
      }
    }

    // Orders endpoints
    if (resource === 'orders') {
      if (method === 'GET') {
        // Check for domain-specific endpoints first
        if (idOrAction === 'dine-in') {
          if (rest[0] === 'active') {
            return await sufra.orders.findActiveDineIn?.() || await sufra.orders.findActive();
          }
          // GET /orders/dine-in/archived
          if (rest[0] === 'archived') {
            return await sufra.orders.findArchivedDineIn?.() || null;
          }
          // GET /orders/dine-in/table/:tableId
          if (rest[0] === 'table' && rest[1]) {
            const tableId = parseInt(rest[1], 10);
            return await sufra.orders.findDineInByTable?.(tableId) || await sufra.orders.findByTable(tableId);
          }
          // GET /orders/dine-in/hall/:hallId
          if (rest[0] === 'hall' && rest[1]) {
            const hallId = parseInt(rest[1], 10);
            return await sufra.orders.findDineInByHall?.(hallId) || await sufra.orders.findByHall(hallId);
          }
        }
        // GET /orders/pickup/active
        if (idOrAction === 'pickup') {
          if (rest[0] === 'active') {
            return await sufra.orders.findActivePickup?.() || null;
          }
          // GET /orders/pickup/archived
          if (rest[0] === 'archived') {
            return await sufra.orders.findArchivedPickup?.() || null;
          }
          // GET /orders/pickup/:id
          if (rest[0] && !isNaN(parseInt(rest[0], 10))) {
            const orderId = parseInt(rest[0], 10);
            return await sufra.orders.findPickupById?.(orderId) || null;
          }
        }
        // GET /orders/delivery/active
        if (idOrAction === 'delivery') {
          if (rest[0] === 'platforms') {
            const fn = sufra.orders.findAllDeliveryPlatforms;
            if (typeof fn === 'function') {
              return await fn();
            }
            return [];
          }
          if (rest[0] === 'active') {
            return await sufra.orders.findActiveDelivery?.() || null;
          }
          // GET /orders/delivery/archived
          if (rest[0] === 'archived') {
            return await sufra.orders.findArchivedDelivery?.() || null;
          }
          // GET /orders/delivery/:id
          if (rest[0] && !isNaN(parseInt(rest[0], 10))) {
            const orderId = parseInt(rest[0], 10);
            return await sufra.orders.findDeliveryById?.(orderId) || null;
          }
        }
        // Check for query params in endpoint (use original endpoint which includes query string)
        if (endpoint.includes('hall_id=')) {
          const hallIdMatch = endpoint.match(/hall_id=(\d+)/i);
          if (hallIdMatch) {
            const hallId = parseInt(hallIdMatch[1], 10);
            return await sufra.orders.findByHall(hallId);
          }
        }
        if (endpoint.includes('table_id=') || idOrAction) {
          const tableIdMatch = endpoint.match(/table_id=(\d+)/i);
          const tableId = tableIdMatch ? parseInt(tableIdMatch[1], 10) : (idOrAction ? parseInt(idOrAction, 10) : null);
          if (tableId) return await sufra.orders.findByTable(tableId);
        }
        return await sufra.orders.findActive();
      }
      if (method === 'POST') {
        // Route to domain-specific services based on endpoint
        if (idOrAction === 'dine-in') {
          // POST /orders/dine-in/move-table
          if (rest[0] === 'move-table' && body?.source_table_id && body?.target_table_id) {
            return await sufra.orders.moveTable?.(body.source_table_id, body.target_table_id) || null;
          }
          // POST /orders/dine-in/move-orders
          if (rest[0] === 'move-orders' && Array.isArray(body?.order_ids) && body?.target_table_id) {
            return await sufra.orders.moveOrders?.(body.order_ids, body.target_table_id) || null;
          }
          return await sufra.orders.createDineIn?.(body) || await sufra.orders.create(body);
        }
        // POST /orders/pickup
        if (idOrAction === 'pickup') {
          return await sufra.orders.createPickup?.(body) || null;
        }
        // POST /orders/delivery
        if (idOrAction === 'delivery') {
          if (rest[0] === 'platforms') {
            const fn = sufra.orders.createDeliveryPlatform;
            if (typeof fn !== 'function') {
              throw new Error(
                'IPC: createDeliveryPlatform غير متوفر. أعد تشغيل تطبيق Electron بعد التحديث.',
              );
            }
            return await fn(body);
          }
          return await sufra.orders.createDelivery?.(body) || null;
        }
        // Fallback to legacy orders:create (will throw error about read-only)
        return await sufra.orders.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        // Check for domain-specific status updates first
        // PATCH /orders/dine-in/:id/status
        if (idOrAction === 'dine-in' && rest[0] && rest[1] === 'status') {
          const orderId = parseInt(rest[0], 10);
          if (orderId && body?.status) {
            return await sufra.orders.updateDineInStatus?.(orderId, body.status) || await sufra.orders.updateStatus(orderId, body.status);
          }
        }
        // PATCH /orders/dine-in/:id (full order update for editing)
        if (idOrAction === 'dine-in' && rest[0] && !rest[1]) {
          const orderId = parseInt(rest[0], 10);
          if (orderId && !isNaN(orderId)) {
            return await sufra.orders.updateDineIn?.(orderId, body) || await sufra.orders.update(orderId, body);
          }
        }
        // PATCH /orders/table/:tableId/global-discount
        if (idOrAction === 'table' && rest[0] && rest[1] === 'global-discount') {
          const tableId = parseInt(rest[0], 10);
          if (tableId && !isNaN(tableId) && sufra.orders.setTableGlobalDiscount) {
            return await sufra.orders.setTableGlobalDiscount(tableId, body?.globalDiscount ?? null);
          }
        }
        // PATCH /orders/pickup/:id/status
        if (idOrAction === 'pickup' && rest[0] && rest[1] === 'status') {
          const orderId = parseInt(rest[0], 10);
          if (orderId && body?.status) {
            return await sufra.orders.updatePickupStatus?.(orderId, body.status) || null;
          }
        }
        // PATCH /orders/pickup/:id
        if (idOrAction === 'pickup' && rest[0] && !rest[1]) {
          const orderId = parseInt(rest[0], 10);
          if (orderId) {
            return await sufra.orders.updatePickup?.(orderId, body) || null;
          }
        }
        // PATCH /orders/delivery/platforms/:id
        if (idOrAction === 'delivery' && rest[0] === 'platforms' && rest[1] && !isNaN(parseInt(rest[1], 10))) {
          const platformId = parseInt(rest[1], 10);
          const fn = sufra.orders.updateDeliveryPlatform;
          if (typeof fn !== 'function') {
            throw new Error(
              'IPC: updateDeliveryPlatform غير متوفر. أعد تشغيل تطبيق Electron بعد التحديث.',
            );
          }
          return await fn(platformId, body);
        }
        // PATCH /orders/delivery/:id/status
        if (idOrAction === 'delivery' && rest[0] && rest[1] === 'status') {
          const orderId = parseInt(rest[0], 10);
          if (orderId && body?.status) {
            return await sufra.orders.updateDeliveryStatus?.(orderId, body.status) || null;
          }
        }
        // PATCH /orders/delivery/:id
        if (idOrAction === 'delivery' && rest[0] && !rest[1]) {
          const orderId = parseInt(rest[0], 10);
          if (orderId) {
            return await sufra.orders.updateDelivery?.(orderId, body) || null;
          }
        }
        // Generic order update (legacy or direct ID)
        const orderId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (orderId && !isNaN(orderId)) {
          if (body?.status) {
            return await sufra.orders.updateStatus(orderId, body.status);
          }
          return await sufra.orders.update(orderId, body);
        }
      }
      if (method === 'DELETE') {
        // DELETE /orders/dine-in/archived
        if (idOrAction === 'dine-in' && rest[0] === 'archived') {
          return await sufra.orders.clearArchivedDineIn?.() || null;
        }
        // DELETE /orders/pickup/archived
        if (idOrAction === 'pickup' && rest[0] === 'archived') {
          return await sufra.orders.clearArchivedPickup?.() || null;
        }
        // DELETE /orders/pickup/:id
        if (idOrAction === 'pickup' && rest[0] && rest[0] !== 'archived') {
          const orderId = parseInt(rest[0], 10);
          if (orderId) {
            return await sufra.orders.removePickup?.(orderId) || null;
          }
        }
        // DELETE /orders/delivery/archived
        if (idOrAction === 'delivery' && rest[0] === 'archived') {
          return await sufra.orders.clearArchivedDelivery?.() || null;
        }
        // DELETE /orders/delivery/platforms/:id
        if (idOrAction === 'delivery' && rest[0] === 'platforms' && rest[1] && !isNaN(parseInt(rest[1], 10))) {
          const platformId = parseInt(rest[1], 10);
          const fn = sufra.orders.removeDeliveryPlatform;
          if (typeof fn !== 'function') {
            throw new Error(
              'IPC: removeDeliveryPlatform غير متوفر. أعد تشغيل تطبيق Electron بعد التحديث.',
            );
          }
          await fn(platformId);
          return { success: true };
        }
        // DELETE /orders/delivery/:id
        if (idOrAction === 'delivery' && rest[0] && rest[0] !== 'archived') {
          const orderId = parseInt(rest[0], 10);
          if (orderId) {
            return await sufra.orders.removeDelivery?.(orderId) || null;
          }
        }
        const orderId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (orderId) return await sufra.orders.remove(orderId);
      }
    }

    // Halls endpoints
    if (resource === 'halls') {
      if (method === 'GET') {
        // /halls/:id/tables must run before /halls/:id (numeric id matches both)
        if (idOrAction && rest[0] === 'tables') {
          const hallId = parseInt(idOrAction, 10);
          console.log('[IPC] Loading tables for hall:', hallId);
          const result = await sufra.tables.findByHall(hallId);
          console.log('[IPC] Tables loaded:', result);
          return result;
        }
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.halls.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.halls.findAll();
      }
      if (method === 'POST') {
        // Check for /halls/:id/tables - create table in hall
        if (idOrAction && rest[0] === 'tables') {
          const hallId = parseInt(idOrAction, 10);
          // Ensure hall_id is set in body
          const tableData = { ...body, hall_id: hallId };
          console.log('[IPC] Creating table via halls/:id/tables:', { hallId, tableData });
          const result = await sufra.tables.create(tableData);
          console.log('[IPC] Table created successfully:', result);
          return result;
        }
        return await sufra.halls.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const hallId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (hallId) return await sufra.halls.update(hallId, body);
      }
      if (method === 'DELETE') {
        const hallId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (hallId) return await sufra.halls.remove(hallId);
      }
    }

    // Tables endpoints
    if (resource === 'tables') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.tables.findOne(parseInt(idOrAction, 10));
        }
        // GET /tables - get all tables
        return await sufra.tables.findAll();
      }
      if (method === 'POST') {
        return await sufra.tables.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const tableId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (tableId) return await sufra.tables.update(tableId, body);
      }
      if (method === 'DELETE') {
        const tableId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (tableId) return await sufra.tables.remove(tableId);
      }
    }

    // Floors endpoints
    if (resource === 'floors') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.floors.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.floors.findAll();
      }
      if (method === 'POST') {
        return await sufra.floors.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const floorId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (floorId) return await sufra.floors.update(floorId, body);
      }
      if (method === 'DELETE') {
        const floorId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (floorId) return await sufra.floors.remove(floorId);
      }
    }

    // Kitchens endpoints
    if (resource === 'kitchens') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.kitchens.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.kitchens.findAll();
      }
      if (method === 'POST') {
        return await sufra.kitchens.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const kitchenId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (kitchenId) return await sufra.kitchens.update(kitchenId, body);
      }
      if (method === 'DELETE') {
        const kitchenId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (kitchenId) return await sufra.kitchens.remove(kitchenId);
      }
    }

    // Items endpoints
    if (resource === 'items') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.items.findOne(parseInt(idOrAction, 10));
        }
        // Check for kitchen_id query param
        const kitchenIdMatch = endpoint.match(/kitchen_id=(\d+)/);
        const kitchenId = kitchenIdMatch ? parseInt(kitchenIdMatch[1], 10) : undefined;
        return await sufra.items.findAll(kitchenId);
      }
      if (method === 'POST') {
        return await sufra.items.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const itemId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (itemId) return await sufra.items.update(itemId, body);
      }
      if (method === 'DELETE') {
        const itemId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (itemId) return await sufra.items.remove(itemId);
      }
    }

    // Categories endpoints
    if (resource === 'categories') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.categories.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.categories.findAll();
      }
      if (method === 'POST') {
        return await sufra.categories.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        if (idOrAction === 'reorder') {
          const ids = Array.isArray(body?.ids) ? body.ids : [];
          return await sufra.categories.reorder(ids);
        }
        const categoryId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (categoryId) return await sufra.categories.update(categoryId, body);
      }
      if (method === 'DELETE') {
        const categoryId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (categoryId) return await sufra.categories.remove(categoryId);
      }
    }

    // Users endpoints
    if (resource === 'users') {
      if (method === 'GET') {
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.users.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.users.findAll();
      }
      if (method === 'POST') {
        return await sufra.users.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const userId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (userId) return await sufra.users.update(userId, body);
      }
      if (method === 'DELETE') {
        const userId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (userId) return await sufra.users.remove(userId);
      }
    }

    // Offers endpoints
    if (resource === 'offers') {
      if (method === 'GET') {
        if (idOrAction === 'daily-deals') {
          return await sufra.offers.dailyDeals();
        }
        if (idOrAction === 'combos') {
          return await sufra.offers.combos();
        }
        if (idOrAction === 'scheduled-offers') {
          return await sufra.offers.scheduledOffers();
        }
        if (idOrAction === 'happy-hour') {
          return await sufra.offers.happyHour();
        }
        if (idOrAction === 'featured-items') {
          return await sufra.offers.featuredItems();
        }
      }
      if (method === 'POST') {
        if (idOrAction === 'daily-deals') {
          return await sufra.offers.createDailyDeal(body);
        }
        if (idOrAction === 'combos') {
          return await sufra.offers.createCombo(body);
        }
        if (idOrAction === 'scheduled-offers') {
          return await sufra.offers.createScheduledOffer(body);
        }
        if (idOrAction === 'happy-hour') {
          return await sufra.offers.createHappyHour(body);
        }
        if (idOrAction === 'featured-items') {
          const productId = body?.product_id ?? body?.productId;
          const featured = body?.featured !== false;
          if (typeof sufra.offers.setFeatured === 'function') {
            return await sufra.offers.setFeatured(productId, featured);
          }
          return await sufra.offers.createFeaturedItem(body);
        }
      }
      if (method === 'PATCH' || method === 'PUT') {
        const parts = normalizedEndpoint.split('/');
        if (parts[1] === 'daily-deals' && parts[2]) {
          return await sufra.offers.updateDailyDeal(parseInt(parts[2], 10), body);
        }
        if (parts[1] === 'combos' && parts[2]) {
          return await sufra.offers.updateCombo(parseInt(parts[2], 10), body);
        }
        if (parts[1] === 'scheduled-offers' && parts[2]) {
          return await sufra.offers.updateScheduledOffer(parseInt(parts[2], 10), body);
        }
        if (parts[1] === 'happy-hour' && parts[2]) {
          return await sufra.offers.updateHappyHour(parseInt(parts[2], 10), body);
        }
      }
      if (method === 'DELETE') {
        const parts = normalizedEndpoint.split('/');
        if (parts[1] === 'daily-deals' && parts[2]) {
          return await sufra.offers.deleteDailyDeal(parseInt(parts[2], 10));
        }
        if (parts[1] === 'combos' && parts[2]) {
          return await sufra.offers.deleteCombo(parseInt(parts[2], 10));
        }
        if (parts[1] === 'scheduled-offers' && parts[2]) {
          return await sufra.offers.deleteScheduledOffer(parseInt(parts[2], 10));
        }
        if (parts[1] === 'happy-hour' && parts[2]) {
          return await sufra.offers.deleteHappyHour(parseInt(parts[2], 10));
        }
        if (parts[1] === 'featured-items' && parts[2]) {
          return await sufra.offers.deleteFeaturedItem(parseInt(parts[2], 10));
        }
      }
    }

    // Shelves endpoints
    if (resource === 'shelves') {
      if (method === 'GET') {
        if (idOrAction === 'barcode' && rest[0]) {
          // Handle /shelves/barcode/:barcode
          const barcode = decodeURIComponent(rest[0]);
          return await sufra.shelves.findByBarcode(barcode);
        }
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.shelves.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.shelves.findAll();
      }
      if (method === 'POST') {
        if (idOrAction === 'sell') {
          return await sufra.shelves.sell(body);
        }
        return await sufra.shelves.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const shelfId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (shelfId) return await sufra.shelves.update(shelfId, body);
      }
      if (method === 'DELETE') {
        const shelfId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (shelfId) return await sufra.shelves.remove(shelfId);
      }
    }

    // Shifts endpoints
    if (resource === 'shifts') {
      if (method === 'GET') {
        // GET /shifts/active - get currently open shift
        if (idOrAction === 'active' || idOrAction === 'current') {
          return await sufra.shifts.getCurrent();
        }
        // GET /shifts/list - get all shifts
        if (idOrAction === 'list') {
          return await sufra.shifts.findAll();
        }
        // GET /shifts/:id - get specific shift
        if (idOrAction && !isNaN(parseInt(idOrAction, 10))) {
          return await sufra.shifts.findOne(parseInt(idOrAction, 10));
        }
        return await sufra.shifts.findAll();
      }
      if (method === 'POST') {
        // POST /shifts/start - open a new shift
        if (idOrAction === 'start') {
          return await sufra.shifts.start(body);
        }
        // POST /shifts/finish - close the active shift
        if (idOrAction === 'finish') {
          return await sufra.shifts.finish(body);
        }
        return await sufra.shifts.create(body);
      }
      if (method === 'PATCH' || method === 'PUT') {
        if (idOrAction && rest[0] === 'end') {
          return await sufra.shifts.end(parseInt(idOrAction, 10), body);
        }
        const shiftId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (shiftId) return await sufra.shifts.update(shiftId, body);
      }
      if (method === 'DELETE') {
        const shiftId = idOrAction ? parseInt(idOrAction, 10) : null;
        if (shiftId) return await sufra.shifts.remove(shiftId);
      }
    }

    // Finance endpoints
    if (resource === 'finance') {
      if (method === 'GET') {
        // Handle /finance/revenue?from=...&to=...
        if (idOrAction === 'revenue') {
          const urlParams = new URLSearchParams(queryString || '');
          const from = urlParams.get('from') || undefined;
          const to = urlParams.get('to') || undefined;
          // Use revenues method (backend service method name)
          return await sufra.finance.revenues(from, to);
        }
        // Handle /finance/revenues?start_date=...&end_date=... (legacy format)
        if (idOrAction === 'revenues') {
          const urlParams = new URLSearchParams(queryString || '');
          const startDate = urlParams.get('start_date') || urlParams.get('from') || undefined;
          const endDate = urlParams.get('end_date') || urlParams.get('to') || undefined;
          return await sufra.finance.revenues(startDate || undefined, endDate || undefined);
        }
        // Handle /finance/expenses?from=...&to=...
        if (idOrAction === 'expenses') {
          const urlParams = new URLSearchParams(queryString || '');
          const from = urlParams.get('from') || undefined;
          const to = urlParams.get('to') || undefined;
          return await sufra.finance.expenses(from, to);
        }
        // Handle /finance/cashflow?from=...&to=... (no hyphen)
        if (idOrAction === 'cashflow') {
          const urlParams = new URLSearchParams(queryString || '');
          const from = urlParams.get('from') || undefined;
          const to = urlParams.get('to') || undefined;
          return await sufra.finance.cashFlow(from, to);
        }
        // Handle /finance/cash-flow?start_date=...&end_date=... (legacy format with hyphen)
        if (idOrAction === 'cash-flow') {
          const urlParams = new URLSearchParams(queryString || '');
          const startDate = urlParams.get('start_date') || urlParams.get('from') || undefined;
          const endDate = urlParams.get('end_date') || urlParams.get('to') || undefined;
          return await sufra.finance.cashFlow(startDate || undefined, endDate || undefined);
        }
        // Handle /finance/profit?from=...&to=...
        if (idOrAction === 'profit') {
          const urlParams = new URLSearchParams(queryString || '');
          const from = urlParams.get('from') || undefined;
          const to = urlParams.get('to') || undefined;
          return await sufra.finance.profit(from, to);
        }
      }
      if (method === 'POST') {
        // Handle /finance/revenue/sync (check sync first before general revenue)
        // Check multiple conditions to ensure we catch it
        const isRevenueSync = 
          normalizedEndpoint === 'finance/revenue/sync' || 
          normalizedEndpoint.startsWith('finance/revenue/sync') ||
          (idOrAction === 'revenue' && rest && rest.length > 0 && rest[0] === 'sync') ||
          (parts.length === 3 && parts[0] === 'finance' && parts[1] === 'revenue' && parts[2] === 'sync');
        
        if (isRevenueSync) {
          const date = body?.date ?? (typeof body === 'object' && body !== null ? (body as { date?: string }).date : undefined)
            ?? new Date().toISOString().split('T')[0];
          return await sufra.finance.syncRevenue(date);
        }
        // Handle /finance/revenue (create) - but not if it's /sync
        if (idOrAction === 'revenue' && (!rest || rest.length === 0 || rest[0] !== 'sync')) {
          return await sufra.finance.createRevenue(body);
        }
        // Handle /finance/cashflow/sync (check sync first before general cashflow)
        const isCashflowSync = 
          normalizedEndpoint === 'finance/cashflow/sync' || 
          normalizedEndpoint.startsWith('finance/cashflow/sync') ||
          (idOrAction === 'cashflow' && rest && rest.length > 0 && rest[0] === 'sync') ||
          (parts.length === 3 && parts[0] === 'finance' && parts[1] === 'cashflow' && parts[2] === 'sync');
        
        if (isCashflowSync) {
          const date = body?.date ?? (typeof body === 'object' && body !== null ? (body as { date?: string }).date : undefined)
            ?? new Date().toISOString().split('T')[0];
          await sufra.finance.syncCashFlow(date);
          return { success: true };
        }
        // Handle /finance/cashflow (create) - but not if it's /sync
        if (idOrAction === 'cashflow' && (!rest || rest.length === 0 || rest[0] !== 'sync')) {
          return await sufra.finance.createCashFlow(body);
        }
        // Handle /finance/cash-flow (legacy)
        if (idOrAction === 'cash-flow') {
          return await sufra.finance.createCashFlow(body);
        }
        // Handle /finance/revenues (legacy)
        if (idOrAction === 'revenues') {
          return await sufra.finance.createRevenue(body);
        }
        // Handle /finance/expenses (create)
        if (idOrAction === 'expenses') {
          return await sufra.finance.createExpense(body);
        }
        // Handle /finance/export
        if (idOrAction === 'export') {
          return await sufra.finance.export(body);
        }
      }
      if (method === 'PATCH' || method === 'PUT') {
        const parts = normalizedEndpoint.split('/');
        // Handle /finance/expenses/:id
        if (parts[1] === 'expenses' && parts[2]) {
          return await sufra.finance.updateExpense(parseInt(parts[2], 10), body);
        }
      }
      if (method === 'DELETE') {
        const parts = normalizedEndpoint.split('/');
        // Handle /finance/expenses/:id
        if (parts[1] === 'expenses' && parts[2]) {
          return await sufra.finance.deleteExpense(parseInt(parts[2], 10));
        }
      }
    }

    // Business Day endpoints
    if (resource === 'business-day') {
      if (method === 'GET') {
        if (idOrAction === 'current') {
          return await sufra['business-day']?.getCurrent();
        }
      }
      if (method === 'POST') {
        if (idOrAction === 'start') {
          return await sufra['business-day']?.start(body);
        }
        if (idOrAction === 'reset') {
          return await sufra['business-day']?.reset(body);
        }
      }
    }

    // Reports endpoints
    if (resource === 'reports') {
      if (method === 'GET') {
        if (idOrAction === 'daily-summary') {
          return await sufra.reports.dailySummary();
        }
        // Handle /reports/data?period=...&date=...
        if (idOrAction === 'data') {
          const urlParams = new URLSearchParams(queryString || '');
          const period = urlParams.get('period');
          const date = urlParams.get('date');
          if (period && date && sufra.reports.getReport) {
            return await sufra.reports.getReport(period, date);
          }
        }
        // Handle /reports/:period/:date
        if (idOrAction && rest[0] && sufra.reports.getReport) {
          return await sufra.reports.getReport(idOrAction, rest[0]);
        }
      }
    }

    // Settings endpoints
    if (resource === 'settings') {
      if (method === 'GET' && idOrAction === 'shift-hours') {
        return await sufra.settings?.getShiftHours();
      }
      if ((method === 'PUT' || method === 'PATCH') && idOrAction === 'shift-hours') {
        return await sufra.settings?.updateShiftHours(body);
      }
      if (method === 'GET' && idOrAction === 'shift-definitions') {
        return await sufra.settings?.getShiftDefinitions();
      }
      if (method === 'POST' && idOrAction === 'shift-definitions') {
        return await sufra.settings?.createShiftDefinition(body);
      }
      if ((method === 'PUT' || method === 'PATCH') && idOrAction === 'shift-definitions' && rest[0] === 'bulk') {
        return await sufra.settings?.replaceShiftDefinitions(body?.shifts ?? []);
      }
      if ((method === 'PUT' || method === 'PATCH') && idOrAction === 'shift-definitions' && rest[0]) {
        return await sufra.settings?.updateShiftDefinition(parseInt(rest[0], 10), body);
      }
      if (method === 'DELETE' && idOrAction === 'shift-definitions' && rest[0] === 'bulk') {
        return await sufra.settings?.replaceShiftDefinitions([]);
      }
      if (method === 'DELETE' && idOrAction === 'shift-definitions' && rest[0]) {
        return await sufra.settings?.removeShiftDefinition(parseInt(rest[0], 10));
      }
    }

    // Printers endpoints
    if (resource === 'printers') {
      if (method === 'GET') {
        if (idOrAction === 'available') {
          return await sufra.printers.available();
        }
        if (idOrAction === 'settings') {
          return await sufra.printers.getSettings();
        }
      }
      if (method === 'POST') {
        if (idOrAction === 'settings') {
          return await sufra.printers.saveSettings(body);
        }
        if (idOrAction === 'test') {
          return await sufra.printers.test(body);
        }
      }
    }

    // Health endpoint
    if (resource === 'health' && method === 'GET') {
      // Health check handled by backend:health IPC handler
      return { status: 'ok', mode: 'electron' };
    }

    // Endpoint not found in IPC mapping
    return null;
  } catch (error: any) {
    // Don't log expected NotFoundException errors - they're handled gracefully by callers
    const errorMessage = String(error?.message || error || '');
    const isExpectedNotFound = 
      errorMessage.includes('NotFoundException') ||
      errorMessage.includes('Shelf item not found') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('NotFound');
    
    if (!isExpectedNotFound) {
      console.error('[IPC API] Error calling IPC:', error);
    }
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Check if an endpoint can be handled via IPC
 * In Electron mode, ALL endpoints should use IPC (no HTTP fallback)
 */
export function canUseIPC(_endpoint: string, _method: string = 'GET'): boolean {
  if (!isElectron()) {
    return false;
  }
  // In Electron, we should try IPC for all endpoints
  // If it returns null, that means the endpoint isn't mapped yet
  return true;
}

/**
 * Make an API call via IPC if available
 * In Electron mode, this is the ONLY way to communicate with backend
 * NO HTTP FALLBACK
 */
export async function fetchViaIPC(endpoint: string, method: string = 'GET', body?: any): Promise<any | null> {
  if (!isElectron()) {
    return null; // Not in Electron
  }

  try {
    const result = await callIPC(endpoint, method, body);
    return result;
  } catch (error: any) {
    // Don't log expected NotFoundException errors - they're handled gracefully by callers
    const errorMessage = String(error?.message || error || '');
    const isExpectedNotFound = 
      errorMessage.includes('NotFoundException') ||
      errorMessage.includes('Shelf item not found') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('NotFound');
    
    if (!isExpectedNotFound) {
      console.error('[IPC API] Error calling IPC:', error);
    }
    throw error; // Re-throw errors - no HTTP fallback
  }
}
