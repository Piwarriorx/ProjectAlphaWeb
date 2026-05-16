'use server'

import { createServerSupabase } from '@/lib/supabase/server'

type LaunchSettings = {
  id: number
  token: string
  version: string
  changelog: string | null
  banner_id: number
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
      error: 'No launch settings found for user_launch_credentials id=1. Run the launch_settings_id_1_only.sql migration first.',
    }
  }

  return { data: row, error: null }
}

export async function saveLaunchSettings(
  token: string,
  version: string,
  changelog: string
): Promise<LaunchSettingsResult> {
  const nextToken = token.trim()
  const nextVersion = version.trim()

  if (!nextToken) {
    return { data: null, error: 'Token is required.' }
  }

  if (!nextVersion) {
    return { data: null, error: 'Version is required.' }
  }

  const supabase = await createServerSupabase()

  // Preferred path: use the RPC below so RLS cannot block admin saves.
  // Run update-launch-settings-token-rpc.sql once in Supabase SQL editor.
  const { error } = await supabase.rpc('update_launch_settings', {
    p_token: nextToken,
    p_version: nextVersion,
    p_changelog: changelog || '',
  })

  if (!error) {
    return getLaunchSettings()
  }

  // Fallback path: direct update for projects where RLS allows this server action.
  const { data: currentRow, error: currentError } = await supabase
    .from('user_launch_credentials')
    .select('banner_id')
    .eq('id', 1)
    .single()

  if (currentError) {
    return {
      data: null,
      error: `RPC update failed: ${error.message}. Direct update lookup also failed: ${currentError.message}`,
    }
  }

  const nextBannerId = Number(currentRow?.banner_id || 0) + 1

  const { error: updateError } = await supabase
    .from('user_launch_credentials')
    .update({
      token: nextToken,
      version: nextVersion,
      changelog: changelog || '',
      banner_id: nextBannerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (updateError) {
    return {
      data: null,
      error: `RPC update failed: ${error.message}. Direct update fallback also failed: ${updateError.message}`,
    }
  }

  return getLaunchSettings()
}


type PastebinSettings = {
  pastebinoff: string
  pastebinon: string
  updated_at?: string | null
}

type PastebinSettingsResult = {
  data: PastebinSettings | null
  error: string | null
}

const DEFAULT_PASTEBIN_OFF_TEXT = `D403-B1F6{ panic = off, jumpscare = off, username = test }
2A93-DC39{ panic = off, jumpscare = off, username = kendricklamaw }
2CE5-1CD8{ panic = off, jumpscare = off, username = kendricklamao }
50C4-8C2F{ panic = off, jumpscare = off, username = liltitels }
6EDC-04A7{ panic = off, jumpscare = off, username = jordyls }
9613-FEF6{ panic = off, jumpscare = off, username = iverson }
B25E-5A77{ panic = off, jumpscare = off, username = Skibidi Ddot }
0EB8-51BF{ panic = off, jumpscare = off, username = KennethBrown23 }
DC03-321C{ panic = off, jumpscare = off, username = shiva }
3E81-48AB{ panic = off, jumpscare = off, username = Unoone }
8862-91EB{ panic = off, jumpscare = off, username = CjayBrown }
C44C-64A3{ panic = off, jumpscare = off, username = tokiyow }
12E7-E099{ panic = off, jumpscare = off, username = gradetwo }
1CC8-358E{ panic = off, jumpscare = off, username = valopzhub }`
const DEFAULT_PASTEBIN_ON_TEXT = DEFAULT_PASTEBIN_OFF_TEXT
  .replace(/panic = off/g, 'panic = on')
  .replace(/jumpscare = off/g, 'jumpscare = on')

function normalizePastebinSettingsRow(data: unknown): PastebinSettings | null {
  const row = Array.isArray(data) ? data[0] : data

  if (!row || typeof row !== 'object') return null

  const value = row as Record<string, unknown>

  return {
    pastebinoff: typeof value.pastebinoff === 'string' && value.pastebinoff.trim()
      ? value.pastebinoff
      : DEFAULT_PASTEBIN_OFF_TEXT,
    pastebinon: typeof value.pastebinon === 'string' && value.pastebinon.trim()
      ? value.pastebinon
      : DEFAULT_PASTEBIN_ON_TEXT,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  }
}

export async function getPastebinSettings(): Promise<PastebinSettingsResult> {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('pastebinlist')
    .select('pastebinoff, pastebinon, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (error.message.includes('does not exist')) {
      return {
        data: null,
        error: 'The pastebinlist table does not exist. Run create-pastebinlist-table.sql in Supabase SQL editor first.',
      }
    }

    return { data: null, error: `Database error: ${error.message}` }
  }

  const row = normalizePastebinSettingsRow(data)

  return {
    data: row || {
      pastebinoff: DEFAULT_PASTEBIN_OFF_TEXT,
      pastebinon: DEFAULT_PASTEBIN_ON_TEXT,
      updated_at: null,
    },
    error: null,
  }
}

export async function savePastebinSettings(
  mode: 'off' | 'on',
  pastebinText: string
): Promise<PastebinSettingsResult> {
  if (mode !== 'off' && mode !== 'on') {
    return { data: null, error: 'Invalid pastebin mode.' }
  }

  if (pastebinText === null || pastebinText === undefined || !pastebinText.trim()) {
    return { data: null, error: 'Pastebin text is required.' }
  }

  const supabase = await createServerSupabase()
  const now = new Date().toISOString()
  const columnName = mode === 'on' ? 'pastebinon' : 'pastebinoff'

  const { data: existingRow, error: lookupError } = await supabase
    .from('pastebinlist')
    .select('id')
    .eq('id', 1)
    .maybeSingle()

  if (lookupError) {
    if (lookupError.message.includes('does not exist')) {
      return {
        data: null,
        error: 'The pastebinlist table does not exist. Run create-pastebinlist-table.sql in Supabase SQL editor first.',
      }
    }

    return { data: null, error: `Database lookup error: ${lookupError.message}` }
  }

  if (existingRow) {
    const { error: updateError } = await supabase
      .from('pastebinlist')
      .update({
        [columnName]: pastebinText,
        updated_at: now,
      })
      .eq('id', 1)

    if (updateError) {
      return { data: null, error: `Database update error: ${updateError.message}` }
    }
  } else {
    const { error: insertError } = await supabase
      .from('pastebinlist')
      .insert({
        id: 1,
        pastebinoff: mode === 'off' ? pastebinText : DEFAULT_PASTEBIN_OFF_TEXT,
        pastebinon: mode === 'on' ? pastebinText : DEFAULT_PASTEBIN_ON_TEXT,
        updated_at: now,
      })

    if (insertError) {
      return { data: null, error: `Database insert error: ${insertError.message}` }
    }
  }

  return getPastebinSettings()
}
