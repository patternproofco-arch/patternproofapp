
-- 1. Restrict client revocation on attorney_client_links with WITH CHECK
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;

CREATE POLICY "Clients revoke own links"
ON public.attorney_client_links
FOR UPDATE
TO authenticated
USING (auth.uid() = client_user_id)
WITH CHECK (
  auth.uid() = client_user_id
  AND status = 'revoked'
  AND revoked_at IS NOT NULL
);

-- 2. Require active link for updating document requests
DROP POLICY IF EXISTS "Participants update doc requests" ON public.attorney_document_requests;

CREATE POLICY "Participants update doc requests"
ON public.attorney_document_requests
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = attorney_user_id OR auth.uid() = client_user_id)
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
)
WITH CHECK (
  (auth.uid() = attorney_user_id OR auth.uid() = client_user_id)
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

-- 3. Require active link for deleting document requests
DROP POLICY IF EXISTS "Participants delete doc requests" ON public.attorney_document_requests;

CREATE POLICY "Participants delete doc requests"
ON public.attorney_document_requests
FOR DELETE
TO authenticated
USING (
  (auth.uid() = attorney_user_id OR auth.uid() = client_user_id)
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);
