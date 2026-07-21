
-- Phase B: evidence integrity foundations (additive, safe)

-- 1) Additive columns on evidence
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS bytes bigint,
  ADD COLUMN IF NOT EXISTS mime text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS raw_metadata jsonb,
  ADD COLUMN IF NOT EXISTS preservation_status text,
  ADD COLUMN IF NOT EXISTS preserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS integrity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS parent_evidence_id uuid REFERENCES public.evidence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derivative_kind text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

-- 2) import_batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_kind text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own import_batches" ON public.import_batches
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) evidence_families (duplicate grouping)
CREATE TABLE IF NOT EXISTS public.evidence_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  canonical_evidence_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_families TO authenticated;
GRANT ALL ON public.evidence_families TO service_role;
ALTER TABLE public.evidence_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence_families" ON public.evidence_families
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) audit_events — survivor-visible integrity/audit stream
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_kind text NOT NULL DEFAULT 'user',      -- user | system | ai | professional
  actor_id uuid,
  event_type text NOT NULL,                      -- upload_started, original_preserved, hash_generated, ...
  subject_kind text,                             -- evidence | incident | share | export | thread | ...
  subject_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
-- Owner-read only. No user-facing INSERT/UPDATE/DELETE: writes go through the SECURITY DEFINER helper.
CREATE POLICY "own audit_events read" ON public.audit_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS audit_events_user_created_idx
  ON public.audit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_subject_idx
  ON public.audit_events (subject_kind, subject_id);

-- Server-only helper for writing audit events. Callers must supply the acting user_id
-- (we validate via auth.uid() when a session is present).
CREATE OR REPLACE FUNCTION public.record_audit_event(
  p_user_id uuid,
  p_event_type text,
  p_subject_kind text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_actor_kind text DEFAULT 'user',
  p_actor_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- When called under an authenticated session, enforce that the caller can only
  -- write events for themselves. Server-role callers (auth.uid() IS NULL) may write freely.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'record_audit_event: not authorized for user %', p_user_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_events(user_id, event_type, subject_kind, subject_id, actor_kind, actor_id, meta)
  VALUES (p_user_id, p_event_type, p_subject_kind, p_subject_id, p_actor_kind, p_actor_id, p_meta)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_audit_event(uuid, text, text, uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit_event(uuid, text, text, uuid, text, uuid, jsonb) TO authenticated, service_role;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_import_batches_touch ON public.import_batches;
CREATE TRIGGER trg_import_batches_touch BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

DROP TRIGGER IF EXISTS trg_evidence_families_touch ON public.evidence_families;
CREATE TRIGGER trg_evidence_families_touch BEFORE UPDATE ON public.evidence_families
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
