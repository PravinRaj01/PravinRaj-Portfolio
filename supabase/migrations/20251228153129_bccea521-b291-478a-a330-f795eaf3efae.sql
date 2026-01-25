-- Fix the page visibility settings: Academic should be Pro-only, Podcast should be Creative-only
UPDATE site_settings
SET 
  professional_visible_pages = ARRAY['home', 'projects', 'experience', 'academic', 'contact'],
  creative_visible_pages = ARRAY['home', 'projects', 'experience', 'contact', 'podcast']
WHERE id IS NOT NULL;