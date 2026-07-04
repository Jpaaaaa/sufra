-- Migration to drop pickup_orders and delivery_orders tables
-- These tables are no longer needed as we're only supporting dine-in orders

-- Drop delivery_orders table
DROP TABLE IF EXISTS delivery_orders;

-- Drop pickup_orders table
DROP TABLE IF EXISTS pickup_orders;

