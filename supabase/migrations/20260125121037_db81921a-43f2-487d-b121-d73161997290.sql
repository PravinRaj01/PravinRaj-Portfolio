-- Add mode column to socials table
ALTER TABLE public.socials 
ADD COLUMN mode VARCHAR NOT NULL DEFAULT 'professional';

-- Duplicate existing socials for creative mode (so both modes start with the same links)
INSERT INTO public.socials (name, icon, url, enabled, order_index, mode)
SELECT name, icon, url, enabled, order_index, 'creative'
FROM public.socials 
WHERE mode = 'professional';