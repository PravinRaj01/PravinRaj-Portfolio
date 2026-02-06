
-- Add granular visitor display toggles
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS show_total_visitors boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_daily_visitors boolean DEFAULT true;
