DROP POLICY IF EXISTS "Attorneys create doc requests" ON public.attorney_document_requests;
CREATE POLICY "Attorneys create doc requests"
ON public.attorney_document_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = attorney_user_id
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_document_requests.link_id
      AND l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id  = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

DROP POLICY IF EXISTS "Attorney updates own notes" ON public.attorney_incident_notes;
CREATE POLICY "Attorney updates own notes"
  ON public.attorney_incident_notes
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = attorney_user_id
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_incident_notes.link_id
        AND l.attorney_user_id = auth.uid()
        AND l.client_user_id = attorney_incident_notes.client_user_id
        AND l.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = attorney_user_id
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_incident_notes.link_id
        AND l.attorney_user_id = auth.uid()
        AND l.client_user_id = attorney_incident_notes.client_user_id
        AND l.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Attorney deletes own notes" ON public.attorney_incident_notes;
CREATE POLICY "Attorney deletes own notes"
  ON public.attorney_incident_notes
  FOR DELETE TO authenticated
  USING (
    auth.uid() = attorney_user_id
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_incident_notes.link_id
        AND l.attorney_user_id = auth.uid()
        AND l.client_user_id = attorney_incident_notes.client_user_id
        AND l.status = 'active'
    )
  );