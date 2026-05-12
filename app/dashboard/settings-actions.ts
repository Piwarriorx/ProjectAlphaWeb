'use server'

import { createClient } from '@supabase/supabase-js'

const LAUNCH_CREDENTIAL_ID = 1
const DEFAULT_TOKEN = 'ProjectAlphaPi'

type LaunchSettings = {
  id: number
  token: string
  version: string
  changelog: string | null
}

type SaveLaunchSettingsResult = {
  data: LaunchSettings | null
  error: string | null
}

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    return { supabase: null, error: 'Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.' }
  }

  if (!serviceRoleKey) {
    return { supabase: null, error: 'Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.' }
  }

  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    error: null,
  }
}

export async function saveLaunchSettings(
  version: string,
  changelog: string
): Promise<SaveLaunchSettingsResult> {
  const nextVersion = version.trim()

  if (!nextVersion) {
    return { data: null, error: 'Version is required.' }
  }

  const { supabase, error: clientError } = createAdminSupabaseClient()
  if (!supabase) {
    return { data: null, error: clientError || 'Failed to initialize Supabase admin client.' }
  }

  const now = new Date().toISOString()

  const { data: existingRow, error: existingError } = await supabase
    .from('user_launch_credentials')
    .select('id, token')
    .eq('id', LAUNCH_CREDENTIAL_ID)
    .maybeSingle()

  if (existingError) {
    return { data: null, error: existingError.message }
  }

  const payload = {
    id: LAUNCH_CREDENTIAL_ID,
    token: existingRow?.token || DEFAULT_TOKEN,
    version: nextVersion,
    changelog,
    updated_at: now,
    ...(existingRow ? {} : { created_at: now }),
  }

  const { data, error } = await supabase
    .from('user_launch_credentials')
    .upsert(payload, { onConflict: 'id' })
    .select('id, token, version, changelog')
    .eq('id', LAUNCH_CREDENTIAL_ID)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }

  if (!data) {
    return { data: null, error: 'Save failed: no launch credential row was returned.' }
  }

  return { data: data as LaunchSettings, error: null }
}
