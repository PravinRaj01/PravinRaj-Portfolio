-- Add crop positions for phone and tablet views
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS crop_phone JSONB DEFAULT '{"x": 50, "y": 50, "zoom": 100}',
ADD COLUMN IF NOT EXISTS crop_tablet JSONB DEFAULT '{"x": 50, "y": 50, "zoom": 100}';