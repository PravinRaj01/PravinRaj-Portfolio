-- Add certificate fields to experiences table
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS certificate_url text;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS certificate_drive_id text;