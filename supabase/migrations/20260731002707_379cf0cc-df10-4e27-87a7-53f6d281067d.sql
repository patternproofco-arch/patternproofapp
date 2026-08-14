DROP POLICY IF EXISTS "granter manages" ON public.case_grants;

CREATE POLICY "owner attorney manages grants"
ON public.case_grants
FOR ALL
TO authenticated
USING (
  granted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = case_grants.client_link_id
      AND l.attorney_user_id = auth.uid()
  )
)
WITH CHECK (
  granted_by = auth.uid()
  AND attorney_user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = case_grants.client_link_id
      AND l.attorney_user_id = auth.uid()
      AND l.status = 'active'
  )
  AND EXISTS (
    SELECT 1
    FROM public.attorney_profiles me
    JOIN public.attorney_profiles them ON them.firm_id = me.firm_id
    WHERE me.user_id = auth.uid()
      AND me.firm_id IS NOT NULL
      AND them.user_id = case_grants.attorney_user_id
  )
);

REVOKE ALL ON public.referral_links FROM anon, authenticated;
GRANT ALL ON public.referral_links TO service_role;