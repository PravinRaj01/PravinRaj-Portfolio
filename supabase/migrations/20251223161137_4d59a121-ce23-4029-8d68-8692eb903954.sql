-- Add chatbot_enabled column to site_settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS chatbot_enabled boolean DEFAULT true;