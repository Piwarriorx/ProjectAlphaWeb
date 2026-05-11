-- ============================================
-- Add RPC to update a user's HWID
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_hwid(p_user_id INT, p_hwid TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET hwid = p_hwid,
      hwid_approved = false
  WHERE id = p_user_id;
END;
$$;
