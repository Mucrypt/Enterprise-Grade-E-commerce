-- Migration: Add stock_quantity column to products table
-- This column tracks the number of items currently in stock

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN products.stock_quantity IS 'Number of items currently in stock';
