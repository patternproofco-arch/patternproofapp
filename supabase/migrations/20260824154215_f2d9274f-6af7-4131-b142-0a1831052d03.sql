DROP POLICY IF EXISTS "time_entries author full access" ON public.time_entries;

CREATE POLICY "time_entries author full access"
  ON public.time_entries FOR ALL
  USING (attorney_user_id = auth.uid())
  WITH CHECK (
    attorney_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = time_entries.case_link_id
        AND l.status = 'active'
        AND (
          l.attorney_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.case_collaborators cc
            WHERE cc.link_id = l.id AND cc.collaborator_user_id = auth.uid() AND cc.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.case_grants g
            WHERE g.client_link_id = l.id AND g.attorney_user_id = auth.uid() AND g.revoked_at IS NULL
          )
        )
    )
  );

DROP POLICY IF EXISTS "time_entries case owner read" ON public.time_entries;

CREATE POLICY "time_entries case owner read"
  ON public.time_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = time_entries.case_link_id
      AND l.attorney_user_id = auth.uid()
      AND l.status = 'active'
  ));

DROP POLICY IF EXISTS "own audit" ON public.audit_log;

CREATE POLICY "own audit select" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;