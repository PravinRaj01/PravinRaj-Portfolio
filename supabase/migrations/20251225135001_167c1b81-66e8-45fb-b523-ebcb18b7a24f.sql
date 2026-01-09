-- Fix education table: Remove overly permissive policy and add proper ones
DROP POLICY IF EXISTS "Allow all operations on education" ON education;

-- Allow public read access
CREATE POLICY "Allow public read access on education"
ON education FOR SELECT
USING (true);

-- Restrict write operations to authenticated users only
CREATE POLICY "Allow authenticated users to manage education"
ON education FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Fix certifications table: Same issue
DROP POLICY IF EXISTS "Allow all operations on certifications" ON certifications;

-- Allow public read access
CREATE POLICY "Allow public read access on certifications"
ON certifications FOR SELECT
USING (true);

-- Restrict write operations to authenticated users only
CREATE POLICY "Allow authenticated users to manage certifications"
ON certifications FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');