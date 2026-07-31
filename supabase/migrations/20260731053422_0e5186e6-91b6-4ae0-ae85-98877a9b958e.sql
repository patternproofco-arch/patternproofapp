DROP POLICY IF EXISTS "Participants read links" ON public.attorney_client_links;
CREATE POLICY "Participants read links"
ON public.attorney_client_links
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_user_id
  OR (auth.uid() = attorney_user_id AND status = 'active' AND revoked_at IS NULL)
);

DROP POLICY IF EXISTS "Clients can view their own checklist" ON public.attorney_missing_evidence_checklist;
CREATE POLICY "Clients can view their own checklist"
ON public.attorney_missing_evidence_checklist
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_user_id
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_missing_evidence_checklist.attorney_user_id
      AND l.client_user_id = attorney_missing_evidence_checklist.client_user_id
      AND l.status = 'active'
      AND l.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS "grantee reads own" ON public.case_grants;
CREATE POLICY "grantee reads own"
ON public.case_grants
FOR SELECT
TO authenticated
USING (attorney_user_id = auth.uid() AND revoked_at IS NULL);