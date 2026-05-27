
-- 1. Document requests: require active link on INSERT
DROP POLICY IF EXISTS "Attorneys create doc requests" ON public.attorney_document_requests;
CREATE POLICY "Attorneys create doc requests"
ON public.attorney_document_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = attorney_user_id
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

-- 2. Document requests: require active link on SELECT
DROP POLICY IF EXISTS "Participants read doc requests" ON public.attorney_document_requests;
CREATE POLICY "Participants read doc requests"
ON public.attorney_document_requests
FOR SELECT TO authenticated
USING (
  (auth.uid() = attorney_user_id OR auth.uid() = client_user_id)
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.attorney_user_id = attorney_document_requests.attorney_user_id
      AND l.client_user_id = attorney_document_requests.client_user_id
      AND l.status = 'active'
  )
);

-- 3. Attorney messages: require active link on SELECT
DROP POLICY IF EXISTS "Participants read messages" ON public.attorney_messages;
CREATE POLICY "Participants read messages"
ON public.attorney_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
      AND l.status = 'active'
  )
);

-- 4. Attorney messages: restrict UPDATE to only read_at column via column-level GRANT
DROP POLICY IF EXISTS "Recipients mark read" ON public.attorney_messages;

-- Revoke broad UPDATE and grant only on read_at column
REVOKE UPDATE ON public.attorney_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.attorney_messages TO authenticated;

CREATE POLICY "Recipients mark read"
ON public.attorney_messages
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
      AND l.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
      AND l.status = 'active'
  )
);
