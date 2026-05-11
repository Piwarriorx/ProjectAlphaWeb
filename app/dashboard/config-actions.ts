'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function saveUserConfig(userId: number, configText: string) {
  const supabase = await createServerSupabase()

  try {
    // Direct upsert operation
    const { error } = await supabase
      .from('user_configs')
      .upsert({ 
        user_id: userId, 
        config_text: configText,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
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
      .from('user_configs')
      .select('config_text')
      .eq('user_id', userId)
      .maybeSingle() // Use maybeSingle to avoid "no rows" error

    if (error) {
      console.error('Get error:', error)
      return { configText: '', error: error.message }
    }

    return { configText: data?.config_text || '', error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { configText: '', error: 'An unexpected error occurred' }
  }
}
