-- Migration: generations
-- Description: Append-only log of every AI generation. Used for billing
--              visibility, debugging, and to surface history in the UI.
--              Mutations other than INSERT are not allowed by RLS so
--              generations are an immutable audit trail.
-- Tables: public.generations

CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- Module name: 'photo_prompt' | 'model_prompt' | 'competitor' | 'batch'
  --   | 'calendar' | 'ugc_hooks' | 'ugc_script' | 'ugc_storyboard'
  --   | 'ugc_prompt' | 'storyboard' | 'live_host' | 'marketplace'
  --   | 'social_media' | 'landing_page' | 'product_analyze'
  module TEXT NOT NULL,
  subtype TEXT,
  input_prompt TEXT,
  result JSONB,
  tokens_used INT,
  duration_ms INT,
  model TEXT NOT NULL,
  -- 'success' | 'failed' — failed rows still record cost + error.
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.generations IS
  'Append-only history of every AI generation. No UPDATE/DELETE policy.';

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own generations"
  ON public.generations;
CREATE POLICY "Users can view their own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own generations"
  ON public.generations;
CREATE POLICY "Users can insert their own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policy: generations are an audit log.

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generations_user_id
  ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_module
  ON public.generations(user_id, module);
CREATE INDEX IF NOT EXISTS idx_generations_user_project
  ON public.generations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON public.generations(created_at DESC);
