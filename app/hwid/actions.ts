'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function saveUserHwid(userId: number, hwid: string) {
  const supabase = await createServerSupabase()

  const normalizedHwid = hwid.trim()
  if (!userId || !normalizedHwid) {
    return { error: 'Invalid HWID or user ID.' }
  }

  const { data, error } = await supabase
    .rpc('update_user_hwid', { p_user_id: userId, p_hwid: normalizedHwid })

  if (error) return { error: error.message }
  return { success: true, data }
}
