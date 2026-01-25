-- Add mode-specific resume URLs to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN professional_resume_url text,
ADD COLUMN creative_resume_url text;

-- Migrate existing resume_url to professional_resume_url
UPDATE public.site_settings 
SET professional_resume_url = resume_url 
WHERE resume_url IS NOT NULL;