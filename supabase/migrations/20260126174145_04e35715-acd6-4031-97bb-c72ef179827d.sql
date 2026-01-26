-- Add new array columns for multiple categories and positions
ALTER TABLE projects ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS positions text[] DEFAULT '{}';

-- Migrate existing data: copy single category/position to arrays if arrays are empty
UPDATE projects SET categories = ARRAY[category] WHERE category IS NOT NULL AND category != '' AND (categories IS NULL OR array_length(categories, 1) IS NULL);
UPDATE projects SET positions = ARRAY[position] WHERE position IS NOT NULL AND position != '' AND (positions IS NULL OR array_length(positions, 1) IS NULL);