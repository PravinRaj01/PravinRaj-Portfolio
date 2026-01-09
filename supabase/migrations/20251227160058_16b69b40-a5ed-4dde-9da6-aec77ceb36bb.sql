-- Add section_title column to about_content for the editable ribbon text
ALTER TABLE public.about_content 
ADD COLUMN IF NOT EXISTS section_title TEXT DEFAULT 'About Me';

-- Update existing rows to have the default title
UPDATE public.about_content 
SET section_title = 'About Me' 
WHERE section_title IS NULL;