-- Add page visibility settings per mode
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS professional_visible_pages text[] DEFAULT ARRAY['home', 'projects', 'experience', 'academic', 'contact', 'podcast'];

ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS creative_visible_pages text[] DEFAULT ARRAY['home', 'projects', 'experience', 'academic', 'contact', 'podcast'];