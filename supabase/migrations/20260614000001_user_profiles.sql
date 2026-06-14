-- Migration: user_profiles
-- Description: Extends auth.users with application-level profile data and
--              soft usage limits for AI generations. Auto-creates a profile
--              row whenever a new user signs up via Supabase Auth.
-- Tables: public.user_profiles
-- Functions: public.handle_new_user, public.update_updated_at_column
-- Triggers: on_auth_user_created, set_user_profiles_updated_at

-- =========================================================================
-- TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  monthly_generation_count INT NOT NULL DEFAULT 0,
  monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS
  'Per-user app profile. 1:1 with auth.users. Tracks usage limits.';

COMMENT ON COLUMN public.user_profiles.monthly_generation_count IS
  'Counter reset at the start of each calendar month; used by increment_user_usage().';

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile"
  ON public.user_profiles;
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile"
  ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile"
  ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================================================================
-- TRIGGERS
-- =========================================================================

-- Generic trigger function: bump updated_at on row UPDATE.
-- Reused by all tables that have an updated_at column.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at
  ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile row whenever a new auth user is inserted.
-- SECURITY DEFINER so the trigger can write even when the calling role
-- would otherwise be blocked by RLS on user_profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
