-- Fix github_ticker table: Remove public write policies that allow anonymous modifications
DROP POLICY IF EXISTS "Allow public insert on github_ticker" ON github_ticker;
DROP POLICY IF EXISTS "Allow public update on github_ticker" ON github_ticker;

-- Keep existing authenticated management policy (already exists)
-- "Allow authenticated users to manage github_ticker" - FOR ALL with auth.role() = 'authenticated'