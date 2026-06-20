DROP POLICY IF EXISTS "Participants read messages" ON public.attorney_messages;

CREATE POLICY "Participants read messages"
ON public.attorney_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (
        l.client_user_id = auth.uid()
        OR (l.attorney_user_id = auth.uid() AND l.status = 'active')
      )
  )
);