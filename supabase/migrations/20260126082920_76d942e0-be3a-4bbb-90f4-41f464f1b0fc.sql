-- Add show_in_recent column to projects table for controlling home page visibility
ALTER TABLE public.projects 
ADD COLUMN show_in_recent boolean DEFAULT true;

-- Set default value for existing projects
UPDATE public.projects SET show_in_recent = true WHERE show_in_recent IS NULL;