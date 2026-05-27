
-- 1) attorney_client_links: explicit restrictive INSERT policy
CREATE POLICY "Attorney accepts matching invitation"
ON public.attorney_client_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = attorney_user_id
  AND EXISTS (
    SELECT 1 FROM public.attorney_invitations inv
    WHERE inv.client_user_id = attorney_client_links.client_user_id
      AND inv.status = 'pending'
      AND (inv.expires_at IS NULL OR inv.expires_at > now())
      AND lower(inv.attorney_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- 2) attorney_document_requests: DELETE policy for both parties
CREATE POLICY "Participants delete doc requests"
ON public.attorney_document_requests
FOR DELETE
TO authenticated
USING (auth.uid() = attorney_user_id OR auth.uid() = client_user_id);

-- 3) storage UPDATE policies (owner-scoped, mirroring INSERT/SELECT)
CREATE POLICY "evidence update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence-files' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'evidence-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "voice update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'voice-notes' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'voice-notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "own conv recordings update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'conversation-recordings' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'conversation-recordings' AND (auth.uid())::text = (storage.foldername(name))[1]);
