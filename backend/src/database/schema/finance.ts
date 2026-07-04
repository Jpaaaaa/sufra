interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initFinanceSchema(helpers: SchemaHelpers) {
  const { runSync, getSync, allSync } = helpers;

  // Finance tables - NEW SCHEMA with business_day_id
  runSync(
    `CREATE TABLE IF NOT EXISTS revenues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_day_id INTEGER,
      date TEXT,
      type TEXT CHECK(type IN ('daily', 'weekly', 'monthly', 'yearly', 'extra')),
      amount INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_day_id) REFERENCES business_days(id) ON DELETE SET NULL
    )`,
  );

  // Migration: Add business_day_id to revenues if it doesn't exist
  const revenuesBusinessDayCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('revenues') WHERE name='business_day_id'",
  );
  if (revenuesBusinessDayCheck && revenuesBusinessDayCheck.cnt === 0) {
    try {
      console.log('[DB] ⚠️ Adding business_day_id to revenues table...');
      runSync('ALTER TABLE revenues ADD COLUMN business_day_id INTEGER REFERENCES business_days(id) ON DELETE SET NULL');
      console.log('[DB] ✅ Added business_day_id column to revenues table');
      
      // Migrate existing revenues: match date to business_day start date
      console.log('[DB] 🔄 Migrating existing revenues to business days...');
      const revenues = allSync('SELECT id, date FROM revenues WHERE business_day_id IS NULL');
      
      for (const revenue of revenues) {
        if (revenue.date) {
          // Find business day that started on this date
          const businessDay = getSync(
            "SELECT id FROM business_days WHERE DATE(start_at) = DATE(?) ORDER BY start_at DESC LIMIT 1",
            [revenue.date]
          );
          
          if (businessDay) {
            runSync('UPDATE revenues SET business_day_id = ? WHERE id = ?', [businessDay.id, revenue.id]);
          }
        }
      }
      console.log('[DB] ✅ Migrated revenues to business days');
    } catch (error) {
      console.error('[DB] Failed to add business_day_id to revenues', error);
    }
  }

  // Create expenses table with correct schema - NEW SCHEMA with business_day_id
  runSync(
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_day_id INTEGER,
      date TEXT,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      notes TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_day_id) REFERENCES business_days(id) ON DELETE SET NULL
    )`,
  );

  // Migration: Check if expenses table has old schema and migrate it
  const expensesDateCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='date'",
  );
  if (expensesDateCheck && expensesDateCheck.cnt === 0) {
    // Old schema exists (has description, createdAt instead of date, category, notes, user_id, created_at)
    // Check if it has the old columns
    const expensesDescriptionCheck = getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='description'",
    );
    if (expensesDescriptionCheck && expensesDescriptionCheck.cnt > 0) {
      // Old schema detected - need to migrate
      console.log('[DB] ⚠️ Detected old expenses table schema. Migrating...');

      // Create new table with temp name
      try {
        runSync(
          `CREATE TABLE expenses_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            amount INTEGER NOT NULL,
            notes TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
        );

        // Copy data from old to new (use createdAt as date, description as category)
        runSync(
          `INSERT INTO expenses_new (id, date, category, amount, notes, user_id, created_at)
           SELECT id, 
                  COALESCE(createdAt, datetime('now')) as date,
                  COALESCE(description, 'Uncategorized') as category,
                  amount,
                  NULL as notes,
                  NULL as user_id,
                  COALESCE(createdAt, datetime('now')) as created_at
           FROM expenses`,
        );

        // Drop old table and rename new one
        runSync('DROP TABLE expenses');
        runSync('ALTER TABLE expenses_new RENAME TO expenses');
        console.log('[DB] ✅ Migrated expenses table to new schema');
      } catch (error) {
        console.error('[DB] Failed to migrate expenses table', error);
      }
    }
  } else {
    // New schema already exists, but check if category column exists
    const expensesCategoryCheck = getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='category'",
    );
    if (expensesCategoryCheck && expensesCategoryCheck.cnt === 0) {
      // Has date but no category - add missing columns
      try {
        runSync('ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT "Uncategorized"');
        console.log('[DB] ✅ Added category column to expenses table');
      } catch (error) {
        console.error('[DB] Failed to add category to expenses', error);
      }
    }
  }

  // Migration: Add business_day_id to expenses if it doesn't exist
  const expensesBusinessDayCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='business_day_id'",
  );
  if (expensesBusinessDayCheck && expensesBusinessDayCheck.cnt === 0) {
    try {
      console.log('[DB] ⚠️ Adding business_day_id to expenses table...');
      runSync('ALTER TABLE expenses ADD COLUMN business_day_id INTEGER REFERENCES business_days(id) ON DELETE SET NULL');
      console.log('[DB] ✅ Added business_day_id column to expenses table');
      
      // Migrate existing expenses: match date to business_day start date
      console.log('[DB] 🔄 Migrating existing expenses to business days...');
      const expenses = allSync('SELECT id, date FROM expenses WHERE business_day_id IS NULL');
      
      for (const expense of expenses) {
        if (expense.date) {
          // Find business day that started on this date
          const businessDay = getSync(
            "SELECT id FROM business_days WHERE DATE(start_at) = DATE(?) ORDER BY start_at DESC LIMIT 1",
            [expense.date]
          );
          
          if (businessDay) {
            runSync('UPDATE expenses SET business_day_id = ? WHERE id = ?', [businessDay.id, expense.id]);
          }
        }
      }
      console.log('[DB] ✅ Migrated expenses to business days');
    } catch (error) {
      console.error('[DB] Failed to add business_day_id to expenses', error);
    }
  }

  // Migration: Add recurring expense fields
  const expensesRecurringCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('expenses') WHERE name='is_recurring'",
  );
  if (expensesRecurringCheck && expensesRecurringCheck.cnt === 0) {
    // Add recurring expense fields
    try {
      runSync(`ALTER TABLE expenses ADD COLUMN is_recurring INTEGER DEFAULT 0`);
      console.log('[DB] ✅ Added is_recurring column to expenses table');
    } catch (error) {
      console.error('[DB] Failed to add is_recurring column', error);
    }

    try {
      runSync(`ALTER TABLE expenses ADD COLUMN recurrence_type TEXT`);
      console.log('[DB] ✅ Added recurrence_type column to expenses table');
    } catch (error) {
      console.error('[DB] Failed to add recurrence_type column', error);
    }

    try {
      runSync(`ALTER TABLE expenses ADD COLUMN recurrence_interval INTEGER DEFAULT 1`);
      console.log('[DB] ✅ Added recurrence_interval column to expenses table');
    } catch (error) {
      console.error('[DB] Failed to add recurrence_interval column', error);
    }

    try {
      runSync(`ALTER TABLE expenses ADD COLUMN next_occurrence_date TEXT`);
      console.log('[DB] ✅ Added next_occurrence_date column to expenses table');
    } catch (error) {
      console.error('[DB] Failed to add next_occurrence_date column', error);
    }
  }

  runSync(
    `CREATE TABLE IF NOT EXISTS cash_flow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_day_id INTEGER,
      date TEXT,
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      reason TEXT NOT NULL,
      amount INTEGER NOT NULL,
      linked_order_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_day_id) REFERENCES business_days(id) ON DELETE SET NULL,
      FOREIGN KEY(linked_order_id) REFERENCES orders(id) ON DELETE SET NULL
    )`,
  );

  // Migration: Add business_day_id to cash_flow if it doesn't exist
  const cashFlowBusinessDayCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('cash_flow') WHERE name='business_day_id'",
  );
  if (cashFlowBusinessDayCheck && cashFlowBusinessDayCheck.cnt === 0) {
    try {
      console.log('[DB] ⚠️ Adding business_day_id to cash_flow table...');
      runSync('ALTER TABLE cash_flow ADD COLUMN business_day_id INTEGER REFERENCES business_days(id) ON DELETE SET NULL');
      console.log('[DB] ✅ Added business_day_id column to cash_flow table');
      
      // Migrate existing cash_flow: match date to business_day start date
      console.log('[DB] 🔄 Migrating existing cash_flow to business days...');
      const cashFlows = allSync('SELECT id, date FROM cash_flow WHERE business_day_id IS NULL');
      
      for (const cashFlow of cashFlows) {
        if (cashFlow.date) {
          // Find business day that started on this date
          const businessDay = getSync(
            "SELECT id FROM business_days WHERE DATE(start_at) = DATE(?) ORDER BY start_at DESC LIMIT 1",
            [cashFlow.date]
          );
          
          if (businessDay) {
            runSync('UPDATE cash_flow SET business_day_id = ? WHERE id = ?', [businessDay.id, cashFlow.id]);
          }
        }
      }
      console.log('[DB] ✅ Migrated cash_flow to business days');
    } catch (error) {
      console.error('[DB] Failed to add business_day_id to cash_flow', error);
    }
  }
}

