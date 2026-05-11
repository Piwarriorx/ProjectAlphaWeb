-- ============================================
-- Clear HWID when admin denies approval
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_hwid_approval(p_user_id INT, p_hwid_approved BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET hwid_approved = p_hwid_approved,
      hwid = CASE
        WHEN p_hwid_approved THEN hwid
        ELSE NULL
      END
  WHERE id = p_user_id;
END;
$$;
