-- ============================================
-- EzCrosshairX Initial Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.users IS 'Application users with role-based access';
COMMENT ON COLUMN public.users.role IS 'User role: pending (awaiting approval), user (approved), admin';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read users (needed for login checks)
CREATE POLICY "Allow read access to users" ON public.users
  FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete users
CREATE POLICY "Allow admin insert" ON public.users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::int AND role = 'admin')
  );

-- Service role bypass for application server
CREATE POLICY "Allow service role full access" ON public.users
  FOR ALL USING (
    current_user = 'supabase_admin'
    OR current_user LIKE 'service_role%'
  );

-- ============================================
-- Helper Functions
-- ============================================

-- Hash a password using bcrypt (via pgcrypto)
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hashed TEXT;
BEGIN
  hashed := crypt(password, gen_salt('bf'));
  RETURN hashed;
END;
$$;

-- Login user: verify credentials and return user info
CREATE OR REPLACE FUNCTION public.login_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE (
  user_id INT,
  username TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.username,
    u.role
  FROM public.users u
  WHERE u.username = p_username
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

-- ============================================
-- Seed Data
-- ============================================

-- Create initial admin user (username: admin, password: admin123)
-- Change this after first login!
INSERT INTO public.users (username, password_hash, role)
VALUES (
  'x',
  crypt('bwewer', gen_salt('bf')),
  'admin'
)
ON CONFLICT (username) DO NOTHING;
