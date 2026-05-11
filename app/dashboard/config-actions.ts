'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function saveUserConfig(userId: number, configText: string) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .rpc('save_user_config', {
      p_user_id: userId,
      p_config_text: configText
    })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getUserConfig(userId: number) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .rpc('get_user_config', {
      p_user_id: userId
    })

  if (error) {
    return { configText: '', error: error.message }
  }

  return { configText: data?.[0]?.config_text || '', error: null }
}
