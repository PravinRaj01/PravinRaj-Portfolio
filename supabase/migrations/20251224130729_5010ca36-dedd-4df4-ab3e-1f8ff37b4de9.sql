-- Add cta_link column to hero_content table to specify CTA button destination
ALTER TABLE public.hero_content 
ADD COLUMN IF NOT EXISTS cta_link TEXT DEFAULT '/projects';