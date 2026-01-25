-- Add new columns to experiences table for flexible date handling and creative mode
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS experience_type text DEFAULT 'job';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS date_type text DEFAULT 'range';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS event_date text;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS event_images text[] DEFAULT '{}';

-- Add thumbnail toggle to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS include_thumbnail_in_gallery boolean DEFAULT true;