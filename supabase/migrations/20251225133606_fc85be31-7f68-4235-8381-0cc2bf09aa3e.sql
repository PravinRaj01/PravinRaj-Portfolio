-- Fix 1: Remove public write policies from projects table (keep only authenticated access)
DROP POLICY IF EXISTS "Allow public insert on projects" ON projects;
DROP POLICY IF EXISTS "Allow public update on projects" ON projects;
DROP POLICY IF EXISTS "Allow public delete on projects" ON projects;

-- Fix 2: Add RLS policies to technical_skills table
CREATE POLICY "Allow public read access on technical_skills"
ON technical_skills FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated users to manage technical_skills"
ON technical_skills FOR ALL
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);

-- Fix 3: Add storage policies for resumes bucket
CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update resumes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Public can view resumes"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes');

-- Fix 4: Remove experiences table public write (same issue as projects)
DROP POLICY IF EXISTS "Allow public insert on experiences" ON experiences;
DROP POLICY IF EXISTS "Allow public update on experiences" ON experiences;
DROP POLICY IF EXISTS "Allow public delete on experiences" ON experiences;