
-- Phase 1 trust & safety: soft-delete + incident provenance + tighten case_grants policy.

-- 1) Soft-delete columns on incidents and evidence
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.evidence  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS incidents_deleted_at_idx ON public.incidents (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS evidence_deleted_at_idx  ON public.evidence  (user_id) WHERE deleted_at IS NULL;

-- 2) Incident provenance
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'survivor',
  ADD COLUMN IF NOT EXISTS source_evidence_id uuid REFERENCES public.evidence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confidence numeric;

-- Backfill: existing rows are survivor-authored & implicitly confirmed at creation.
UPDATE public.incidents
   SET source = 'survivor',
       confirmed_at = COALESCE(confirmed_at, created_at)
 WHERE source IS NULL OR source = 'survivor' AND confirmed_at IS NULL;

-- Allow-list source values (validation trigger keeps constraints time-safe).
CREATE OR REPLACE FUNCTION public.incidents_validate_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS NULL OR NEW.source NOT IN ('survivor','ai_extracted') THEN
    RAISE EXCEPTION 'incidents.source must be survivor or ai_extracted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_validate_source_trg ON public.incidents;
CREATE TRIGGER incidents_validate_source_trg
BEFORE INSERT OR UPDATE OF source ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.incidents_validate_source();

-- 3) Tighten case_grants policy: the granter must actually own or manage the
--    referenced client link (attorney owner or the client themselves), not just
--    be the auth user putting their own uid in granted_by.
DROP POLICY IF EXISTS "granter manages" ON public.case_grants;
CREATE POLICY "granter manages"
ON public.case_grants
TO authenticated
USING (
  granted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = case_grants.client_link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
  )
)
WITH CHECK (
  granted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = case_grants.client_link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
  )
);
