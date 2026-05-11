-- ============================================
-- Add HWID to users and launch credentials table
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hwid TEXT;

COMMENT ON COLUMN public.users.hwid IS 'Hardware ID associated with the user device';

CREATE TABLE IF NOT EXISTS public.user_launch_credentials (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_launch_credentials IS 'Global launch token and version used to build the custom protocol URL';
COMMENT ON COLUMN public.user_launch_credentials.token IS 'Token used by the launcher protocol';
COMMENT ON COLUMN public.user_launch_credentials.version IS 'Version string sent to the launcher protocol';

ALTER TABLE public.user_launch_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to user launch credentials" ON public.user_launch_credentials
  FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to user launch credentials" ON public.user_launch_credentials
  FOR ALL USING (
    current_user = 'supabase_admin'
    OR current_user LIKE 'service_role%'
  );

CREATE OR REPLACE FUNCTION public.update_user_launch_credentials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_launch_credentials_updated_at ON public.user_launch_credentials;

CREATE TRIGGER update_user_launch_credentials_updated_at
  BEFORE UPDATE ON public.user_launch_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_launch_credentials_updated_at();
