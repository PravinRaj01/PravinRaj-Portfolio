-- Add page-level mode toggle settings to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS mode_toggle_pages text[] DEFAULT ARRAY['home', 'projects', 'experience', 'academic', 'contact', 'podcast']::text[];