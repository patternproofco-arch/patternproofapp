BEGIN;

ALTER TABLE public.attorney_document_requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'document',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_note text,
  ADD COLUMN IF NOT EXISTS response_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_outcome text;
ALTER TABLE public.attorney_document_requests DROP CONSTRAINT IF EXISTS request_response_outcome_check;
ALTER TABLE public.attorney_document_requests
  ADD CONSTRAINT request_response_outcome_check CHECK (
    response_outcome IS NULL OR response_outcome IN ('answer', 'unavailable', 'help_requested', 'declined')
  );

DROP POLICY IF EXISTS "Participants read doc requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Participants update doc requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Survivor reads own requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Survivor request read" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Survivor edits open drafts" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Attorneys create doc requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Attorneys request from an active client" ON public.attorney_document_requests;
CREATE POLICY "Survivor reads own requests" ON public.attorney_document_requests
  AS RESTRICTIVE FOR SELECT TO authenticated USING (client_user_id = auth.uid());
CREATE POLICY "Survivor request read" ON public.attorney_document_requests
  FOR SELECT TO authenticated USING (client_user_id = auth.uid());
CREATE POLICY "Survivor edits open drafts" ON public.attorney_document_requests
  FOR UPDATE TO authenticated USING (client_user_id = auth.uid() AND status = 'open')
  WITH CHECK (client_user_id = auth.uid() AND status = 'open');
REVOKE UPDATE ON public.attorney_document_requests FROM authenticated;
GRANT UPDATE (response_note, response_evidence_ids, draft_saved_at)
  ON public.attorney_document_requests TO authenticated;
CREATE POLICY "Attorneys request from an active client" ON public.attorney_document_requests
  FOR INSERT TO authenticated WITH CHECK (
    attorney_user_id = auth.uid() AND status = 'open' AND response_outcome IS NULL
    AND EXISTS (SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = link_id AND l.attorney_user_id = auth.uid()
        AND l.client_user_id = attorney_document_requests.client_user_id
        AND l.status = 'active' AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now()))
  );
