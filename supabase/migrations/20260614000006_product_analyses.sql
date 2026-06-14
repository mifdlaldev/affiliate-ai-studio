-- Migration: product_analyses
-- Description: Stores the structured output of the Product Auto-Analyze
--              feature (image + link → product detail fields).
-- Tables: public.product_analyses

CREATE TABLE IF NOT EXISTS public.product_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- 'image' | 'link' | 'both' — what inputs were used to produce the analysis.
  source_type TEXT NOT NULL CHECK (source_type IN ('image', 'link', 'both')),
  source_url TEXT,
  analysis_result JSONB NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_analyses IS
  'Output of Product Auto-Analyze. analysis_result schema is documented in docs/.';

ALTER TABLE public.product_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own product_analyses"
  ON public.product_analyses;
CREATE POLICY "Users can manage their own product_analyses"
  ON public.product_analyses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_product_analyses_user_id
  ON public.product_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_product_id
  ON public.product_analyses(product_id);
