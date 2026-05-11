-- ============================================
-- Fix RLS so unauthenticated users can register
-- ============================================

-- Drop the old restrictive insert policy
DROP POLICY IF EXISTS "Allow admin insert" ON public.users;

-- Allow anyone to insert (registration is open, app validates input)
CREATE POLICY "Allow anonymous insert for registration" ON public.users
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update their own record (not used currently, but safe)
-- Admins can update/delete any user via dashboard
CREATE POLICY "Allow admin update" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::int AND role = 'admin')
  );

CREATE POLICY "Allow admin delete" ON public.users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::int AND role = 'admin')
  );
