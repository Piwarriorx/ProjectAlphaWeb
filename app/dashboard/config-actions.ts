'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function saveUserConfig(userId: number, configText: string) {
  try {
    // Validate inputs
    if (!userId || userId === null || userId === undefined) {
      console.error('Invalid userId:', userId)
      return { error: 'Invalid user ID. Please log in again.' }
    }

    if (configText === null || configText === undefined) {
      console.error('Invalid configText:', configText)
      return { error: 'Invalid configuration text.' }
    }

    const supabase = await createServerSupabase()

    console.log('Attempting to save config for user:', userId)
    console.log('Config text length:', configText.length)

    const { data, error } = await supabase
      .from('user_config')
      .upsert({
        user_id: userId,
        config_text: configText,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()

    if (error) {
      console.error('Supabase upsert error:', error)
      if (error.message.includes('does not exist')) {
        return { error: 'The user_config table does not exist. Please run the SQL in create-user-config-table.sql in your Supabase SQL editor.' }
      }
      if (error.message.includes('row-level security policy')) {
        return { error: 'RLS policy violation. Please run the SQL in fix-rls-policy.sql in your Supabase SQL editor.' }
      }
      return { error: `Database error: ${error.message}` }
    }

    console.log('Config saved successfully')
    return { success: true }
  } catch (err) {
    console.error('Unexpected error in saveUserConfig:', err)
    return { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

export async function getUserConfig(userId: number) {
  try {
    // Validate input
    if (!userId || userId === null || userId === undefined) {
      console.error('Invalid userId in getUserConfig:', userId)
      return { configText: '', error: 'Invalid user ID. Please log in again.' }
    }

    const supabase = await createServerSupabase()

    console.log('Attempting to get config for user:', userId)

    // Use direct table access instead of RPC
    const { data, error } = await supabase
      .from('user_config')
      .select('config_text')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Supabase select error in getUserConfig:', error)
      return { configText: '', error: `Database error: ${error.message}` }
    }

    const configText = data?.config_text || ''
    console.log('Config retrieved successfully, length:', configText.length)
    return { configText, error: null }
  } catch (err) {
    console.error('Unexpected error in getUserConfig:', err)
    return { configText: '', error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}
