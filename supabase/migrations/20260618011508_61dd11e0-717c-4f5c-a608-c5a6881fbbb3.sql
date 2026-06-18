
-- Fix 1: attorney_document_requests policies must match the row's link_id
DROP POLICY IF EXISTS "Participants read doc requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Participants update doc requests" ON public.attorney_document_requests;
DROP POLICY IF EXISTS "Participants delete doc requests" ON public.attorney_document_requests;

CREATE POLICY "Participants read doc requests" ON public.attorney_document_requests
FOR SELECT USING (
  ((auth.uid() = attorney_user_id) OR (auth.uid() = client_user_id))
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_document_requests.link_id
      AND l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

CREATE POLICY "Participants update doc requests" ON public.attorney_document_requests
FOR UPDATE USING (
  ((auth.uid() = attorney_user_id) OR (auth.uid() = client_user_id))
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_document_requests.link_id
      AND l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
) WITH CHECK (
  ((auth.uid() = attorney_user_id) OR (auth.uid() = client_user_id))
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_document_requests.link_id
      AND l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

CREATE POLICY "Participants delete doc requests" ON public.attorney_document_requests
FOR DELETE USING (
  ((auth.uid() = attorney_user_id) OR (auth.uid() = client_user_id))
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_document_requests.link_id
      AND l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

-- Fix 2: allow reading message history after link revocation (INSERT still requires active link)
DROP POLICY IF EXISTS "Participants read messages" ON public.attorney_messages;
CREATE POLICY "Participants read messages" ON public.attorney_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
  )
);
