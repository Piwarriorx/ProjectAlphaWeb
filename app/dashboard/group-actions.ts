'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function updateUserGroup(userId: number, groupId: string | null) {
  const supabase = await createServerSupabase()

  console.log('Updating user group:', { userId, groupId })

  const { data, error } = await supabase
    .rpc('update_user_group', { p_user_id: userId, p_group_id: groupId })

  console.log('Update result:', { data, error })

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function getUsersWithGroups() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, group_id, hwid, hwid_approved, created_at, last_login_at')
    .order('created_at', { ascending: false })

  if (error) return { users: [], error: error.message }
  return { users: data || [], error: null }
}

export async function updateUserRole(userId: number, role: string) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .rpc('update_user_role', { p_user_id: userId, p_role: role })

  console.log('Role update result:', { data, error })

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function updateUserHwidApproval(userId: number, approved: boolean) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .rpc('update_user_hwid_approval', { p_user_id: userId, p_hwid_approved: approved })

  console.log('HWID approval update result:', { data, error })

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function bulkUpdateUserRole(userIds: number[], role: string) {
  const supabase = await createServerSupabase()

  for (const userId of userIds) {
    const { error } = await supabase.rpc('update_user_role', { p_user_id: userId, p_role: role })
    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function bulkUpdateUserGroup(userIds: number[], groupId: string | null) {
  const supabase = await createServerSupabase()

  for (const userId of userIds) {
    const { error } = await supabase.rpc('update_user_group', { p_user_id: userId, p_group_id: groupId })
    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function bulkDeleteUsers(userIds: number[]) {
  const supabase = await createServerSupabase()

  for (const userId of userIds) {
    const { error } = await supabase.rpc('reject_user', { p_user_id: userId })
    if (error) return { error: error.message }
  }

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

export async function updateGroupExpiration(groupId: string, servertime: string, expiretime: string) {
  const supabase = await createServerSupabase()

  const { error } = await supabase.rpc('update_group_expiration', {
    p_group_id: groupId,
    p_servertime: servertime,
    p_expiretime: expiretime
  })

  if (error) return { error: error.message }
  return { success: true }
}
