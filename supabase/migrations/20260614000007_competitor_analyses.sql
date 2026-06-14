-- Migration: competitor_analyses
-- Description: Stores the output of the Competitor Analysis feature
--              (TikTok / Shopee URL → content strategy breakdown).
-- Tables: public.competitor_analyses

CREATE TABLE IF NOT EXISTS public.competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tiktok_url TEXT,
  shopee_url TEXT,
  analysis_result JSONB NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.competitor_analyses IS
  'Output of Competitor Analysis. analysis_result schema is documented in docs/.';

ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own competitor_analyses"
  ON public.competitor_analyses;
CREATE POLICY "Users can manage their own competitor_analyses"
  ON public.competitor_analyses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_user_id
  ON public.competitor_analyses(user_id);
