-- Add profile_photo_url column to hero_content table
ALTER TABLE public.hero_content 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Update the animation_pause_duration to a more reasonable default for existing records
UPDATE public.hero_content 
SET animation_pause_duration = 500 
WHERE animation_pause_duration >= 2000;