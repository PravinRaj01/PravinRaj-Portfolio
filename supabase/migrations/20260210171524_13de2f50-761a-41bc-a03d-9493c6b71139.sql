
-- Create magazine_issues table
CREATE TABLE public.magazine_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  is_published boolean DEFAULT false,
  mode text NOT NULL DEFAULT 'creative',
  cover_headline text,
  cover_subhead text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  project_ids text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magazine_issues ENABLE ROW LEVEL SECURITY;

-- Public can read published issues
CREATE POLICY "Public can view published issues"
ON public.magazine_issues FOR SELECT
USING (is_published = true);

-- Authenticated users can manage all issues (admin)
CREATE POLICY "Authenticated users can insert issues"
ON public.magazine_issues FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update issues"
ON public.magazine_issues FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete issues"
ON public.magazine_issues FOR DELETE
TO authenticated
USING (true);

-- Authenticated users can also read unpublished issues
CREATE POLICY "Authenticated users can view all issues"
ON public.magazine_issues FOR SELECT
TO authenticated
USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_magazine_issues_updated_at
BEFORE UPDATE ON public.magazine_issues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
