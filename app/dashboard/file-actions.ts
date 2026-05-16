'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function uploadFile(formData: FormData) {
  const supabase = await createServerSupabase()

  const file = formData.get('file') as File
  const uploadedBy = formData.get('uploadedBy') as string

  if (!file) return { error: 'No file provided' }

  // Generate unique filename
  const ext = file.name.split('.').pop() || ''
  const timestamp = Date.now()
  const filename = `${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `downloads/${filename}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('downloads')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { error: uploadError.message }

  // Insert metadata via RPC (bypasses RLS)
  const { error: insertError } = await supabase
    .rpc('insert_file', {
      p_filename: filename,
      p_original_name: file.name,
      p_size: file.size,
      p_mime_type: file.type,
      p_storage_path: storagePath,
      p_uploaded_by: uploadedBy || null,
    })

  if (insertError) {
    // Rollback storage upload
    await supabase.storage.from('downloads').remove([storagePath])
    return { error: insertError.message }
  }

  return { success: true }
}

export async function listFiles() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('files')
    .select('id, filename, original_name, size, mime_type, storage_path, uploaded_by, created_at')
    .order('created_at', { ascending: false })

  if (error) return { files: [], error: error.message }
  return { files: data || [] }
}

export async function deleteFile(fileId: number, storagePath: string) {
  const supabase = await createServerSupabase()

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from('downloads')
    .remove([storagePath])

  if (storageError) return { error: storageError.message }

  // Delete from database via RPC
  const { error } = await supabase
    .rpc('delete_file', { p_file_id: fileId })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getSignedDownloadUrl(storagePath: string) {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.storage
    .from('downloads')
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error) return { error: error.message }
  return { url: data?.signedUrl }
}
