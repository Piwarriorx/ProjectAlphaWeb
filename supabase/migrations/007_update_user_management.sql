-- ============================================
-- Update User Group and Role via RPC
-- SECURITY DEFINER bypasses RLS for these operations
-- ============================================

-- Update a user's group_id
CREATE OR REPLACE FUNCTION public.update_user_group(p_user_id INT, p_group_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET group_id = p_group_id
  WHERE id = p_user_id;
END;
$$;

-- Update a user's role
CREATE OR REPLACE FUNCTION public.update_user_role(p_user_id INT, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET role = p_role
  WHERE id = p_user_id;
END;
$$;
