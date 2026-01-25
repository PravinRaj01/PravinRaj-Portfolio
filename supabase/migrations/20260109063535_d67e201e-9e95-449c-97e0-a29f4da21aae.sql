-- Add default view mode settings to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS academic_default_view varchar(20) DEFAULT 'cards',
ADD COLUMN IF NOT EXISTS projects_default_view varchar(20) DEFAULT 'cards';

-- Add featured field to certifications table
ALTER TABLE public.certifications 
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;