DROP POLICY IF EXISTS "Attorneys manage their own checklist items" ON public.attorney_missing_evidence_checklist;

CREATE POLICY "Attorneys manage their own checklist items"
  ON public.attorney_missing_evidence_checklist
  FOR ALL
  USING (
    auth.uid() = attorney_user_id
    AND public.has_attorney_access(auth.uid(), client_user_id)
  )
  WITH CHECK (
    auth.uid() = attorney_user_id
    AND public.has_attorney_access(auth.uid(), client_user_id)
  );