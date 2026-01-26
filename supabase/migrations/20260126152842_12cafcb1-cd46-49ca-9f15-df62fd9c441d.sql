-- Add mode column to github_ticker table
ALTER TABLE public.github_ticker ADD COLUMN mode text NOT NULL DEFAULT 'professional';

-- Add unique constraint on mode
ALTER TABLE public.github_ticker ADD CONSTRAINT github_ticker_mode_unique UNIQUE (mode);

-- Insert creative mode record (copying from existing professional record)
INSERT INTO public.github_ticker (text, url, mode)
SELECT text, url, 'creative' FROM public.github_ticker WHERE mode = 'professional'
ON CONFLICT (mode) DO NOTHING;