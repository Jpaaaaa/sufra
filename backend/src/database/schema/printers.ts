interface SchemaHelpers {
  runSync: (sql: string, params?: any[]) => void;
  getSync: (sql: string, params?: any[]) => any;
  allSync: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => Promise<void>;
  db: any;
  migrationInProgress: { value: boolean };
}

export function initPrintersSchema(helpers: SchemaHelpers) {
  const { runSync, getSync, allSync } = helpers;

  // Printer settings table
  runSync(
    `CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitchen_id INTEGER,
      printer_ip TEXT,
      printer_port INTEGER DEFAULT 9100,
      printer_type TEXT NOT NULL CHECK(printer_type IN ('kitchen', 'customer')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(kitchen_id) REFERENCES kitchens(id) ON DELETE CASCADE
    )`,
  );

  // Migration: Add printer_ip and printer_port columns if they don't exist
  const printerIpCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_ip'",
  );
  if (printerIpCheck && printerIpCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE printer_settings ADD COLUMN printer_ip TEXT');
      console.log('[DB] ✅ Added printer_ip column to printer_settings table');
    } catch (error) {
      console.error('[DB] Failed to add printer_ip to printer_settings', error);
    }
  }

  const printerPortCheck = getSync(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_port'",
  );
  if (printerPortCheck && printerPortCheck.cnt === 0) {
    try {
      runSync('ALTER TABLE printer_settings ADD COLUMN printer_port INTEGER DEFAULT 9100');
      console.log('[DB] ✅ Added printer_port column to printer_settings table');
    } catch (error) {
      console.error('[DB] Failed to add printer_port to printer_settings', error);
    }
  }

  // Migration: Migrate printer_name to printer_ip if printer_name exists but printer_ip is null
  // This allows existing installations to migrate their data
  try {
    const migrateCheck = getSync(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('printer_settings') WHERE name='printer_name'",
    );
    if (migrateCheck && migrateCheck.cnt > 0) {
      // Check if there are rows with printer_name but no printer_ip
      const rowsToMigrate = allSync(
        "SELECT id, printer_name FROM printer_settings WHERE printer_ip IS NULL AND printer_name IS NOT NULL AND printer_name != ''",
      );
      if (rowsToMigrate && rowsToMigrate.length > 0) {
        console.log(`[MIGRATION] Found ${rowsToMigrate.length} printer settings to migrate from printer_name to printer_ip`);
        // Note: We can't automatically convert printer names to IPs, so we'll leave them null
        // Users will need to reconfigure their printers with IP addresses
      }
    }
  } catch (error) {
    console.error('Failed to check printer_name migration', error);
  }
}

