-- Server-owned consent mutations and founder attorney approval. No data is grandfathered.
CREATE TABLE IF NOT EXISTS public.attorney_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, full_name text NOT NULL, firm_name text,
 bar_number text NOT NULL, jurisdiction text NOT NULL,
 status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorney_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_applications FROM anon, authenticated;
GRANT SELECT ON public.attorney_applications TO authenticated;
GRANT ALL ON public.attorney_applications TO service_role;
DROP POLICY IF EXISTS "Applicant reads own review" ON public.attorney_applications;
CREATE POLICY "Applicant reads own review" ON public.attorney_applications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.founder_attorney_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL,
 token_hash text NOT NULL UNIQUE, invited_by uuid NOT NULL REFERENCES auth.users(id),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.founder_attorney_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.founder_attorney_invites FROM anon, authenticated;
GRANT ALL ON public.founder_attorney_invites TO service_role;

CREATE OR REPLACE FUNCTION private.attorney_is_approved(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.attorney_applications WHERE user_id = _id AND status = 'approved');
$$;
REVOKE ALL ON FUNCTION private.attorney_is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.attorney_is_approved(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Clients manage clio share consent" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Attorney accepts matching invitation" ON public.attorney_client_links;
REVOKE INSERT, UPDATE, DELETE ON public.attorney_client_links FROM anon, authenticated;
DROP POLICY IF EXISTS "Survivor updates own grants" ON public.consent_grants;
REVOKE INSERT, UPDATE, DELETE ON public.consent_grants FROM anon, authenticated;

-- RLS compares both caller approval and the actual grant's lifetime.
DROP POLICY IF EXISTS "Approved live attorney links only" ON public.attorney_client_links;
CREATE POLICY "Approved live attorney links only" ON public.attorney_client_links
AS RESTRICTIVE FOR SELECT TO authenticated USING (
 auth.uid() = client_user_id OR (
 private.attorney_is_approved(auth.uid()) AND private.attorney_is_approved(attorney_user_id)
 AND status = 'active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
 ));
CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT private.attorney_is_approved(_attorney_id) AND EXISTS (
 SELECT 1 FROM public.attorney_client_links WHERE attorney_user_id = _attorney_id
 AND client_user_id = _client_id AND status = 'active' AND revoked_at IS NULL
 AND (expires_at IS NULL OR expires_at > now()));
$$;
REVOKE ALL ON FUNCTION private.has_attorney_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_attorney_access(uuid,uuid) TO authenticated, service_role;

-- Even trusted server code cannot resurrect a withdrawn/expired grant in place.
CREATE OR REPLACE FUNCTION private.prevent_grant_resurrection()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 -- Freeze the tombstone and expiry even during an intermediate paused state.
 IF OLD.status = 'revoked' AND NEW.status IS DISTINCT FROM OLD.status THEN
  RAISE EXCEPTION 'Revoked status is permanent' USING ERRCODE = '42501';
 END IF;
 IF OLD.expires_at IS NOT NULL AND OLD.expires_at <= now()
 AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
  RAISE EXCEPTION 'Expired grant lifetime is permanent' USING ERRCODE = '42501';
 END IF;
 IF (OLD.status = 'revoked' OR OLD.revoked_at IS NOT NULL OR
     (OLD.expires_at IS NOT NULL AND OLD.expires_at <= now())) AND
    (NEW.status = 'active' AND NEW.revoked_at IS NULL AND
     (NEW.expires_at IS NULL OR NEW.expires_at > now())) THEN
  RAISE EXCEPTION 'Withdrawn or expired grants cannot be reactivated' USING ERRCODE = '42501';
 END IF;
 IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
  RAISE EXCEPTION 'Revocation is permanent' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_attorney_grant_resurrection ON public.attorney_client_links;
CREATE TRIGGER prevent_attorney_grant_resurrection BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION private.prevent_grant_resurrection();
DROP TRIGGER IF EXISTS prevent_consent_grant_resurrection ON public.consent_grants;
CREATE TRIGGER prevent_consent_grant_resurrection BEFORE UPDATE ON public.consent_grants
FOR EACH ROW EXECUTE FUNCTION private.prevent_grant_resurrection();

-- Dedicated authenticated endpoint: the owner cannot choose protected columns.
CREATE OR REPLACE FUNCTION public.set_my_clio_share_consent(_link_id uuid, _consent boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _row public.attorney_client_links;
BEGIN
 IF auth.uid() IS NULL OR _consent IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
 SELECT * INTO _row FROM public.attorney_client_links WHERE id = _link_id
 AND client_user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND OR _row.status <> 'active' OR _row.revoked_at IS NOT NULL OR
 (_row.expires_at IS NOT NULL AND _row.expires_at <= now()) THEN
 RAISE EXCEPTION 'No active owned grant' USING ERRCODE = '42501'; END IF;
 UPDATE public.attorney_client_links SET clio_share_consent = _consent,
 clio_share_consent_at = CASE WHEN _consent THEN now() ELSE NULL END WHERE id = _row.id;
 PERFORM public.record_audit_event(auth.uid(), 'clio_consent_changed', 'attorney_client_links', _row.id,
 'survivor', auth.uid(), jsonb_build_object('consent', _consent));
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_clio_share_consent(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_clio_share_consent(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_my_consent_grant(_grant_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
 UPDATE public.consent_grants SET status = 'revoked', revoked_at = now()
 WHERE id = _grant_id AND survivor_user_id = auth.uid() AND revoked_at IS NULL RETURNING id INTO _id;
 IF _id IS NULL THEN RETURN false; END IF;
 PERFORM public.record_audit_event(auth.uid(), 'consent_revoked', 'consent_grants', _id,
 'survivor', auth.uid(), NULL);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_my_consent_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_my_consent_grant(uuid) TO authenticated;

-- Reviews and role grants commit together; only the authenticated founder's server may invoke.
CREATE OR REPLACE FUNCTION public.review_attorney_application(_id uuid, _reviewer uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid;
BEGIN
 IF _status NOT IN ('approved','rejected') OR NOT EXISTS (
 SELECT 1 FROM public.user_roles WHERE user_id = _reviewer AND role = 'admin') THEN
 RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
 UPDATE public.attorney_applications SET status = _status, reviewed_by = _reviewer, reviewed_at = now()
 WHERE id = _id RETURNING user_id INTO _uid;
 IF _uid IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
 IF _status = 'approved' THEN
 INSERT INTO public.user_roles(user_id,role) VALUES (_uid,'attorney') ON CONFLICT (user_id,role) DO NOTHING;
 ELSE
 -- All existing collaborator/firm access depends on these live links too.
 UPDATE public.attorney_client_links SET status='revoked',revoked_at=now()
 WHERE attorney_user_id=_uid AND revoked_at IS NULL;
 END IF;
 PERFORM public.record_audit_event(_uid, 'attorney_reviewed', 'attorney_applications', _id,
 'admin', _reviewer, jsonb_build_object('status', _status));
END;
$$;
REVOKE ALL ON FUNCTION public.review_attorney_application(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_attorney_application(uuid,uuid,text) TO service_role;

-- A direct vetted invitation is one-use, expiring and bound to the verified account email.
CREATE OR REPLACE FUNCTION public.claim_founder_attorney_invite(_application uuid, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _inv public.founder_attorney_invites; _app public.attorney_applications;
BEGIN
 SELECT * INTO _app FROM public.attorney_applications WHERE id = _application FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
 SELECT * INTO _inv FROM public.founder_attorney_invites WHERE token_hash = _hash FOR UPDATE;
 IF NOT FOUND OR _inv.used_at IS NOT NULL OR _inv.expires_at <= now() OR lower(_inv.email) <> lower(_app.email)
 OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _app.user_id AND lower(email) = lower(_inv.email)
 AND email_confirmed_at IS NOT NULL) THEN
 RAISE EXCEPTION 'Invitation is invalid or expired' USING ERRCODE = '42501'; END IF;
 PERFORM public.review_attorney_application(_app.id, _inv.invited_by, 'approved');
 UPDATE public.founder_attorney_invites SET used_at = now() WHERE id = _inv.id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_founder_attorney_invite(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founder_attorney_invite(uuid,text) TO service_role;

-- Record sharing changes atomically, including calls made with the server role.
CREATE OR REPLACE FUNCTION private.audit_grant_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _owner uuid;
BEGIN
 IF to_jsonb(OLD) - ARRAY['updated_at','attorney_case_notes','attorney_case_notes_updated_at'] =
 to_jsonb(NEW) - ARRAY['updated_at','attorney_case_notes','attorney_case_notes_updated_at'] THEN RETURN NEW; END IF;
 _owner := COALESCE((to_jsonb(NEW)->>'client_user_id')::uuid, (to_jsonb(NEW)->>'survivor_user_id')::uuid);
 PERFORM public.record_audit_event(_owner, 'share_grant_updated', TG_TABLE_NAME, NEW.id,
 CASE WHEN auth.uid() IS NULL THEN 'server' ELSE 'survivor' END, auth.uid(),
 jsonb_build_object('status', NEW.status, 'revoked_at', NEW.revoked_at, 'expires_at', NEW.expires_at));
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_attorney_grant_mutation ON public.attorney_client_links;
CREATE TRIGGER audit_attorney_grant_mutation AFTER UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION private.audit_grant_mutation();
DROP TRIGGER IF EXISTS audit_consent_grant_mutation ON public.consent_grants;
CREATE TRIGGER audit_consent_grant_mutation AFTER UPDATE ON public.consent_grants
FOR EACH ROW EXECUTE FUNCTION private.audit_grant_mutation();

REVOKE ALL ON public.incidents, public.evidence, public.cases, public.attorney_client_links,
 public.user_roles, public.support_requests, public.consent_grants FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.incidents, public.evidence, public.cases,
 public.attorney_client_links, public.user_roles, public.support_requests, public.consent_grants FROM authenticated;

CREATE OR REPLACE FUNCTION public.founder_recent_signups()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz, roles text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT u.id, u.email::text, u.created_at, coalesce(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL), '{}')
 FROM auth.users u LEFT JOIN public.user_roles r ON r.user_id=u.id
 GROUP BY u.id,u.email,u.created_at ORDER BY u.created_at DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.founder_recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founder_recent_signups() TO service_role;
