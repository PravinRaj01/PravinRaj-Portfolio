-- Create table for daily visitor statistics
CREATE TABLE public.visitor_daily_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visitor_daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access for displaying stats
CREATE POLICY "Allow public read access to daily stats"
  ON public.visitor_daily_stats
  FOR SELECT
  USING (true);

-- Create index for date queries
CREATE INDEX idx_visitor_daily_stats_date ON public.visitor_daily_stats(date DESC);