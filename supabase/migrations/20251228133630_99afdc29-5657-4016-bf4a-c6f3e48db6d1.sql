-- Add project_date column to projects table
ALTER TABLE public.projects 
ADD COLUMN project_date text;