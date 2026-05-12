'use server'

import { createServerSupabase } from '@/lib/supabase/server'

type LaunchSettings = {
  id: number
  token: string
  version: string
  changelog: string | null
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
  }
}

export async function getLaunchSettings(): Promise<LaunchSettingsResult> {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc('get_launch_settings')

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: normalizeLaunchSettingsRow(data), error: null }
}

export async function saveLaunchSettings(
  version: string,
  changelog: string
): Promise<LaunchSettingsResult> {
  const nextVersion = version.trim()

  if (!nextVersion) {
    return { data: null, error: 'Version is required.' }
  }

  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc('update_launch_settings', {
    p_version: nextVersion,
    p_changelog: changelog || '',
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const row = normalizeLaunchSettingsRow(data)

  if (!row) {
    return { data: null, error: 'Save failed: no launch settings row was returned.' }
  }

  return { data: row, error: null }
}
