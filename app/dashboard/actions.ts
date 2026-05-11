'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function approveUser(userId: number) {
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .rpc('approve_user', { p_user_id: userId })

  if (error) return { error: error.message }
  return { success: true }
}

export async function rejectUser(userId: number) {
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .rpc('reject_user', { p_user_id: userId })

  if (error) return { error: error.message }
  return { success: true }
}
