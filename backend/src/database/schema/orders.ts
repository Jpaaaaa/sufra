interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

function createTablesTable(helpers: SchemaHelpers) {
  const { runSync } = helpers;
  try {
    runSync(
      `CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hall_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
      )`,
    );
  } catch (error) {
    console.error('[DB] Failed to create tables table', error);
  }
}

export function initOrdersSchema(helpers: SchemaHelpers) {
  const { runSync, getSync, run } = helpers;

  // Orders and order items
  runSync(
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      order_type TEXT DEFAULT 'dine-in',
      status TEXT DEFAULT 'pending',
      total INTEGER NOT NULL DEFAULT 0,
      discount INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(table_id) REFERENCES tables(id)
    )`,
  );

  // Migration: Add discount column to existing orders table if it doesn't exist
  const ordersDiscountCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='discount'",
  );
  if (ordersDiscountCheck && ordersDiscountCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN discount INTEGER DEFAULT 0');
      console.log('[DB] ✅ Added discount column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add discount to orders', error);
    }
  }

  // Migration: Add globalDiscount column to existing orders table if it doesn't exist
  const ordersGlobalDiscountCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='globalDiscount'",
  );
  if (ordersGlobalDiscountCheck && ordersGlobalDiscountCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN globalDiscount TEXT');
      console.log('[DB] ✅ Added globalDiscount column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add globalDiscount to orders', error);
    }
  }

  // Migration: Add order_type column to existing orders table if it doesn't exist
  const ordersOrderTypeCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='order_type'",
  );
  if (ordersOrderTypeCheck && ordersOrderTypeCheck.cnt === 0) {
    try {
      runSync("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine-in'");
      console.log('[DB] ✅ Added order_type column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add order_type to orders', error);
    }
  }

  // Migration: Add customer_name column to existing orders table if it doesn't exist
  const ordersCustomerNameCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_name'",
  );
  if (ordersCustomerNameCheck && ordersCustomerNameCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN customer_name TEXT');
      console.log('[DB] ✅ Added customer_name column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add customer_name to orders', error);
    }
  }

  // Migration: Add customer_phone column to existing orders table if it doesn't exist
  const ordersCustomerPhoneCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_phone'",
  );
  if (ordersCustomerPhoneCheck && ordersCustomerPhoneCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
      console.log('[DB] ✅ Added customer_phone column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add customer_phone to orders', error);
    }
  }

  // Migration: Add customer_location column to existing orders table if it doesn't exist
  const ordersCustomerLocationCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='customer_location'",
  );
  if (ordersCustomerLocationCheck && ordersCustomerLocationCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN customer_location TEXT');
      console.log('[DB] ✅ Added customer_location column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add customer_location to orders', error);
    }
  }

  // Migration: Add note column to existing orders table if it doesn't exist
  const ordersNoteCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('orders') WHERE name='note'",
  );
  if (ordersNoteCheck && ordersNoteCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE orders ADD COLUMN note TEXT');
      console.log('[DB] ✅ Added note column to orders table');
    } catch (error) {
      console.error('[DB] Failed to add note to orders', error);
    }
  }

  runSync(
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price INTEGER NOT NULL,
      kitchen_id INTEGER,
      service_type TEXT DEFAULT 'dine-in',
      shelf_item_id INTEGER,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(kitchen_id) REFERENCES kitchens(id),
      FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE SET NULL
    )`,
  );

  // Table locks - tracks which tables are unlocked by captain
  run(
    `CREATE TABLE IF NOT EXISTS table_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL UNIQUE,
      unlocked_by_user_id INTEGER NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE,
      FOREIGN KEY(unlocked_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  );

  // Customer table locks - tracks which table each customer is locked to
  run(
    `CREATE TABLE IF NOT EXISTS customer_table_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      table_id INTEGER NOT NULL,
      locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE
    )`,
  );

  // Migration: Add service_type column to existing order_items table if it doesn't exist
  const orderItemsServiceTypeCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='service_type'",
  );
  if (orderItemsServiceTypeCheck && orderItemsServiceTypeCheck.cnt === 0) {
    try {
      runSync("ALTER TABLE order_items ADD COLUMN service_type TEXT DEFAULT 'dine-in'");
      console.log('[DB] ✅ Added service_type column to order_items table');
    } catch (error) {
      console.error('[DB] Failed to add service_type to order_items', error);
    }
  }

  // Migration: Add shelf_item_id column to existing order_items table if it doesn't exist
  const orderItemsShelfItemIdCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('order_items') WHERE name='shelf_item_id'",
  );
  if (orderItemsShelfItemIdCheck && orderItemsShelfItemIdCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE order_items ADD COLUMN shelf_item_id INTEGER');
      console.log('[DB] ✅ Added shelf_item_id column to order_items table');
    } catch (error) {
      console.error('[DB] Failed to add shelf_item_id to order_items', error);
    }
  }

  // Migration: Migrate from table_number to name column
  // Check if table_number column exists (old schema) - MUST run BEFORE CREATE TABLE
  let tablesTableNumberCheck;
  try {
    tablesTableNumberCheck = getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('tables') WHERE name='table_number'",
    );
  } catch (error) {
    // Table might not exist yet, that's fine - continue to create it
    console.log('[DB] Tables table does not exist yet, will create with new schema');
    createTablesTable(helpers);
    tablesTableNumberCheck = null;
  }

  if (tablesTableNumberCheck && tablesTableNumberCheck.cnt > 0) {
    // Old schema exists with table_number - need to recreate table
    console.log('[DB] 🔄 Detected old schema with table_number, migrating to name...');

    // Step 1: Rename existing tables table to tables_old
    try {
      runSync('ALTER TABLE tables RENAME TO tables_old');

      // Step 2: Create new tables table without table_number
      runSync(
        `CREATE TABLE tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hall_id INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
        )`,
      );

      // Step 3: Copy data from old table to new table
      // Check if name column exists in old table
      let nameCheckRow;
      try {
        nameCheckRow = getSync(
          "SELECT COUNT(*) as cnt FROM pragma_table_info('tables_old') WHERE name='name'",
        );
      } catch (error) {
        nameCheckRow = null;
      }

      const hasNameColumn = nameCheckRow && nameCheckRow.cnt > 0;

      const insertQuery = hasNameColumn
        ? `INSERT INTO tables (id, name, hall_id, created_at, updated_at)
           SELECT 
             id,
             COALESCE(
               NULLIF(name, ''),
               'طاولة ' || CAST(table_number AS TEXT)
             ) AS name,
             hall_id,
             COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at,
             COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
           FROM tables_old`
        : `INSERT INTO tables (id, name, hall_id, created_at, updated_at)
           SELECT 
             id,
             'طاولة ' || CAST(table_number AS TEXT) AS name,
             hall_id,
             COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at,
             COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
           FROM tables_old`;

      try {
        runSync(insertQuery);

        // Step 4: Drop the old table
        runSync('DROP TABLE tables_old');
        console.log('[DB] ✅ Successfully migrated tables table: removed table_number column');
      } catch (error) {
        console.error('[DB] Failed to copy data from old tables table', error);
      }
    } catch (error) {
      console.error('[DB] Failed to rename tables table', error);
      // Try to continue anyway - maybe table doesn't exist
      createTablesTable(helpers);
    }
  } else {
    // No table_number column - check if table exists, if not create it
    let tableExistsRow;
    try {
      tableExistsRow = getSync(
        "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='tables'",
      );
    } catch (error) {
      tableExistsRow = null;
    }

    if (!tableExistsRow || tableExistsRow.cnt === 0) {
      // Table doesn't exist, create it
      createTablesTable(helpers);
    }
    // Table exists with correct schema, nothing to do
  }

  // Create floors table first (needed for halls FK)
  runSync(
    `CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      floor_number INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  runSync(
    `CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hall_number INTEGER NOT NULL,
      floor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(floor_id) REFERENCES floors(id) ON DELETE SET NULL
    )`,
  );

  // Migration: Add floor_id column to existing halls table if it doesn't exist
  const hallsFloorIdCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('halls') WHERE name='floor_id'",
  );
  if (hallsFloorIdCheck && hallsFloorIdCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE halls ADD COLUMN floor_id INTEGER');
      console.log('[DB] ✅ Added floor_id column to halls table');
    } catch (error) {
      console.error('[DB] Failed to add floor_id to halls', error);
    }
  }
}

