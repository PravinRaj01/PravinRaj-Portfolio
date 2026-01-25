-- Add mode settings columns to site_settings table
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS professional_mode_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS creative_mode_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_mode character varying DEFAULT 'professional';

-- Update existing rows with default values
UPDATE public.site_settings 
SET professional_mode_enabled = true, 
    creative_mode_enabled = true,
    default_mode = 'professional'
WHERE professional_mode_enabled IS NULL;