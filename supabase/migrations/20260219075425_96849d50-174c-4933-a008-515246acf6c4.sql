
-- Add slug column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from existing titles
UPDATE public.projects 
SET slug = lower(regexp_replace(
  regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'),
  '\s+', '-', 'g'
)) 
WHERE slug IS NULL;

-- Handle duplicate slugs by appending a suffix
DO $$
DECLARE
  r RECORD;
  counter INTEGER;
  new_slug TEXT;
BEGIN
  FOR r IN 
    SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
    FROM public.projects
    WHERE slug IN (SELECT slug FROM public.projects GROUP BY slug HAVING COUNT(*) > 1)
  LOOP
    IF r.rn > 1 THEN
      new_slug := r.slug || '-' || r.rn;
      UPDATE public.projects SET slug = new_slug WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Now add unique constraint
ALTER TABLE public.projects ADD CONSTRAINT projects_slug_unique UNIQUE (slug);
