-- HELD DATABASE PROPOSAL. NOT APPLIED. Do not run until Grace approves and #254 is otherwise ready.
-- Intended for muy only, after the attorney bring-up (Section 1) is confirmed in place.
-- Deliberately kept out of drizzle/migrations so nothing applies it automatically.
-- Changes no existing rows. Safe to run twice.

-- 1) Two empty, nullable columns (reason text, and when it was emailed).
ALTER TABLE public.attorney_access_applications ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.attorney_access_applications ADD COLUMN IF NOT EXISTS decline_reason_emailed_at timestamptz;

-- 2) One function that declines AND saves the reason in a single transaction.
-- It calls the existing review_attorney_application (admin check, status, share revocation,
-- audit event), then stores the reason. If any step fails, the whole call rolls back.
CREATE OR REPLACE FUNCTION public.decline_attorney_application(_id uuid, _reviewer uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF _reason IS NULL OR btrim(_reason) = '' OR length(btrim(_reason)) > 1000 THEN
    RAISE EXCEPTION 'A reason of 1 to 1000 characters is required' USING ERRCODE = '22023';
  END IF;
  PERFORM public.review_attorney_application(_id, _reviewer, 'rejected');
  UPDATE public.attorney_access_applications
     SET decline_reason = btrim(_reason)
   WHERE id = _id;
END;
$$;
REVOKE ALL ON FUNCTION public.decline_attorney_application(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_attorney_application(uuid, uuid, text) TO service_role;

-- Undo (only if needed): DROP FUNCTION public.decline_attorney_application(uuid, uuid, text);
-- The two columns can stay; they are empty and unused without the function.
