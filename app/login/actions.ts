'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function register(formData: FormData) {
  const supabase = await createServerSupabase()
  
  const username = (formData.get('username') as string).trim()
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (username.length < 3) return { error: 'Username must be at least 3 characters' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters' }
  if (password !== passwordConfirm) return { error: 'Passwords do not match' }

  const { data: existing } = await supabase
    .from('users')
    .select('username')
    .eq('username', username)
    .single()

  if (existing) return { error: 'Username already taken' }

  const { data: hashData, error: hashError } = await supabase
    .rpc('hash_password', { password })

  if (hashError || !hashData) return { error: 'Failed to hash password' }

  // New users start as 'pending' - needs admin approval
  const { error: insertError } = await supabase
    .from('users')
    .insert({ 
      username, 
      password_hash: hashData,
      role: 'pending'  // <-- Default role is pending
    })

  if (insertError) return { error: insertError.message }

  return { success: 'Account created! Waiting for admin approval.' }
}

export async function login(formData: FormData) {
  const supabase = await createServerSupabase()
  
  const username = (formData.get('username') as string).trim()
  const password = formData.get('password') as string

  const { data: userData, error: loginError } = await supabase
    .rpc('login_user', { 
      p_username: username, 
      p_password: password 
    })

  if (loginError || !userData || userData.length === 0) {
    return { error: 'Invalid username or password' }
  }

  const user = userData[0]
  
  // Map the returned columns to expected names
  const mappedUser = {
    id: user.user_id,
    username: user.username,
    role: user.role
  }

  // Check if approved
  if (mappedUser.role === 'pending') {
    return { error: 'Your account is pending approval. Please wait for admin confirmation.' }
  }

  return { 
    success: 'login', 
    userId: mappedUser.id, 
    username: mappedUser.username,
    role: mappedUser.role
  }
}