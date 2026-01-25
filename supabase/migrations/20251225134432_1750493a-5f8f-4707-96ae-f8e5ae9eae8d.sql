-- Fix contact_content table - enable RLS and add policies
ALTER TABLE contact_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for portfolio visitors)
CREATE POLICY "Allow public read access on contact_content"
ON contact_content FOR SELECT
USING (true);

-- Allow authenticated users to manage contact content
CREATE POLICY "Allow authenticated users to manage contact_content"
ON contact_content FOR ALL
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);