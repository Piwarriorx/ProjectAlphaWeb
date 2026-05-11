-- ============================================
-- User Configuration Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_config (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  config_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.user_config IS 'User configuration settings stored as text';
COMMENT ON COLUMN public.user_config.config_text IS 'Configuration settings as a long text string';

-- Create unique constraint to ensure one config per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_config_user_id ON public.user_config(user_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE public.user_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own config
CREATE POLICY "Allow users to manage their own config" ON public.user_config
  FOR ALL USING (
    user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::int
  );

-- Policy: Admins can access any user config
CREATE POLICY "Allow admins full access to user config" ON public.user_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::int 
      AND role = 'admin'
    )
  );

-- Service role bypass for application server
CREATE POLICY "Allow service role full access to user config" ON public.user_config
  FOR ALL USING (
    current_user = 'supabase_admin'
    OR current_user LIKE 'service_role%'
  );

-- ============================================
-- Helper Functions
-- ============================================

-- Function to save or update user config
CREATE OR REPLACE FUNCTION public.save_user_config(
  p_user_id INTEGER,
  p_config_text TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_config (user_id, config_text)
  VALUES (p_user_id, p_config_text)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    config_text = p_config_text,
    updated_at = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Function to get user config
CREATE OR REPLACE FUNCTION public.get_user_config(
  p_user_id INTEGER
)
RETURNS TABLE (
  config_text TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.config_text,
    uc.updated_at
  FROM public.user_config uc
  WHERE uc.user_id = p_user_id;
END;
$$;

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_config_updated_at
  BEFORE UPDATE ON public.user_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
