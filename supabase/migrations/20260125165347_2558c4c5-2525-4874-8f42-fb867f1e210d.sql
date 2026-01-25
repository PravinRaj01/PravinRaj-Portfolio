-- Add gallery_images array and video support to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS gallery_images text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS video_thumbnail_drive_id text;

-- Add comment for clarity
COMMENT ON COLUMN public.projects.gallery_images IS 'Array of additional image URLs or Drive IDs for project gallery';
COMMENT ON COLUMN public.projects.video_url IS 'URL to external video (YouTube, Vimeo, Google Drive)';
COMMENT ON COLUMN public.projects.video_thumbnail_drive_id IS 'Thumbnail image for video projects';