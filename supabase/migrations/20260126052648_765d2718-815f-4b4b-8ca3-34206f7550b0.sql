-- Create project_folders table
CREATE TABLE public.project_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_drive_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('professional', 'creative')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to projects table (nullable for optional folders)
ALTER TABLE public.projects 
ADD COLUMN folder_id UUID REFERENCES public.project_folders(id) ON DELETE SET NULL;

-- Enable RLS on project_folders
ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_folders
CREATE POLICY "Allow public read access on project_folders"
ON public.project_folders
FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated users to manage project_folders"
ON public.project_folders
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Create trigger for updated_at on project_folders
CREATE TRIGGER update_project_folders_updated_at
BEFORE UPDATE ON public.project_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster folder lookups
CREATE INDEX idx_projects_folder_id ON public.projects(folder_id);
CREATE INDEX idx_project_folders_mode ON public.project_folders(mode);