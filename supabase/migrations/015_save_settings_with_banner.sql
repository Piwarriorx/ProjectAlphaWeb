CREATE TABLE IF NOT EXISTS public.user_launch_credentials (
  id bigint PRIMARY KEY,
  token text NOT NULL DEFAULT 'ProjectAlphaPi',
  version text NOT NULL DEFAULT '1.0',
  changelog text NOT NULL DEFAULT '',
  banner_id bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_launch_credentials
ADD COLUMN IF NOT EXISTS changelog text NOT NULL DEFAULT '';

ALTER TABLE public.user_launch_credentials
ADD COLUMN IF NOT EXISTS banner_id bigint NOT NULL DEFAULT 1;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS dismissed_banner_id bigint NOT NULL DEFAULT 0;

INSERT INTO public.user_launch_credentials (
  id,
  token,
  version,
  changelog,
  banner_id,
  created_at,
  updated_at
)
VALUES (
  1,
  'ProjectAlphaPi',
  '1.0',
  '',
  1,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET
  token = COALESCE(public.user_launch_credentials.token, EXCLUDED.token),
  version = COALESCE(public.user_launch_credentials.version, EXCLUDED.version),
  changelog = COALESCE(public.user_launch_credentials.changelog, ''),
  updated_at = public.user_launch_credentials.updated_at;

DROP FUNCTION IF EXISTS public.get_launch_settings();
DROP FUNCTION IF EXISTS public.update_launch_settings(text, text);

CREATE OR REPLACE FUNCTION public.get_launch_settings()
RETURNS TABLE (
  id bigint,
  token text,
  version text,
  changelog text,
  banner_id bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ulc.id,
    ulc.token,
    ulc.version,
    ulc.changelog,
    ulc.banner_id,
    ulc.created_at,
    ulc.updated_at
  FROM public.user_launch_credentials AS ulc
  WHERE ulc.id = 1
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_launch_settings(
  p_version text,
  p_changelog text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(p_version), '') IS NULL THEN
    RAISE EXCEPTION 'Version is required.';
  END IF;

  UPDATE public.user_launch_credentials
  SET
    version = trim(p_version),
    changelog = COALESCE(p_changelog, ''),
    banner_id = COALESCE(banner_id, 1) + 1,
    updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.user_launch_credentials (
      id,
      token,
      version,
      changelog,
      banner_id,
      created_at,
      updated_at
    )
    VALUES (
      1,
      'ProjectAlphaPi',
      trim(p_version),
      COALESCE(p_changelog, ''),
      1,
      now(),
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_launch_settings(text, text) TO anon, authenticated;


DROP FUNCTION IF EXISTS public.dismiss_changelog_banner(bigint, bigint);

CREATE OR REPLACE FUNCTION public.dismiss_changelog_banner(
  p_user_id bigint,
  p_banner_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET dismissed_banner_id = GREATEST(COALESCE(dismissed_banner_id, 0), p_banner_id)
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_changelog_banner(bigint, bigint) TO anon, authenticated;

-- Enable Supabase Realtime for settings/banner updates.
-- Required so every connected client receives user_launch_credentials changes immediately.
ALTER TABLE public.user_launch_credentials REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_launch_credentials'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.user_launch_credentials;
  END IF;
END $$;

-- Recommended because the app also listens to users updates and compares old/new values.
ALTER TABLE public.users REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.users;
  END IF;
END $$;
