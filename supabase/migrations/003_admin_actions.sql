-- ============================================
-- Admin Actions: Approve & Reject Users
-- SECURITY DEFINER bypasses RLS for these operations
-- ============================================

-- Approve a pending user (change role to 'user')
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET role = 'user'
  WHERE id = p_user_id
    AND role = 'pending';
END;
$$;

-- Reject a pending user (delete the account)
CREATE OR REPLACE FUNCTION public.reject_user(p_user_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.users
  WHERE id = p_user_id;
END;
$$;
