-- ============================================
-- Files Table for Downloads
-- ============================================

CREATE TABLE IF NOT EXISTS public.files (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.files IS 'Files available for download by users';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Anyone can read files (needed for downloads)
CREATE POLICY "Allow read access to files" ON public.files
  FOR SELECT USING (true);

-- Service role bypass for inserts/deletes
CREATE POLICY "Allow service role full access files" ON public.files
  FOR ALL USING (
    current_user = 'supabase_admin'
    OR current_user LIKE 'service_role%'
  );

-- ============================================
-- Helper Functions (SECURITY DEFINER bypasses RLS)
-- ============================================

-- Insert a file record
CREATE OR REPLACE FUNCTION public.insert_file(
  p_filename TEXT,
  p_original_name TEXT,
  p_size BIGINT,
  p_mime_type TEXT,
  p_storage_path TEXT,
  p_uploaded_by TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.files (filename, original_name, size, mime_type, storage_path, uploaded_by)
  VALUES (p_filename, p_original_name, p_size, p_mime_type, p_storage_path, p_uploaded_by);
END;
$$;

-- Delete a file record
CREATE OR REPLACE FUNCTION public.delete_file(p_file_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.files WHERE id = p_file_id;
END;
$$;
