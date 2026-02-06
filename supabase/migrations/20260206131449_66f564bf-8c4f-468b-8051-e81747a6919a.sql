-- Add visitor_counter_enabled to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS visitor_counter_enabled BOOLEAN DEFAULT false;

-- Create visitor_stats table
CREATE TABLE IF NOT EXISTS public.visitor_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on visitor_stats
ALTER TABLE public.visitor_stats ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read visitor stats (public counter)
CREATE POLICY "Anyone can view visitor stats"
ON public.visitor_stats
FOR SELECT
USING (true);

-- Only allow edge functions (service role) to update stats
CREATE POLICY "Service role can update visitor stats"
ON public.visitor_stats
FOR UPDATE
USING (true);

CREATE POLICY "Service role can insert visitor stats"
ON public.visitor_stats
FOR INSERT
WITH CHECK (true);

-- Insert initial row if not exists
INSERT INTO public.visitor_stats (view_count)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM public.visitor_stats);