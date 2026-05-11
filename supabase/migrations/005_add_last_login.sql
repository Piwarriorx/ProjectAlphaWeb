-- ============================================
-- Track last login timestamp
-- ============================================

-- Add last_login_at column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Update login_user to set last_login_at on successful, non-pending login
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
  WITH matched AS (
    SELECT
      u.id,
      u.username,
      u.role
    FROM public.users u
    WHERE u.username = p_username
      AND u.password_hash = crypt(p_password, u.password_hash)
  ), updated AS (
    UPDATE public.users u
    SET last_login_at = NOW()
    FROM matched m
    WHERE u.id = m.id
      AND m.role <> 'pending'
    RETURNING u.id
  )
  SELECT
    m.id AS user_id,
    m.username,
    m.role
  FROM matched m;
END;
$$;
