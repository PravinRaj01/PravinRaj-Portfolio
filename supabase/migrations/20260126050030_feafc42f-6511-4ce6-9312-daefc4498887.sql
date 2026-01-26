-- Add position field to projects table for creative mode
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS position text;