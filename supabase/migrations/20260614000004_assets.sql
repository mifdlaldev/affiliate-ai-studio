-- Migration: assets
-- Description: Unified asset library. Stores generated content (text,
--              image, document, video) with optional FK links to the
--              project and/or product that produced it.
-- Tables: public.assets

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- 'image' | 'text' | 'document' | 'video'
  type TEXT NOT NULL CHECK (type IN ('image', 'text', 'document', 'video')),
  -- 'hook' | 'script' | 'storyboard' | 'caption' | etc. Free-form for now.
  subtype TEXT,
  name TEXT NOT NULL,
  -- For images/videos uploaded to Supabase Storage.
  file_url TEXT,
  -- For text-based assets (hooks, scripts, captions, etc.).
  content TEXT,
  thumbnail_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assets IS
  'Unified asset library. One table for all generated content types.';

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own assets"
  ON public.assets;
CREATE POLICY "Users can manage their own assets"
  ON public.assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_user_id
  ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_type
  ON public.assets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_assets_user_project
  ON public.assets(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at
  ON public.assets(created_at DESC);
