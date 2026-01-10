-- Create github_ticker table for editable ticker content
CREATE TABLE public.github_ticker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL DEFAULT 'More Projects on Github',
  url TEXT NOT NULL DEFAULT 'https://github.com',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.github_ticker ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on github_ticker" 
ON public.github_ticker 
FOR SELECT 
USING (true);

-- Allow authenticated users to manage
CREATE POLICY "Allow authenticated users to manage github_ticker" 
ON public.github_ticker 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Also allow public to update/insert for now (admin panel without auth)
CREATE POLICY "Allow public insert on github_ticker" 
ON public.github_ticker 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on github_ticker" 
ON public.github_ticker 
FOR UPDATE 
USING (true);

-- Insert default row
INSERT INTO public.github_ticker (text, url) 
VALUES ('More Projects on Github', 'https://github.com');