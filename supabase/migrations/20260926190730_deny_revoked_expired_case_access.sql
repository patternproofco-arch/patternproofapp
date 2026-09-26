-- Follow-up to 20260924160000_honour_share_expiry_has_attorney_access.sql.
-- Direct RLS policies must also reject active-but-revoked and expired links.
-- Apply only after exercising fictional owner, collaborator, grantee and survivor
-- journeys on a staging clone; production has not been changed by this file.

-- These tables currently inherit broad privileges, including TRUNCATE, which
-- bypasses row-level policies. Restore only the client operations in use.
REVOKE ALL ON public.attorney_messages, public.time_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.attorney_messages TO authenticated;
GRANT UPDATE (read_at) ON public.attorney_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.time_entries TO authenticated;
GRANT UPDATE (description, minutes, billable, entry_date) ON public.time_entries TO authenticated;

DROP POLICY IF EXISTS "Participants read links" ON public.attorney_client_links;
CREATE POLICY "Participants read links" ON public.attorney_client_links
  FOR SELECT TO authenticated
  USING (
    auth.uid() = client_user_id OR
    (auth.uid() = attorney_user_id AND status = 'active'
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
  );

DROP POLICY IF EXISTS "Participants read messages" ON public.attorney_messages;
CREATE POLICY "Participants read messages" ON public.attorney_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND l.status = 'active' AND l.revoked_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND auth.uid() IN (l.client_user_id, l.attorney_user_id)
  ));

DROP POLICY IF EXISTS "Participants send messages" ON public.attorney_messages;
CREATE POLICY "Participants send messages" ON public.attorney_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_messages.link_id
        AND l.status = 'active' AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND auth.uid() IN (l.client_user_id, l.attorney_user_id)
    )
  );

DROP POLICY IF EXISTS "Recipients mark read" ON public.attorney_messages;
CREATE POLICY "Recipients mark read" ON public.attorney_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND l.status = 'active' AND l.revoked_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND auth.uid() IN (l.client_user_id, l.attorney_user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND l.status = 'active' AND l.revoked_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND auth.uid() IN (l.client_user_id, l.attorney_user_id)
  ));

-- Explicit SELECT/INSERT/UPDATE/DELETE policies replace the old author ALL
-- policy, which let an author read or delete their own row after losing access.
DROP POLICY IF EXISTS "time_entries author full access" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries case owner read" ON public.time_entries;

-- A current collaborator or firm grantee can operate only on the original link.
-- A grant is invalid as soon as either attorney leaves that firm.
CREATE OR REPLACE FUNCTION private.can_edit_time_entry_link(_user_id uuid, _link_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE _user_id = (SELECT auth.uid())
      AND l.id = _link_id AND l.status = 'active' AND l.revoked_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND (
        l.attorney_user_id = _user_id OR
        EXISTS (SELECT 1 FROM public.case_collaborators cc
          WHERE cc.link_id = l.id AND cc.collaborator_user_id = _user_id
            AND cc.status = 'active') OR
        EXISTS (SELECT 1 FROM public.case_grants g
          JOIN public.firm_members grantee ON grantee.user_id = g.attorney_user_id
          JOIN public.firm_members owner ON owner.user_id = l.attorney_user_id
            AND owner.firm_id = grantee.firm_id
          WHERE g.client_link_id = l.id AND g.attorney_user_id = _user_id
            AND g.revoked_at IS NULL)
      )
  );
$$;
REVOKE ALL ON FUNCTION private.can_edit_time_entry_link(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_edit_time_entry_link(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "time_entries author read while shared" ON public.time_entries
  FOR SELECT TO authenticated
  USING (attorney_user_id = auth.uid()
    AND private.can_edit_time_entry_link(auth.uid(), case_link_id));
CREATE POLICY "time_entries owner read while shared" ON public.time_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = time_entries.case_link_id AND l.attorney_user_id = auth.uid()
      AND l.status = 'active' AND l.revoked_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())));
CREATE POLICY "time_entries author insert while shared" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (attorney_user_id = auth.uid()
    AND private.can_edit_time_entry_link(auth.uid(), case_link_id));
CREATE POLICY "time_entries author update while shared" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (attorney_user_id = auth.uid()
    AND private.can_edit_time_entry_link(auth.uid(), case_link_id))
  WITH CHECK (attorney_user_id = auth.uid()
    AND private.can_edit_time_entry_link(auth.uid(), case_link_id));
CREATE POLICY "time_entries author delete while shared" ON public.time_entries
  FOR DELETE TO authenticated
  USING (attorney_user_id = auth.uid()
    AND private.can_edit_time_entry_link(auth.uid(), case_link_id));
