-- Conservative correction boundary: end the relevant disclosure before
-- rewriting its contents. Adding a separate private record remains possible.
CREATE OR REPLACE FUNCTION public.record_has_live_disclosure(owner_id uuid, record_id uuid, record_kind text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT to_jsonb(l) AS disclosure FROM public.attorney_client_links l WHERE l.client_user_id = owner_id
      UNION ALL SELECT to_jsonb(l) FROM public.advocate_client_links l WHERE l.client_user_id = owner_id
      UNION ALL SELECT to_jsonb(i) FROM public.attorney_invitations i WHERE i.client_user_id = owner_id
      UNION ALL SELECT to_jsonb(i) FROM public.advocate_invitations i WHERE i.client_user_id = owner_id
    ) disclosures
    WHERE disclosure->>'status' IN ('active', 'pending') AND disclosure->>'revoked_at' IS NULL
      AND (disclosure->>'expires_at' IS NULL OR (disclosure->>'expires_at')::timestamptz > now())
      AND (
        coalesce((disclosure->>CASE WHEN record_kind = 'incident' THEN 'include_all_incidents' ELSE 'include_all_evidence' END)::boolean, false)
        OR (disclosure->CASE WHEN record_kind = 'incident' THEN 'scope_incidents' ELSE 'scope_evidence' END) ? record_id::text
        -- Conservative for case-based legacy grants whose exact ids were not stored.
        OR EXISTS (SELECT 1 FROM public.cases c WHERE c.user_id = owner_id
          AND c.id::text = disclosure->>'case_id' AND (
            (record_kind = 'incident' AND record_id = ANY(c.highlighted_incident_ids))
            OR (record_kind = 'evidence' AND record_id = ANY(c.attached_evidence_ids))))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.attorney_access a WHERE a.user_id = owner_id AND a.revoked_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND ((record_kind = 'incident' AND record_id = ANY(a.shared_incident_ids))
        OR (record_kind = 'evidence' AND record_id = ANY(a.shared_evidence_ids)))
  );
$$;
REVOKE ALL ON FUNCTION public.record_has_live_disclosure(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preserve_incident_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Record ownership cannot be transferred'; END IF;
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'share_readiness', 'confirmed_at', 'deleted_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'share_readiness', 'confirmed_at', 'deleted_at']) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text, 0));
    IF public.record_has_live_disclosure(OLD.user_id, OLD.id, 'incident') THEN
      RAISE EXCEPTION 'This entry is shared. End its sharing and pending invitations before changing it, or add a separate private correction';
    END IF;
    INSERT INTO public.incident_revisions (incident_id, user_id, changed_by, prior_record)
      VALUES (OLD.id, OLD.user_id, auth.uid(), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.evidence_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(), changed_by uuid,
  prior_record jsonb NOT NULL
);
CREATE INDEX evidence_revisions_history_idx ON public.evidence_revisions(evidence_id, changed_at DESC, id);
ALTER TABLE public.evidence_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evidence_revisions TO authenticated;
GRANT ALL ON public.evidence_revisions TO service_role;
CREATE POLICY "Survivor reads own source history" ON public.evidence_revisions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.preserve_evidence_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Record ownership cannot be transferred'; END IF;
  -- Preserve the stored upload. A replacement must be a new source record.
  IF NEW.file_url IS DISTINCT FROM OLD.file_url OR
    (OLD.sha256 IS NOT NULL AND NEW.sha256 IS DISTINCT FROM OLD.sha256) THEN
    RAISE EXCEPTION 'The preserved upload cannot be replaced. Add a new file instead';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'share_readiness', 'deleted_at', 'review_status', 'integrity_verified_at',
      'transcript_status', 'transcript_verified_at', 'transcript_verified_by', 'extraction_status', 'extracted_at',
      'extraction_verified_at', 'extraction_verified_by', 'near_duplicate_status', 'family_id'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'share_readiness', 'deleted_at', 'review_status', 'integrity_verified_at',
      'transcript_status', 'transcript_verified_at', 'transcript_verified_by', 'extraction_status', 'extracted_at',
      'extraction_verified_at', 'extraction_verified_by', 'near_duplicate_status', 'family_id']) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text, 0));
    IF public.record_has_live_disclosure(OLD.user_id, OLD.id, 'evidence') THEN
      RAISE EXCEPTION 'This file is shared. End its sharing and pending invitations before changing its details';
    END IF;
    INSERT INTO public.evidence_revisions(evidence_id, user_id, changed_by, prior_record)
      VALUES (OLD.id, OLD.user_id, auth.uid(), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_evidence_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER preserve_evidence_revision BEFORE UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.preserve_evidence_revision();

-- Sharing changes and record corrections use the same per-survivor lock.
CREATE OR REPLACE FUNCTION public.serialize_record_disclosure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid;
BEGIN
  owner_id := coalesce((to_jsonb(NEW)->>'client_user_id')::uuid, (to_jsonb(NEW)->>'user_id')::uuid);
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.serialize_record_disclosure() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER serialize_record_disclosure BEFORE INSERT OR UPDATE ON public.attorney_client_links FOR EACH ROW EXECUTE FUNCTION public.serialize_record_disclosure();
CREATE TRIGGER serialize_record_disclosure BEFORE INSERT OR UPDATE ON public.advocate_client_links FOR EACH ROW EXECUTE FUNCTION public.serialize_record_disclosure();
CREATE TRIGGER serialize_record_disclosure BEFORE INSERT OR UPDATE ON public.attorney_invitations FOR EACH ROW EXECUTE FUNCTION public.serialize_record_disclosure();
CREATE TRIGGER serialize_record_disclosure BEFORE INSERT OR UPDATE ON public.advocate_invitations FOR EACH ROW EXECUTE FUNCTION public.serialize_record_disclosure();
CREATE TRIGGER serialize_record_disclosure BEFORE INSERT OR UPDATE ON public.attorney_access FOR EACH ROW EXECUTE FUNCTION public.serialize_record_disclosure();
