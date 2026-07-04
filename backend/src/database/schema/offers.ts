interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initOffersSchema(helpers: SchemaHelpers) {
  const { runSync } = helpers;

  // Offers tables
  // Daily deals table
  runSync(
    `CREATE TABLE IF NOT EXISTS daily_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      special_price INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
    )`,
  );

  // Combos table - stores combo offer configuration
  runSync(
    `CREATE TABLE IF NOT EXISTS combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_name TEXT NOT NULL,
      combo_price INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  // Combo items - links products to combos
  runSync(
    `CREATE TABLE IF NOT EXISTS combo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      FOREIGN KEY(combo_id) REFERENCES combos(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
    )`,
  );

  // Scheduled offers table
  runSync(
    `CREATE TABLE IF NOT EXISTS scheduled_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      combo_id INTEGER,
      special_price INTEGER NOT NULL,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY(combo_id) REFERENCES combos(id) ON DELETE CASCADE,
      CHECK((product_id IS NOT NULL AND combo_id IS NULL) OR (product_id IS NULL AND combo_id IS NOT NULL))
    )`,
  );

  // Featured items table
  runSync(
    `CREATE TABLE IF NOT EXISTS featured_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE,
      featured INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
    )`,
  );

  // Happy hour table
  runSync(
    `CREATE TABLE IF NOT EXISTS happy_hour (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      happy_hour_price INTEGER NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES items(id) ON DELETE CASCADE
    )`,
  );
}

