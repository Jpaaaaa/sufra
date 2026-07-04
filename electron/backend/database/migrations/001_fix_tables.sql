-- Migration: Remove table_number column from tables table
-- This migration recreates the tables table without table_number
-- and migrates data from table_number to name if needed

BEGIN;

-- Step 1: Rename existing tables table to tables_old
ALTER TABLE tables RENAME TO tables_old;

-- Step 2: Create new tables table without table_number
CREATE TABLE tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hall_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
);

-- Step 3: Copy data from old table to new table
-- If name is empty/null, use table_number to create a name
INSERT INTO tables (id, name, hall_id, created_at, updated_at)
SELECT 
  id,
  COALESCE(
    NULLIF(name, ''),
    'طاولة ' || CAST(table_number AS TEXT)
  ) AS name,
  hall_id,
  COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at,
  COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
FROM tables_old;

-- Step 4: Drop the old table
DROP TABLE tables_old;

COMMIT;

