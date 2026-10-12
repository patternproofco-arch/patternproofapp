-- CPS / child-protection professional access (additive). See docs/cps-portal-spec.md.
-- Every write goes through server code with the service role. The browser can only read
-- its own rows. Access is: approved worker AND active, unrevoked, unexpired link.

-- Domains the founder accepts for instant approval (seeded from the CISA .gov registry).
CREATE TABLE IF NOT EXISTS public.cps_allowed_domains (
 domain text PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9.-]+[.][a-z]{2,}$'),
 agency_name text NOT NULL,
 state text,
 source text NOT NULL DEFAULT 'manual',
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cps_allowed_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_allowed_domains FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cps_allowed_domains TO service_role;

-- Addresses and domains the founder has blocked (impersonators, people removed).
CREATE TABLE IF NOT EXISTS public.cps_denied_senders (
 value text PRIMARY KEY CHECK (value = lower(value) AND length(value) <= 255),
 reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cps_denied_senders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_denied_senders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cps_denied_senders TO service_role;

CREATE TABLE IF NOT EXISTS public.cps_access_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, full_name text NOT NULL,
 agency_name text NOT NULL, jurisdiction text NOT NULL,
 professional_type text NOT NULL CHECK (professional_type IN ('agency_caseworker','licensed_social_worker','gal_or_court')),
 email_domain text NOT NULL,
 license_number text, license_state text,
 verification_tier smallint CHECK (verification_tier IN (1,2,3)),
 status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','suspended')),
 email_verified_at timestamptz,
 approved_at timestamptz, reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
 suspended_at timestamptz, suspended_reason text,
 reverify_due_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cps_access_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_access_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cps_access_applications TO authenticated;
GRANT ALL ON public.cps_access_applications TO service_role;
DROP POLICY IF EXISTS "Applicant reads own cps review" ON public.cps_access_applications;
CREATE POLICY "Applicant reads own cps review" ON public.cps_access_applications
 FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- An invitation is a request, not access. No free text: the message is a fixed template.
CREATE TABLE IF NOT EXISTS public.cps_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 worker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 survivor_email text NOT NULL CHECK (survivor_email = lower(survivor_email) AND length(survivor_email) <= 255),
 token_hash text NOT NULL UNIQUE,
 case_ref text CHECK (case_ref IS NULL OR length(case_ref) <= 60),
 status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','declined','expired','revoked','suppressed')),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cps_invitations_worker_day_idx ON public.cps_invitations(worker_user_id, created_at);
ALTER TABLE public.cps_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cps_invitations TO service_role;

-- The grant. Exact items only, a hard expiry, and it can only ever get narrower.
CREATE TABLE IF NOT EXISTS public.cps_client_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 worker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 invitation_id uuid REFERENCES public.cps_invitations(id) ON DELETE SET NULL,
 case_ref text CHECK (case_ref IS NULL OR length(case_ref) <= 60),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 scope_incidents text[] NOT NULL DEFAULT '{}',
 scope_evidence text[] NOT NULL DEFAULT '{}',
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '90 days')
);
CREATE INDEX IF NOT EXISTS cps_links_worker_idx ON public.cps_client_links(worker_user_id);
CREATE INDEX IF NOT EXISTS cps_links_client_idx ON public.cps_client_links(client_user_id);
ALTER TABLE public.cps_client_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_client_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cps_client_links TO authenticated;
GRANT ALL ON public.cps_client_links TO service_role;

CREATE OR REPLACE FUNCTION private.cps_is_approved(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.cps_access_applications a
  WHERE a.user_id = _id AND a.status = 'approved' AND a.suspended_at IS NULL
   AND (a.reverify_due_at IS NULL OR a.reverify_due_at > now())
 ) AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _id AND r.role::text = 'cps_worker');
$$;
REVOKE ALL ON FUNCTION private.cps_is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cps_is_approved(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_cps_access(_worker_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT private.cps_is_approved(_worker_id) AND EXISTS (
  SELECT 1 FROM public.cps_client_links WHERE worker_user_id = _worker_id
   AND client_user_id = _client_id AND status = 'active' AND revoked_at IS NULL
   AND expires_at > now());
$$;
REVOKE ALL ON FUNCTION private.has_cps_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_cps_access(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Client reads own cps links" ON public.cps_client_links;
CREATE POLICY "Client reads own cps links" ON public.cps_client_links
 FOR SELECT TO authenticated USING (client_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Approved live cps links only" ON public.cps_client_links;
CREATE POLICY "Approved live cps links only" ON public.cps_client_links
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  client_user_id = (SELECT auth.uid()) OR (
   worker_user_id = (SELECT auth.uid()) AND private.cps_is_approved(worker_user_id)
   AND status = 'active' AND revoked_at IS NULL AND expires_at > now()));

-- A grant can only get narrower, never wider, and a withdrawn one never comes back,
-- even for trusted server code.
CREATE OR REPLACE FUNCTION private.cps_link_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.worker_user_id IS DISTINCT FROM OLD.worker_user_id
  OR NEW.client_user_id IS DISTINCT FROM OLD.client_user_id
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'cps link parties are fixed' USING ERRCODE = '42501';
 END IF;
 IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.status <> 'revoked') THEN
  RAISE EXCEPTION 'a revoked cps link cannot be restored' USING ERRCODE = '42501';
 END IF;
 IF NOT (NEW.scope_incidents <@ OLD.scope_incidents AND NEW.scope_evidence <@ OLD.scope_evidence) THEN
  RAISE EXCEPTION 'a cps link can only be narrowed' USING ERRCODE = '42501';
 END IF;
 IF NEW.expires_at > OLD.expires_at THEN
  RAISE EXCEPTION 'a cps link cannot be extended; make a new one' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.cps_link_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cps_link_guard ON public.cps_client_links;
CREATE TRIGGER cps_link_guard BEFORE UPDATE ON public.cps_client_links
 FOR EACH ROW EXECUTE FUNCTION private.cps_link_guard();

-- Every view by a worker. The survivor reads it; nobody can change a row.
CREATE TABLE IF NOT EXISTS public.cps_access_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 link_id uuid NOT NULL REFERENCES public.cps_client_links(id) ON DELETE CASCADE,
 worker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 item_kind text NOT NULL CHECK (item_kind IN ('incident','evidence','packet')),
 item_id text,
 viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cps_access_log_client_idx ON public.cps_access_log(client_user_id, viewed_at DESC);
ALTER TABLE public.cps_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cps_access_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cps_access_log TO authenticated;
GRANT ALL ON public.cps_access_log TO service_role;
DROP POLICY IF EXISTS "Client reads own cps access log" ON public.cps_access_log;
CREATE POLICY "Client reads own cps access log" ON public.cps_access_log
 FOR SELECT TO authenticated USING (client_user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.cps_log_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 RAISE EXCEPTION 'cps access log rows cannot be changed' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.cps_log_append_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cps_log_append_only ON public.cps_access_log;
CREATE TRIGGER cps_log_append_only BEFORE UPDATE ON public.cps_access_log
 FOR EACH ROW EXECUTE FUNCTION private.cps_log_append_only();

-- Does this address already have an account? Server-only, used to honor a survivor's block
-- before any invitation email is sent. Never reachable from the browser.
CREATE OR REPLACE FUNCTION public.cps_user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cps_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cps_user_id_by_email(text) TO service_role;
