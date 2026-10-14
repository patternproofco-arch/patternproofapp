-- Evidence reviews belong to a consent grant, not a reusable attorney/client pair.
ALTER TABLE public.attorney_evidence_reviews
 ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.attorney_client_links(id) ON DELETE CASCADE;
-- Preserve legacy rows. Bind only when exactly one grant existed during creation;
-- ambiguous rows remain unbound and inaccessible to professional readers.
WITH candidates AS (
 SELECT r.id,(array_agg(l.id))[1] AS link_id
 FROM public.attorney_evidence_reviews r JOIN public.attorney_client_links l
  ON l.attorney_user_id=r.attorney_user_id AND l.client_user_id=r.client_user_id
  AND l.created_at<=r.created_at
  AND (l.revoked_at IS NULL OR r.created_at<=l.revoked_at)
  AND (l.expires_at IS NULL OR r.created_at<=l.expires_at)
 WHERE r.link_id IS NULL GROUP BY r.id HAVING count(*)=1
)
UPDATE public.attorney_evidence_reviews r SET link_id=c.link_id FROM candidates c WHERE r.id=c.id;
ALTER TABLE public.attorney_evidence_reviews
 DROP CONSTRAINT IF EXISTS attorney_evidence_reviews_attorney_user_id_evidence_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS attorney_evidence_reviews_grant_evidence
 ON public.attorney_evidence_reviews(link_id,evidence_id);
CREATE INDEX IF NOT EXISTS attorney_evidence_reviews_grant_idx ON public.attorney_evidence_reviews(link_id);

CREATE OR REPLACE FUNCTION private.current_annotation_grant(_link_id uuid,_attorney_id uuid,_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid()=_attorney_id AND private.attorney_is_approved(_attorney_id)
 AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_attorney_id AND role='attorney')
 AND EXISTS (SELECT 1 FROM public.attorney_client_links l WHERE l.id=_link_id
  AND l.attorney_user_id=_attorney_id AND l.client_user_id=_client_id
  AND l.status='active' AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at>now()));
$$;
REVOKE ALL ON FUNCTION private.current_annotation_grant(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.current_annotation_grant(uuid,uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.annotation_record_shared(_link_id uuid,_attorney_id uuid,_client_id uuid,_kind text,_record_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.current_annotation_grant(_link_id,_attorney_id,_client_id) AND EXISTS (
  SELECT 1 FROM public.attorney_client_links l WHERE l.id=_link_id AND CASE _kind
  WHEN 'incident' THEN
   (_record_id=ANY(l.scope_incidents)) AND EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id=_record_id AND i.user_id=_client_id AND i.deleted_at IS NULL)
   AND (l.case_id IS NULL OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id=l.case_id AND c.user_id=_client_id AND _record_id=ANY(c.highlighted_incident_ids)))
  WHEN 'evidence' THEN
   (_record_id=ANY(l.scope_evidence)) AND EXISTS (
    SELECT 1 FROM public.evidence e WHERE e.id=_record_id AND e.user_id=_client_id AND e.deleted_at IS NULL)
   AND (l.case_id IS NULL OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id=l.case_id AND c.user_id=_client_id AND _record_id=ANY(c.attached_evidence_ids)))
  ELSE false END);
$$;
REVOKE ALL ON FUNCTION private.annotation_record_shared(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.annotation_record_shared(uuid,uuid,uuid,text,uuid) TO authenticated,service_role;

ALTER TABLE public.attorney_evidence_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_incident_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_missing_evidence_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Review grant and selected records" ON public.attorney_evidence_reviews;
CREATE POLICY "Review grant and selected records" ON public.attorney_evidence_reviews
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  auth.uid()=client_user_id OR (private.annotation_record_shared(link_id,auth.uid(),client_user_id,'evidence',evidence_id)
   AND (linked_incident_id IS NULL OR private.annotation_record_shared(link_id,auth.uid(),client_user_id,'incident',linked_incident_id))));
DROP POLICY IF EXISTS "Incident note grant and selected record" ON public.attorney_incident_notes;
CREATE POLICY "Incident note grant and selected record" ON public.attorney_incident_notes
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  auth.uid()=client_user_id OR private.annotation_record_shared(link_id,auth.uid(),client_user_id,'incident',incident_id));
DROP POLICY IF EXISTS "Checklist current grant only" ON public.attorney_missing_evidence_checklist;
CREATE POLICY "Checklist current grant only" ON public.attorney_missing_evidence_checklist
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  auth.uid()=client_user_id OR private.current_annotation_grant(link_id,auth.uid(),client_user_id));
-- These writes already run through authenticated, owner-checked server handlers.
-- Direct browser updates must not bypass their grant, selection or sender checks.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.attorney_evidence_reviews,public.attorney_incident_notes,
 public.attorney_missing_evidence_checklist,public.attorney_messages FROM PUBLIC,anon,authenticated;

-- Calendar entries have no case binding or explicit professional sharing control.
-- The application calendar is owner-only; a client link cannot expose other hearings.
DROP POLICY IF EXISTS "Calendar owner read boundary" ON public.court_dates;
CREATE POLICY "Calendar owner read boundary" ON public.court_dates
 AS RESTRICTIVE FOR SELECT TO authenticated USING (user_id=auth.uid());

-- The authenticated Clio handler only changes the unlink timestamp.
-- Prevent direct clients from changing the grant, author or destination metadata.
REVOKE UPDATE ON public.clio_matter_links FROM PUBLIC,anon,authenticated;
REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.court_dates,public.clio_matter_links FROM PUBLIC,anon,authenticated;
GRANT UPDATE(unlinked_at) ON public.clio_matter_links TO authenticated;
NOTIFY pgrst,'reload schema';
