'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/client' // For client-side realtime

// ============================================
// SERVER ACTIONS (existing + new)
// ============================================

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

  const uniqueGroups = [...new Set(data?.map(u => u.group_id).filter(Boolean))]
  return { groups: uniqueGroups, error: null }
}

export async function updateGroupExpiration(groupId: string, expiretime: string) {
  const supabase = await createServerSupabase()

  console.log('Calling update_group_expiration RPC with:', { group_id: groupId, expiretime });

  try {
    const { data, error } = await supabase.rpc('update_group_expiration', {
      payload: { group_id: groupId, expiretime: expiretime }
    })

    if (error) {
      console.error('Error from update_group_expiration RPC:', error.message, error.details, error.hint);
      return { error: error.message };
    }
    console.log('Successfully called update_group_expiration RPC. Data:', data);
    return { success: true, data };
  } catch (err: any) {
    console.error('Exception in updateGroupExpiration:', err);
    return { error: err?.message || 'Unknown error occurred' };
  }
}

// ============================================
// REALTIME SUBSCRIPTION (Client-side hook)
// ============================================

import { useEffect, useCallback } from 'react'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface User {
  id: number
  username: string
  role: string
  group_id: string | null
  hwid: string | null
  hwid_approved: boolean
  created_at: string
  last_login_at: string | null
}

export type UserChangeCallback = (payload: RealtimePostgresChangesPayload<User>) => void

/**
 * Subscribe to real-time changes on the users table
 * Call this from a React component to listen for group_id changes
 */
export function useUsersRealtime(
  onChange: UserChangeCallback,
  filter?: { column: string; value: string | number }
) {
  useEffect(() => {
    const supabase = createClient()

    // Build the channel with optional filter
    let channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'users',
          ...(filter && { filter: `${filter.column}=eq.${filter.value}` })
        },
        (payload) => {
          console.log('Realtime users change:', payload)
          onChange(payload as RealtimePostgresChangesPayload<User>)
        }
      )

    const subscription = channel.subscribe((status) => {
      console.log('Realtime subscription status:', status)
    })

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [onChange, filter?.column, filter?.value])
}

// ============================================
// SPECIFIC: Group Changes Listener
// ============================================

/**
 * Hook specifically for listening to group_id changes
 * Returns the updated user data when group_id changes
 */
export function useUserGroupChanges(
  onGroupChange: (userId: number, newGroupId: string | null, oldGroupId: string | null) => void
) {
  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<User>) => {
    if (payload.eventType === 'UPDATE') {
      const newRecord = payload.new as User
      const oldRecord = payload.old as User
      
      // Only trigger when group_id actually changed
      if (newRecord.group_id !== oldRecord.group_id) {
        onGroupChange(newRecord.id, newRecord.group_id, oldRecord.group_id)
      }
    }
  }, [onGroupChange])

  useUsersRealtime(handleChange)
}

// ============================================
// SERVER-SIDE BROADCAST (Alternative: Trigger + Edge Function)
// ============================================

/**
 * Optional: If you need to broadcast from server actions,
 * you can use supabase.channel().send() for cross-client sync
 */
export async function broadcastGroupChange(userId: number, groupId: string | null) {
  const supabase = await createServerSupabase()
  
  // Broadcast to all connected clients via Realtime
  const channel = supabase.channel('group-updates')
  
  await channel.send({
    type: 'broadcast',
    event: 'group_changed',
    payload: { userId, groupId, timestamp: new Date().toISOString() }
  })
  
  return { success: true }
}