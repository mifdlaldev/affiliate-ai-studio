-- Migration: increment_user_usage function
-- Description: Atomic check-and-increment of a user's monthly AI generation
--              counter. Resets the counter automatically when the calendar
--              month rolls over. Returns a single row with `allowed` and
--              `remaining` for the caller to surface in the UI.
-- Functions: public.increment_user_usage(p_user_id UUID)
-- Security:  SECURITY DEFINER so the function can update the row regardless
--            of RLS, and only accepts an explicit p_user_id (caller must
--            verify the auth.uid() matches in the calling code).

CREATE OR REPLACE FUNCTION public.increment_user_usage(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, remaining INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count    INT;
  v_reset_at TIMESTAMPTZ;
  v_limit    CONSTANT INT := 50;  -- Free-tier cap; move to a config table later.
BEGIN
  -- Lock the user row for the rest of the transaction so concurrent
  -- generations don't both pass the limit check.
  SELECT monthly_generation_count, monthly_reset_at
    INTO v_count, v_reset_at
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- No profile row: treat as "not allowed" and let the caller handle it.
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  -- New calendar month → reset and allow the first generation.
  IF date_trunc('month', v_reset_at) < date_trunc('month', now()) THEN
    UPDATE public.user_profiles
       SET monthly_generation_count = 1,
           monthly_reset_at         = now()
     WHERE id = p_user_id;
    RETURN QUERY SELECT TRUE, v_limit - 1;
    RETURN;
  END IF;

  -- Same month → enforce the cap.
  IF v_count >= v_limit THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  UPDATE public.user_profiles
     SET monthly_generation_count = monthly_generation_count + 1
   WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_limit - (v_count + 1);
END;
$$;

COMMENT ON FUNCTION public.increment_user_usage(UUID) IS
  'Atomic check-and-increment for monthly AI generation limit. Returns (allowed, remaining).';

-- Allow the PostgREST / API roles to call this function.
-- The function itself does not leak data — p_user_id is the only input
-- and the caller is responsible for passing their own auth.uid().
GRANT EXECUTE ON FUNCTION public.increment_user_usage(UUID)
  TO authenticated, service_role;
