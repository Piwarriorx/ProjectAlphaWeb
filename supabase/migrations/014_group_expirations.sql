-- ============================================
-- Group expiration table and RPC helpers
-- ============================================

CREATE TABLE IF NOT EXISTS public.group_expirations (
  id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE,
  servertime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiretime TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.group_expirations IS 'Expiration schedule for each group_id';
COMMENT ON COLUMN public.group_expirations.group_id IS 'Group identifier linked to users.group_id';
COMMENT ON COLUMN public.group_expirations.servertime IS 'Server time when the group record was created or activated';
COMMENT ON COLUMN public.group_expirations.expiretime IS 'When the group expires';

ALTER TABLE public.group_expirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to group expirations" ON public.group_expirations
  FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to group expirations" ON public.group_expirations
  FOR ALL USING (
    current_user = 'supabase_admin'
    OR current_user LIKE 'service_role%'
  );

CREATE OR REPLACE FUNCTION public.update_group_expiration(p_group_id TEXT, p_expiretime TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.group_expirations (group_id, servertime, expiretime)
  VALUES (p_group_id, NOW(), p_expiretime)
  ON CONFLICT (group_id)
  DO UPDATE SET
    servertime = NOW(),
    expiretime = EXCLUDED.expiretime;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_expiration(p_group_id TEXT)
RETURNS TABLE (
  group_id TEXT,
  servertime TIMESTAMPTZ,
  expiretime TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ge.group_id,
    ge.servertime,
    ge.expiretime
  FROM public.group_expirations ge
  WHERE ge.group_id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.delete_group_expiration(p_group_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.group_expirations
  WHERE group_id = p_group_id;
END;
$$;
