'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function updateUserGroup(userId: number, groupId: string | null) {
  const supabase = await createServerSupabase()

  console.log('Updating user group:', { userId, groupId })

  const { data, error } = await supabase
    .from('users')
    .update({ group_id: groupId })
    .eq('id', userId)
    .select()

  console.log('Update result:', { data, error })

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function getUsersWithGroups() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, group_id, created_at, last_login_at')
    .order('created_at', { ascending: false })

  if (error) return { users: [], error: error.message }
  return { users: data || [], error: null }
}

export async function updateUserRole(userId: number, role: string) {
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getAvailableGroups() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('users')
    .select('group_id')
    .not('group_id', 'is', null)

  if (error) return { groups: [], error: error.message }
  
  // Extract unique group IDs
  const uniqueGroups = [...new Set(data?.map(u => u.group_id).filter(Boolean))]
  return { groups: uniqueGroups, error: null }
}
