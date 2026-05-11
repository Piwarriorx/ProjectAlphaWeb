'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function saveUserConfig(userId: number, configText: string) {
  const supabase = await createServerSupabase()

  try {
    const { error } = await supabase
      .rpc('save_user_config', {
        p_user_id: userId,
        p_config_text: configText
      })

    if (error) {
      console.error('Save error:', error)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getUserConfig(userId: number) {
  const supabase = await createServerSupabase()

  try {
    const { data, error } = await supabase
      .rpc('get_user_config', {
        p_user_id: userId
      })

    if (error) {
      console.error('Get error:', error)
      return { configText: '', error: error.message }
    }

    // Handle both array and single value responses
    const configText = Array.isArray(data) && data.length > 0 
      ? data[0].config_text 
      : data?.config_text || '';
    
    return { configText, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { configText: '', error: 'An unexpected error occurred' }
  }
}
