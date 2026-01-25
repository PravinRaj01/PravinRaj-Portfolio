-- Add mode-specific site name and logo columns
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS professional_site_name character varying,
ADD COLUMN IF NOT EXISTS professional_logo_url text,
ADD COLUMN IF NOT EXISTS creative_site_name character varying,
ADD COLUMN IF NOT EXISTS creative_logo_url text;

-- Set default values from existing columns
UPDATE public.site_settings 
SET 
  professional_site_name = site_name,
  creative_site_name = site_name,
  professional_logo_url = logo_url,
  creative_logo_url = logo_url;