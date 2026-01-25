-- Add crop position fields for landscape and square formats
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS crop_landscape JSONB DEFAULT '{"x": 50, "y": 50}'::jsonb,
ADD COLUMN IF NOT EXISTS crop_square JSONB DEFAULT '{"x": 50, "y": 50}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.crop_landscape IS 'Focal point position (x,y percentages) for landscape crop on projects page';
COMMENT ON COLUMN public.projects.crop_square IS 'Focal point position (x,y percentages) for square crop on home tinder cards';