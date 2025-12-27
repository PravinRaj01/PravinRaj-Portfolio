-- First, delete duplicate site_settings rows keeping only the most recent one
DELETE FROM site_settings 
WHERE id NOT IN (
  SELECT id FROM site_settings ORDER BY created_at DESC LIMIT 1
);

-- Make credential_id optional in certifications
ALTER TABLE certifications ALTER COLUMN credential_id DROP NOT NULL;

-- Add credential_url column for linking to credential verification
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS credential_url TEXT;