-- Migration for 10 feature enhancements

-- 1. Add project_links jsonb column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_links jsonb DEFAULT '[]'::jsonb;

-- 2. Add is_active column to projects table (defaults to true for backward compatibility)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Add is_active column to project_folders table (defaults to true for backward compatibility)
ALTER TABLE public.project_folders ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 4. Create project_image_folders table for image subfolders within projects
CREATE TABLE IF NOT EXISTS public.project_image_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  images text[] DEFAULT '{}'::text[],
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on project_image_folders
ALTER TABLE public.project_image_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for project_image_folders
CREATE POLICY "Allow public read access on project_image_folders" 
ON public.project_image_folders 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage project_image_folders" 
ON public.project_image_folders 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates on project_image_folders
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop trigger if exists to avoid errors, then create
DROP TRIGGER IF EXISTS update_project_image_folders_updated_at ON public.project_image_folders;
CREATE TRIGGER update_project_image_folders_updated_at
  BEFORE UPDATE ON public.project_image_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_image_folders_project_id ON public.project_image_folders(project_id);