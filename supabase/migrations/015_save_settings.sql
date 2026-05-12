CREATE TABLE IF NOT EXISTS public.user_launch_credentials (
  id bigint PRIMARY KEY,
  token text NOT NULL DEFAULT 'ProjectAlphaPi',
  version text NOT NULL DEFAULT '1.0',
  changelog text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_launch_credentials
ADD COLUMN IF NOT EXISTS changelog text NOT NULL DEFAULT '';

INSERT INTO public.user_launch_credentials (
  id,
  token,
  version,
  changelog,
  created_at,
  updated_at
)
VALUES (
  1,
  'ProjectAlphaPi',
  '1.0',
  '',
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
    updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.user_launch_credentials (
      id,
      token,
      version,
      changelog,
      created_at,
      updated_at
    )
    VALUES (
      1,
      'ProjectAlphaPi',
      trim(p_version),
      COALESCE(p_changelog, ''),
      now(),
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_launch_settings(text, text) TO anon, authenticated;
