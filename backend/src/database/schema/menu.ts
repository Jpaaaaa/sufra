interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initMenuSchema(helpers: SchemaHelpers) {
  const { runSync, getSync, db } = helpers;

  // Core tables
  runSync(
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`,
  );

  // Create kitchens table first (needed for items FK)
  runSync(
    `CREATE TABLE IF NOT EXISTS kitchens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      floor_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(floor_id) REFERENCES floors(id) ON DELETE SET NULL
    )`,
  );

  // Migration: Add floor_id column to existing kitchens table if it doesn't exist
  const kitchensFloorIdCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('kitchens') WHERE name='floor_id'",
  );
  if (kitchensFloorIdCheck && kitchensFloorIdCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE kitchens ADD COLUMN floor_id INTEGER');
      console.log('[DB] ✅ Added floor_id column to kitchens table');
    } catch (error) {
      console.error('[DB] Failed to add floor_id to kitchens', error);
    }
  }

  runSync(
    `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      categoryId INTEGER,
      kitchen_id INTEGER,
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (kitchen_id) REFERENCES kitchens(id)
    )`,
  );

  // Migration: Add kitchen_id column to existing items table if it doesn't exist
  const itemsKitchenIdCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='kitchen_id'",
  );
  if (itemsKitchenIdCheck && itemsKitchenIdCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE items ADD COLUMN kitchen_id INTEGER');
      console.log('[DB] ✅ Added kitchen_id column to items table');
    } catch (error) {
      console.error('[DB] Failed to add kitchen_id to items', error);
    }
  }

  // Migration: Add image_url column to existing items table if it doesn't exist
  const itemsImageUrlCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='image_url'",
  );
  if (itemsImageUrlCheck && itemsImageUrlCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE items ADD COLUMN image_url TEXT');
      console.log('[DB] ✅ Added image_url column to items table');
    } catch (error) {
      console.error('[DB] Failed to add image_url to items', error);
    }
  }

  // Migration: Add is_out_of_stock column to existing items table if it doesn't exist
  const itemsStockCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='is_out_of_stock'",
  );
  if (itemsStockCheck && itemsStockCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE items ADD COLUMN is_out_of_stock INTEGER DEFAULT 0');
      console.log('[DB] ✅ Added is_out_of_stock column to items table');
    } catch (error) {
      console.error('[DB] Failed to add is_out_of_stock to items', error);
    }
  }

  // Migration: Add description column to items (short description / components of food)
  const itemsDescCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('items') WHERE name='description'",
  );
  if (itemsDescCheck && itemsDescCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE items ADD COLUMN description TEXT');
      console.log('[DB] ✅ Added description column to items table');
    } catch (error) {
      console.error('[DB] Failed to add description to items', error);
    }
  }

  // Shelf items table for barcoded products
  runSync(
    `CREATE TABLE IF NOT EXISTS shelf_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  // Shelf sales table
  runSync(
    `CREATE TABLE IF NOT EXISTS shelf_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shelf_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shelf_item_id) REFERENCES shelf_items(id) ON DELETE CASCADE
    )`,
  );

  // Seed basic categories/items if empty
  const categoriesCount = getSync('SELECT COUNT(*) as count FROM categories');
  if (categoriesCount && categoriesCount.count === 0) {
    const stmtCat = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const baseCategories = ['مشويات', 'مقبلات', 'مشروبات'];
    baseCategories.forEach((name) => {
      stmtCat.bind([name]);
      stmtCat.step();
    });
    stmtCat.free();

    const stmtItem = db.prepare('INSERT INTO items (name, price, categoryId) VALUES (?, ?, ?)');
    stmtItem.bind(['كباب', 5000, 1]);
    stmtItem.step();
    stmtItem.reset();
    stmtItem.bind(['تبولة', 3000, 2]);
    stmtItem.step();
    stmtItem.reset();
    stmtItem.bind(['بيبسي', 1000, 3]);
    stmtItem.step();
    stmtItem.free();
  }
}

