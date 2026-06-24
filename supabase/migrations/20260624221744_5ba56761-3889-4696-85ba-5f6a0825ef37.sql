
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.attorney_client_links
    WHERE attorney_user_id = _attorney_id AND client_user_id = _client_id AND status = 'active')
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'sandbox')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid AND environment = check_env
    AND ((status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())))
$$;

REVOKE ALL ON FUNCTION private.has_attorney_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_active_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_attorney_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_active_subscription(uuid, text) TO authenticated, service_role;

-- Repoint policies to private.has_attorney_access
DROP POLICY IF EXISTS "Linked attorneys can view client court dates" ON public.court_dates;
CREATE POLICY "Linked attorneys can view client court dates" ON public.court_dates
  FOR SELECT TO authenticated USING (private.has_attorney_access(auth.uid(), user_id));

DROP POLICY IF EXISTS "Attorneys manage their own checklist items" ON public.attorney_missing_evidence_checklist;
CREATE POLICY "Attorneys manage their own checklist items" ON public.attorney_missing_evidence_checklist
  FOR ALL TO authenticated
  USING ((auth.uid() = attorney_user_id) AND private.has_attorney_access(auth.uid(), client_user_id))
  WITH CHECK ((auth.uid() = attorney_user_id) AND private.has_attorney_access(auth.uid(), client_user_id));

DROP POLICY IF EXISTS "Attorneys manage their own evidence reviews" ON public.attorney_evidence_reviews;
CREATE POLICY "Attorneys manage their own evidence reviews" ON public.attorney_evidence_reviews
  FOR ALL TO authenticated
  USING ((auth.uid() = attorney_user_id) AND private.has_attorney_access(auth.uid(), client_user_id))
  WITH CHECK ((auth.uid() = attorney_user_id) AND private.has_attorney_access(auth.uid(), client_user_id));

-- Drop the public-schema copies so they aren't exposed via the API
DROP FUNCTION IF EXISTS public.has_attorney_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_active_subscription(uuid, text);

-- attorney_messages: require active link for client reads too
DROP POLICY IF EXISTS "Participants read messages" ON public.attorney_messages;
CREATE POLICY "Participants read messages" ON public.attorney_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_messages.link_id
        AND l.status = 'active'
        AND (l.client_user_id = auth.uid() OR l.attorney_user_id = auth.uid())
    )
  );

-- attorney_survivor_invites: allow the invited survivor to read their own invite
DROP POLICY IF EXISTS "Invited survivors can read their invites" ON public.attorney_survivor_invites;
CREATE POLICY "Invited survivors can read their invites" ON public.attorney_survivor_invites
  FOR SELECT TO authenticated USING (
    accepted_by = auth.uid()
    OR lower(survivor_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
