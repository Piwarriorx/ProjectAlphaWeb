'use server'

import { createServerSupabase } from '@/lib/supabase/server'

type LaunchSettings = {
  id: number
  token: string
  version: string
  changelog: string | null
  banner_id: number
  show_launch_debug: boolean
  created_at?: string | null
  updated_at?: string | null
}

type LaunchSettingsResult = {
  data: LaunchSettings | null
  error: string | null
}

function normalizeLaunchSettingsRow(data: unknown): LaunchSettings | null {
  const row = Array.isArray(data) ? data[0] : data

  if (!row || typeof row !== 'object') return null

  const value = row as Record<string, unknown>

  return {
    id: Number(value.id),
    token: String(value.token || ''),
    version: String(value.version || ''),
    changelog: typeof value.changelog === 'string' ? value.changelog : '',
    banner_id: Number(value.banner_id || 0),
    show_launch_debug: value.show_launch_debug === true,
    created_at: typeof value.created_at === 'string' ? value.created_at : null,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  }
}

export async function getLaunchSettings(): Promise<LaunchSettingsResult> {
  const supabase = await createServerSupabase()

  // Always display only public.user_launch_credentials row id=1.
  const { data, error } = await supabase.rpc('get_launch_settings')

  if (error) {
    return { data: null, error: error.message }
  }

  const row = normalizeLaunchSettingsRow(data)

  if (!row || row.id !== 1) {
    return {
      data: null,
      error: 'No launch settings found for user_launch_credentials id=1. Run the launch settings migration first.',
    }
  }

  return { data: row, error: null }
}

export async function saveLaunchSettings(
  version: string,
  changelog: string,
  showLaunchDebug: boolean
): Promise<LaunchSettingsResult> {
  const nextVersion = version.trim()

  if (!nextVersion) {
    return { data: null, error: 'Version is required.' }
  }

  const supabase = await createServerSupabase()

  // Always edit only public.user_launch_credentials row id=1.
  // banner_id increments only when version/changelog changes.
  // Toggling launch debug alone does not create a new changelog banner.
  const { error } = await supabase.rpc('update_launch_settings', {
    p_version: nextVersion,
    p_changelog: changelog || '',
    p_show_launch_debug: showLaunchDebug,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  return getLaunchSettings()
}
