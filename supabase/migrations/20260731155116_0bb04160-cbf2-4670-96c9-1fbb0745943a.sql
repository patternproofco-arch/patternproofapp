DROP POLICY IF EXISTS "Attorney accepts matching invitation" ON public.attorney_client_links;

CREATE POLICY "Attorney accepts matching invitation"
ON public.attorney_client_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = attorney_user_id
  AND EXISTS (
    SELECT 1
    FROM public.attorney_invitations inv
    WHERE inv.id = attorney_client_links.invitation_id
      AND inv.client_user_id = attorney_client_links.client_user_id
      AND inv.status = 'pending'
      AND (inv.expires_at IS NULL OR inv.expires_at > now())
      AND lower(inv.attorney_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND attorney_client_links.include_all_incidents = inv.include_all_incidents
      AND attorney_client_links.include_all_evidence = inv.include_all_evidence
      AND attorney_client_links.include_patterns = inv.include_patterns
      AND attorney_client_links.scope_incidents <@ inv.scope_incidents
      AND attorney_client_links.scope_evidence <@ inv.scope_evidence
      AND attorney_client_links.case_id IS NOT DISTINCT FROM inv.case_id
  )
);