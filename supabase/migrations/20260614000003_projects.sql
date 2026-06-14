-- Migration: projects
-- Description: User-owned project containers that group related products
--              and assets (campaigns, reviews, unboxings).
-- Tables: public.projects

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- 'Aktif' (active) or 'Diarsipkan' (archived). Indonesian labels to
  -- match product copy in the dashboard.
  status TEXT NOT NULL DEFAULT 'Aktif'
    CHECK (status IN ('Aktif', 'Diarsipkan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

COMMENT ON TABLE public.projects IS
  'User-owned project containers (campaigns, reviews, unboxings).';

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own projects"
  ON public.projects;
CREATE POLICY "Users can manage their own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects(user_id);
-- Composite for the most common list query: "active projects for this user".
CREATE INDEX IF NOT EXISTS idx_projects_user_status
  ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON public.projects(created_at DESC);
