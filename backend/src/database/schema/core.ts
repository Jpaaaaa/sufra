import * as bcrypt from 'bcrypt';

interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initCoreSchema(helpers: SchemaHelpers) {
  const { runSync, getSync, db } = helpers;

  // Shifts table - tracks work shifts within business days
  runSync(
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_by INTEGER NOT NULL,
      ended_by INTEGER,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      total_sales INTEGER DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      total_items_sold INTEGER DEFAULT 0,
      payment_breakdown TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(started_by) REFERENCES users(id),
      FOREIGN KEY(ended_by) REFERENCES users(id)
    )`,
  );

  // Migration: Migrate old shifts table to new schema if needed
  const shiftsOpenedAtCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('shifts') WHERE name='openedAt'",
  );
  if (shiftsOpenedAtCheck && shiftsOpenedAtCheck.cnt > 0) {
    // Old schema exists - migrate it
    console.log('🔄 Migrating shifts table to new schema...');

    // Rename old table
    try {
      runSync('ALTER TABLE shifts RENAME TO shifts_old');

      // Create new table
      runSync(
        `CREATE TABLE shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_by INTEGER NOT NULL,
          ended_by INTEGER,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
          total_sales INTEGER DEFAULT 0,
          total_orders INTEGER DEFAULT 0,
          total_items_sold INTEGER DEFAULT 0,
          payment_breakdown TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(started_by) REFERENCES users(id),
          FOREIGN KEY(ended_by) REFERENCES users(id)
        )`,
      );

      // Copy data from old table (if any)
      try {
        runSync(
          `INSERT INTO shifts (id, start_time, end_time, status, created_at)
           SELECT id, openedAt, closedAt, 
                  CASE WHEN closedAt IS NULL THEN 'open' ELSE 'closed' END,
                  COALESCE(openedAt, datetime('now'))
           FROM shifts_old`,
        );

        // Drop old table
        runSync('DROP TABLE shifts_old');
        console.log('✅ Successfully migrated shifts table');
      } catch (error) {
        console.error('Failed to copy shifts data', error);
      }
    } catch (error) {
      console.error('Failed to rename shifts table', error);
    }
  } else {
    // Check if new columns exist, add them if missing
    const shiftsStartedByCheck = getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('shifts') WHERE name='started_by'",
    );
    if (shiftsStartedByCheck && shiftsStartedByCheck.cnt === 0) {
      // Table exists but missing new columns - add them
      console.log('🔄 Adding new columns to shifts table...');

      // Get admin user ID as default
      const userRow = getSync('SELECT id FROM users WHERE role = "admin" LIMIT 1');
      const defaultUserId = userRow?.id || 1;

      // Add new columns one by one
      try {
        runSync('ALTER TABLE shifts ADD COLUMN started_by INTEGER');
      } catch (error) {
        console.error('[DB] Failed to add started_by', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN ended_by INTEGER');
      } catch (error) {
        console.error('[DB] Failed to add ended_by', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN start_time DATETIME');
      } catch (error) {
        console.error('[DB] Failed to add start_time', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN end_time DATETIME');
      } catch (error) {
        console.error('[DB] Failed to add end_time', error);
      }
      try {
        runSync("ALTER TABLE shifts ADD COLUMN status TEXT DEFAULT 'open'");
      } catch (error) {
        console.error('[DB] Failed to add status', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN total_sales INTEGER DEFAULT 0');
      } catch (error) {
        console.error('[DB] Failed to add total_sales', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN total_orders INTEGER DEFAULT 0');
      } catch (error) {
        console.error('[DB] Failed to add total_orders', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN total_items_sold INTEGER DEFAULT 0');
      } catch (error) {
        console.error('[DB] Failed to add total_items_sold', error);
      }
      try {
        runSync('ALTER TABLE shifts ADD COLUMN payment_breakdown TEXT');
      } catch (error) {
        console.error('[DB] Failed to add payment_breakdown', error);
      }

      // Migrate existing data
      try {
        runSync(
          `UPDATE shifts 
           SET started_by = ?, 
               start_time = COALESCE(openedAt, datetime('now')),
               end_time = closedAt,
               status = CASE WHEN closedAt IS NULL THEN 'open' ELSE 'closed' END
           WHERE started_by IS NULL`,
          [defaultUserId],
        );
        console.log('✅ Successfully added new columns to shifts table');
      } catch (error) {
        console.error('Failed to update existing shifts', error);
      }
    }
  }

  runSync(
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      generatedAt TEXT NOT NULL
    )`,
  );

  // Business days table
  runSync(
    `CREATE TABLE IF NOT EXISTS business_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_at DATETIME NOT NULL,
      end_at DATETIME,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  // Users table
  runSync(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  // Migration: Add require_captain_approval column to users table if it doesn't exist
  const usersRequireCaptainCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='require_captain_approval'",
  );
  if (usersRequireCaptainCheck && usersRequireCaptainCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE users ADD COLUMN require_captain_approval INTEGER DEFAULT 0');
      console.log('[DB] ✅ Added require_captain_approval column to users table');
    } catch (error) {
      console.error('[DB] Failed to add require_captain_approval to users', error);
    }
  }

  // Migration: Add customer_free_order column to users table if it doesn't exist
  const usersCustomerFreeOrderCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='customer_free_order'",
  );
  if (usersCustomerFreeOrderCheck && usersCustomerFreeOrderCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE users ADD COLUMN customer_free_order INTEGER DEFAULT 0');
      console.log('[DB] ✅ Added customer_free_order column to users table');
    } catch (error) {
      console.error('[DB] Failed to add customer_free_order to users', error);
    }
  }

  // Migration: Update users table CHECK constraint to include 'customer' role
  // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
  const usersTableCheck = getSync(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'",
  );
  if (usersTableCheck && usersTableCheck.sql && !usersTableCheck.sql.includes("'customer'") && !helpers.migrationInProgress.value) {
    helpers.migrationInProgress.value = true;
    console.log('[DB] 🔄 Migrating users table to include customer role...');

    // Begin transaction
    try {
      runSync('BEGIN TRANSACTION');

      // Create new table with correct constraint
      runSync(
        `CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer')),
          require_captain_approval INTEGER DEFAULT 0,
          customer_free_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      );

      // Copy all data from old table to new table
      runSync(
        `INSERT INTO users_new (id, username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at)
         SELECT id, username, password_hash, role, 
                COALESCE(require_captain_approval, 0) as require_captain_approval,
                COALESCE(customer_free_order, 0) as customer_free_order,
                created_at, updated_at
         FROM users`,
      );

      // Drop old table
      runSync('DROP TABLE users');

      // Rename new table to users
      runSync('ALTER TABLE users_new RENAME TO users');

      // Commit transaction
      runSync('COMMIT');
      console.log('[DB] ✅ Successfully migrated users table to include customer role');
      helpers.migrationInProgress.value = false;
    } catch (error) {
      console.error('[DB] Failed to migrate users table', error);
      try {
        runSync('ROLLBACK');
      } catch (rollbackError) {
        console.error('[DB] Failed to rollback transaction', rollbackError);
      }
      helpers.migrationInProgress.value = false;
    }
  }

  // Seed default admin user if users table is empty
  const usersCount = getSync('SELECT COUNT(*) as count FROM users');
  if (usersCount && usersCount.count === 0) {
    // Hash default password 'admin123'
    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);

    try {
      runSync(
        'INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
        ['admin', defaultPasswordHash, 'admin'],
      );
      console.log('[DB] ✅ Seeded default admin user (username: admin, password: admin123)');
    } catch (error) {
      console.error('[DB] Failed to seed default admin user', error);
    }
  }

  // Seed active business day if none exists
  const businessDaysCount = getSync('SELECT COUNT(*) as count FROM business_days WHERE is_active = 1');
  if (businessDaysCount && businessDaysCount.count === 0) {
    try {
      runSync('INSERT INTO business_days (start_at, is_active) VALUES (datetime("now"), 1)');
      console.log('[DB] ✅ Seeded initial business day');
    } catch (error) {
      console.error('[DB] Failed to seed business day', error);
    }
  }
}

