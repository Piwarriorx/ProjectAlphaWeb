-- ============================================
-- Add HWID approval flag and RPC
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hwid_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.hwid_approved IS 'Whether the user HWID has been approved for launch';

CREATE OR REPLACE FUNCTION public.update_user_hwid_approval(p_user_id INT, p_hwid_approved BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET hwid_approved = p_hwid_approved
  WHERE id = p_user_id;
END;
$$;