REVOKE INSERT ON public.attorney_document_requests FROM authenticated;
GRANT INSERT (link_id, attorney_user_id, client_user_id, title, details, kind, due_at)
  ON public.attorney_document_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_evidence_request(
  p_request_id uuid, p_action text, p_note text DEFAULT '', p_evidence_ids uuid[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  request_row public.attorney_document_requests%ROWTYPE;
  link_row public.attorney_client_links%ROWTYPE;
  link_id uuid;
  chosen uuid[];
  finished timestamptz := now();
BEGIN
  IF actor IS NULL OR p_action IS NULL OR p_action NOT IN ('submit', 'unavailable', 'help_requested', 'decline') THEN
    RAISE EXCEPTION 'Invalid request response';
  END IF;
  IF length(coalesce(p_note, '')) > 4000 OR cardinality(coalesce(p_evidence_ids, '{}')) > 40 THEN
    RAISE EXCEPTION 'Response is too large';
  END IF;
  SELECT r.link_id INTO link_id FROM public.attorney_document_requests r
    WHERE r.id = p_request_id AND r.client_user_id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  SELECT * INTO link_row FROM public.attorney_client_links l
    WHERE l.id = link_id AND l.client_user_id = actor FOR UPDATE;
  finished := clock_timestamp();
  IF NOT FOUND OR link_row.status <> 'active' OR link_row.revoked_at IS NOT NULL
    OR (link_row.expires_at IS NOT NULL AND link_row.expires_at <= finished) THEN
    RAISE EXCEPTION 'Sharing has ended; nothing was sent';
  END IF;
  SELECT * INTO request_row FROM public.attorney_document_requests r
    WHERE r.id = p_request_id AND r.client_user_id = actor FOR UPDATE;
  IF request_row.status <> 'open' THEN RAISE EXCEPTION 'Request already answered'; END IF;
  IF request_row.link_id IS DISTINCT FROM link_row.id
    OR request_row.attorney_user_id IS DISTINCT FROM link_row.attorney_user_id THEN
    RAISE EXCEPTION 'Recipient changed; review sharing before responding';
  END IF;

  IF p_action = 'submit' THEN
    SELECT coalesce(array_agg(DISTINCT id), '{}') INTO chosen FROM unnest(coalesce(p_evidence_ids, '{}')) id;
    IF EXISTS (SELECT 1 FROM unnest(chosen) selected(file_id) WHERE selected.file_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.evidence e WHERE e.id = selected.file_id AND e.user_id = actor AND e.deleted_at IS NULL
    )) THEN RAISE EXCEPTION 'A selected file is unavailable; nothing was sent'; END IF;
    IF cardinality(chosen) = 0 AND btrim(coalesce(p_note, '')) = '' THEN
      RAISE EXCEPTION 'Add a note or choose a file';
    END IF;
    UPDATE public.attorney_client_links SET scope_evidence = ARRAY(
      SELECT DISTINCT id FROM unnest(coalesce(link_row.scope_evidence, '{}') || chosen) id
    ) WHERE id = link_id;
    UPDATE public.attorney_document_requests SET status = 'submitted', response_outcome = 'answer',
      response_note = nullif(btrim(p_note), ''), response_evidence_ids = chosen,
      submitted_at = finished, completed_at = finished WHERE id = p_request_id;
    RETURN jsonb_build_object('shared', cardinality(chosen));
  END IF;

  UPDATE public.attorney_document_requests SET
    status = CASE WHEN p_action = 'help_requested' THEN 'open' ELSE 'declined' END,
    response_outcome = CASE WHEN p_action = 'decline' THEN 'declined' ELSE p_action END,
    response_note = CASE WHEN p_action = 'help_requested' THEN response_note ELSE NULL END,
    response_evidence_ids = CASE WHEN p_action = 'help_requested' THEN response_evidence_ids ELSE '{}' END,
    declined_at = CASE WHEN p_action = 'help_requested' THEN NULL ELSE finished END,
    completed_at = CASE WHEN p_action = 'help_requested' THEN NULL ELSE finished END
    WHERE id = p_request_id;
  RETURN jsonb_build_object('shared', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_evidence_request(uuid, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_evidence_request(uuid, text, text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  c_consent_keys constant text[] := ARRAY['clio_share_consent', 'clio_share_consent_at', 'updated_at'];
  c_revoke_keys constant text[] := ARRAY['status', 'revoked_at', 'updated_at'];
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  IF current_user NOT IN ('authenticated', 'anon')
    AND current_user = pg_catalog.pg_get_userbyid((SELECT proowner FROM pg_catalog.pg_proc
      WHERE oid = 'public.respond_to_evidence_request(uuid,text,text,uuid[])'::regprocedure))
    AND (v_new - 'scope_evidence') = (v_old - 'scope_evidence')
    AND coalesce(NEW.scope_evidence, '{}') @> coalesce(OLD.scope_evidence, '{}') THEN
    RETURN NEW;
  END IF;

  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status = 'revoked'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND (v_new - c_revoke_keys) = (v_old - c_revoke_keys)
    THEN
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only a one-way revoke (status revoked + revoked_at set, nothing else) is allowed here'
      USING ERRCODE = '42501';
  END IF;

  IF (v_new - c_consent_keys) = (v_old - c_consent_keys) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
    USING ERRCODE = '42501';
END;
$$;

CREATE TABLE IF NOT EXISTS public.incident_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  prior_record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS incident_revisions_history_idx ON public.incident_revisions (incident_id, changed_at DESC, id);
ALTER TABLE public.incident_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incident_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.incident_revisions TO authenticated;
GRANT ALL ON public.incident_revisions TO service_role;
DROP POLICY IF EXISTS "Survivor reads own correction history" ON public.incident_revisions;
CREATE POLICY "Survivor reads own correction history" ON public.incident_revisions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.preserve_incident_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Record ownership cannot be transferred';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'share_readiness', 'confirmed_at', 'deleted_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'share_readiness', 'confirmed_at', 'deleted_at']) THEN
    INSERT INTO public.incident_revisions (incident_id, user_id, changed_by, prior_record)
      VALUES (OLD.id, OLD.user_id, auth.uid(), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_incident_revision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS preserve_incident_revision ON public.incidents;
CREATE TRIGGER preserve_incident_revision BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.preserve_incident_revision();
COMMIT;