-- ============================================
-- Add group assignment column to users
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS group_id TEXT;

COMMENT ON COLUMN public.users.group_id IS 'Optional group assignment used to show members in the same group';
