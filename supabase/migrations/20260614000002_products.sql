-- Migration: products
-- Description: User-owned product catalog. Each row describes a product
--              the user is marketing (one row per SKU/variant, typically).
-- Tables: public.products

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  -- Stored as text to support "Rp 150.000", "$29.99", or ranges like "Rp 100rb-200rb".
  price TEXT,
  target_market TEXT,
  usp TEXT,
  benefits TEXT,
  -- Supabase Storage URL (private bucket `product-images/<user_id>/...`).
  image_url TEXT,
  reference_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS
  'User-owned product catalog. Source of truth for Product Studio.';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own products"
  ON public.products;
CREATE POLICY "Users can manage their own products"
  ON public.products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id
  ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at
  ON public.products(created_at DESC);
