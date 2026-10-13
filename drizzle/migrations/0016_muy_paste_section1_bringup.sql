
-- ---------- 1.1 supabase/migrations/20261008120000_acl_client_update_guard_allowlist.sql (verbatim) ----------
-- C7 (Guardian BLOCK): survivor JWT could PATCH its own attorney_client_links
-- row's expires_at (and, combined with a status/revoked_at change, any column:
-- re-arm a revoked link, swap attorney_user_id, widen scope_*).
--
-- Rewrites public.attorney_client_links_client_update_guard() as an ALLOWLIST
-- over to_jsonb(row), so every column added later is frozen for survivors by
-- default. Applies only when auth.uid() = OLD.client_user_id.
--
-- Survivor (client) may do exactly one of:
--   (i)  change the Clio consent fields only:
--          clio_share_consent, clio_share_consent_at
--   (ii) a one-way revoke: status -> 'revoked' AND revoked_at NULL -> NOT NULL,
--        with nothing else changing (updated_at tolerated if it ever exists;
--        the table has no updated_at column today).
-- Everything else is rejected with ERRCODE 42501, including: status back to
-- active, revoked_at back to NULL, expires_at, attorney_user_id,
-- client_user_id, scope_*, include_*, case_id, org_id, invitation_id,
-- deposition_prep_consent*, attorney_case_notes*, and a revoke combined with
-- any other edit (including a Clio consent edit).
--
-- Unchanged on purpose:
--   * auth.uid() IS NULL (service_role / supabaseAdmin server functions):
--     bypass, so audited server functions keep working.
--   * Any other caller (e.g. auth.uid() = attorney_user_id): passes through
--     this trigger exactly as before. There is no attorney UPDATE policy on
--     attorney_client_links, so RLS already denies attorney JWT updates.
--
-- On an allowed client revoke the stored revoked_at is always the server's
-- now(), overriding whatever the client sent (no backdating to e.g. 1970 or
-- future-dating; keeps the court access timeline honest). The client must
-- still send a non-NULL revoked_at. Trigger is recreated so it is attached
-- even if it was ever dropped; trigger name and BEFORE UPDATE timing unchanged.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). Soft claim only:
-- Grace applies on muy after Guardian CLEAR. Not applied by this PR alone.

CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  -- Columns a survivor may change for a Clio consent toggle.
  c_consent_keys constant text[] := ARRAY['clio_share_consent', 'clio_share_consent_at', 'updated_at'];
  -- Columns a survivor may change for a one-way revoke.
  c_revoke_keys constant text[] := ARRAY['status', 'revoked_at', 'updated_at'];
BEGIN
  -- service_role / server-side (no JWT subject), or not the survivor on this
  -- row: unchanged behaviour (RLS decides; attorneys have no UPDATE policy).
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- No-op update.
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- (ii) One-way revoke, nothing else.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status = 'revoked'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND (v_new - c_revoke_keys) = (v_old - c_revoke_keys)
    THEN
      -- Server time wins: never trust a client-supplied revoke timestamp.
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only a one-way revoke (status revoked + revoked_at set, nothing else) is allowed here'
      USING ERRCODE = '42501';
  END IF;

  -- (i) Clio consent fields only.
  IF (v_new - c_consent_keys) = (v_old - c_consent_keys) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS attorney_client_links_client_update_guard ON public.attorney_client_links;
CREATE TRIGGER attorney_client_links_client_update_guard
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();

-- ---------- 1.2 supabase/migrations/20261010150854_launch_consent_and_attorney_gate.sql (verbatim) ----------
-- Server-owned consent mutations and founder attorney approval. No data is grandfathered.
CREATE TABLE IF NOT EXISTS public.attorney_access_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, full_name text NOT NULL, firm_name text,
 bar_number text NOT NULL, jurisdiction text NOT NULL,
 status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorney_access_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_access_applications FROM anon, authenticated;
GRANT SELECT ON public.attorney_access_applications TO authenticated;
GRANT ALL ON public.attorney_access_applications TO service_role;
DROP POLICY IF EXISTS "Applicant reads own review" ON public.attorney_access_applications;
CREATE POLICY "Applicant reads own review" ON public.attorney_access_applications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

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
 SELECT EXISTS (SELECT 1 FROM public.attorney_access_applications WHERE user_id = _id AND status = 'approved');
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
 UPDATE public.attorney_access_applications SET status = _status, reviewed_by = _reviewer, reviewed_at = now()
 WHERE id = _id RETURNING user_id INTO _uid;
 IF _uid IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
 IF _status = 'approved' THEN
 INSERT INTO public.user_roles(user_id,role) VALUES (_uid,'attorney') ON CONFLICT (user_id,role) DO NOTHING;
 ELSE
 -- All existing collaborator/firm access depends on these live links too.
 UPDATE public.attorney_client_links SET status='revoked',revoked_at=now()
 WHERE attorney_user_id=_uid AND revoked_at IS NULL;
 END IF;
 PERFORM public.record_audit_event(_uid, 'attorney_reviewed', 'attorney_access_applications', _id,
 'admin', _reviewer, jsonb_build_object('status', _status));
END;
$$;
REVOKE ALL ON FUNCTION public.review_attorney_application(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_attorney_application(uuid,uuid,text) TO service_role;

-- A direct vetted invitation is one-use, expiring and bound to the verified account email.
CREATE OR REPLACE FUNCTION public.claim_founder_attorney_invite(_application uuid, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _inv public.founder_attorney_invites; _app public.attorney_access_applications;
BEGIN
 SELECT * INTO _app FROM public.attorney_access_applications WHERE id = _application FOR UPDATE;
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

-- ---------- 1.3 supabase/migrations/20261011173000_fresh_attorney_grants.sql (verbatim) ----------
-- Preserve ended grants and their dependent records. Only one current grant
-- per attorney/survivor pair can exist; a new consent creates a new identity.
ALTER TABLE public.attorney_client_links
 DROP CONSTRAINT IF EXISTS attorney_client_links_attorney_user_id_client_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS attorney_client_links_current_pair
 ON public.attorney_client_links(attorney_user_id, client_user_id)
 WHERE status <> 'revoked' AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.accept_attorney_share(
 _invitation_id uuid, _actor_id uuid, _direction text, _scope jsonb
) RETURNS TABLE(id uuid, client_user_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 inv jsonb; attorney_id uuid; survivor_id uuid; actor_email text;
 current_link public.attorney_client_links; result_id uuid;
 incidents uuid[]; files uuid[]; ended_at timestamptz;
 patterns boolean; voices boolean; communications boolean; documents boolean;
 grant_case_id uuid; deadline timestamptz;
BEGIN
 IF _direction NOT IN ('attorney', 'survivor') THEN
  RAISE EXCEPTION 'Invalid invitation direction' USING ERRCODE='22023';
 END IF;
 IF _direction = 'attorney' THEN
  SELECT to_jsonb(i) INTO inv FROM public.attorney_invitations i
   WHERE i.id = _invitation_id FOR UPDATE;
  attorney_id := _actor_id; survivor_id := (inv->>'client_user_id')::uuid;
 ELSE
  SELECT to_jsonb(i) INTO inv FROM public.attorney_survivor_invites i
   WHERE i.id = _invitation_id FOR UPDATE;
  attorney_id := (inv->>'attorney_user_id')::uuid; survivor_id := _actor_id;
 END IF;
 IF inv IS NULL OR inv->>'status' <> 'pending' OR
  ((inv->>'expires_at')::timestamptz IS NOT NULL AND (inv->>'expires_at')::timestamptz <= now()) THEN
  RAISE EXCEPTION 'Invitation is invalid or expired' USING ERRCODE='42501';
 END IF;
 SELECT lower(u.email) INTO actor_email FROM auth.users u
  WHERE u.id = _actor_id AND u.email_confirmed_at IS NOT NULL;
 IF actor_email IS NULL OR actor_email <> lower(inv->>CASE WHEN _direction='attorney' THEN 'attorney_email' ELSE 'survivor_email' END) THEN
  RAISE EXCEPTION 'A matching confirmed account is required' USING ERRCODE='42501';
 END IF;
 -- Hold approval through acceptance. A concurrent rejection waits, then
 -- revokes this grant too; it cannot race a newly inserted share.
 PERFORM 1 FROM public.attorney_access_applications
  WHERE user_id=attorney_id AND status='approved' FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Attorney approval required' USING ERRCODE='42501';
 END IF;
 -- Serialize two invitations for the same pair, including the first insert.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(attorney_id::text || ':' || survivor_id::text, 0));
 SELECT l.* INTO current_link FROM public.attorney_client_links l
  WHERE l.attorney_user_id=attorney_id AND l.client_user_id=survivor_id
   AND l.status <> 'revoked' AND l.revoked_at IS NULL FOR UPDATE;
 -- An invitation issued before withdrawal/expiry is no longer fresh consent.
 -- Survivor-side acceptance is a new, explicit choice made by the owner now.
 SELECT max(coalesce(l.revoked_at, l.expires_at)) INTO ended_at
  FROM public.attorney_client_links l WHERE l.attorney_user_id=attorney_id
   AND l.client_user_id=survivor_id AND
   (l.status='revoked' OR l.revoked_at IS NOT NULL OR l.expires_at <= now());
 IF _direction='attorney' AND ended_at IS NOT NULL AND
  (inv->>'created_at')::timestamptz <= ended_at THEN
  RAISE EXCEPTION 'Ask the survivor for a new invitation after the previous share ended' USING ERRCODE='42501';
 END IF;
 IF current_link.id IS NOT NULL AND current_link.status <> 'active' AND
  (current_link.expires_at IS NULL OR current_link.expires_at > now()) THEN
  RAISE EXCEPTION 'The current share is paused' USING ERRCODE='42501';
 END IF;
 incidents := ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(_scope->'scope_incidents','[]'::jsonb)));
 files := ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(_scope->'scope_evidence','[]'::jsonb)));
 IF EXISTS (SELECT 1 FROM unnest(incidents) x WHERE NOT EXISTS
  (SELECT 1 FROM public.incidents i WHERE i.id=x AND i.user_id=survivor_id AND i.deleted_at IS NULL)) OR
  EXISTS (SELECT 1 FROM unnest(files) x WHERE NOT EXISTS
  (SELECT 1 FROM public.evidence e WHERE e.id=x AND e.user_id=survivor_id AND e.deleted_at IS NULL)) THEN
  RAISE EXCEPTION 'The selected records are no longer available' USING ERRCODE='42501';
 END IF;
 IF _direction='attorney' THEN
  IF (NOT coalesce((inv->>'include_all_incidents')::boolean,false) AND NOT incidents <@
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(inv->'scope_incidents','[]'::jsonb)))) OR
   (NOT coalesce((inv->>'include_all_evidence')::boolean,false) AND NOT files <@
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(inv->'scope_evidence','[]'::jsonb)))) THEN
   RAISE EXCEPTION 'Scope exceeds the invitation' USING ERRCODE='42501';
  END IF;
  patterns := coalesce((inv->>'include_patterns')::boolean,false);
  voices := coalesce((inv->>'include_voice_notes')::boolean,false);
  communications := coalesce((inv->>'include_communications')::boolean,false);
  documents := coalesce((inv->>'include_legal_documents')::boolean,false);
  grant_case_id := (inv->>'case_id')::uuid;
 ELSE
  patterns := coalesce((_scope->>'include_patterns')::boolean,false);
  voices := false; communications := false; documents := false; grant_case_id := NULL;
 END IF;
 IF grant_case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id=grant_case_id AND c.user_id=survivor_id) THEN
  RAISE EXCEPTION 'Case does not belong to the survivor' USING ERRCODE='42501';
 END IF;
 deadline := (inv->>'expires_at')::timestamptz;
 IF current_link.id IS NOT NULL AND current_link.expires_at <= now() THEN
  UPDATE public.attorney_client_links SET status='revoked',revoked_at=expires_at WHERE attorney_client_links.id=current_link.id;
  current_link.id := NULL;
 END IF;
 IF current_link.id IS NULL THEN
  INSERT INTO public.attorney_client_links(attorney_user_id,client_user_id,invitation_id,
   scope_incidents,scope_evidence,include_all_incidents,include_all_evidence,
   include_patterns,include_voice_notes,include_communications,include_legal_documents,case_id,expires_at,status)
  VALUES(attorney_id,survivor_id,CASE WHEN _direction='attorney' THEN _invitation_id ELSE NULL END,
   incidents,files,false,false,patterns,voices,communications,documents,grant_case_id,deadline,'active')
  RETURNING attorney_client_links.id INTO result_id;
  PERFORM public.record_audit_event(survivor_id,'share_grant_created','attorney_client_links',result_id,
   _direction,_actor_id,jsonb_build_object('invitation_id',_invitation_id,'direction',_direction));
 ELSE
  UPDATE public.attorney_client_links SET invitation_id=CASE WHEN _direction='attorney' THEN _invitation_id ELSE NULL END,
   scope_incidents=incidents,scope_evidence=files,include_all_incidents=false,include_all_evidence=false,
   include_patterns=patterns,include_voice_notes=voices,include_communications=communications,
   include_legal_documents=documents,case_id=grant_case_id,expires_at=deadline
   WHERE attorney_client_links.id=current_link.id RETURNING attorney_client_links.id INTO result_id;
 END IF;
 IF _direction='attorney' THEN
  UPDATE public.attorney_invitations SET status='accepted',accepted_at=now(),accepted_by=_actor_id WHERE attorney_invitations.id=_invitation_id;
 ELSE
  UPDATE public.attorney_survivor_invites SET status='accepted',accepted_at=now(),accepted_by=_actor_id WHERE attorney_survivor_invites.id=_invitation_id;
 END IF;
 RETURN QUERY SELECT result_id,survivor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) TO service_role;

-- ---------- 1.4 supabase/migrations/20261011174000_preserve_unfinished_entries.sql (verbatim) ----------
-- Drafts remain private until their owner saves or discards them. Disable the
-- historical cron job on deployments where the earlier migration already ran.
DO $$
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='purge-old-entry-drafts';
 END IF;
END;
$$;

-- ---------- 1.5 supabase/migrations/20261011175000_signup_alert_outbox.sql (verbatim) ----------
-- A role write and its founder alert become durable in the same transaction.
-- No historical backfill: existing accounts are not treated as new signups.
CREATE TABLE IF NOT EXISTS public.signup_alert_outbox (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('survivor','attorney','advocate','organization')),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, outcome text,
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,role)
);
ALTER TABLE public.signup_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_alert_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.signup_alert_outbox TO service_role;

CREATE OR REPLACE FUNCTION private.enqueue_signup_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role::text IN ('survivor','attorney','advocate') THEN
  INSERT INTO public.signup_alert_outbox(user_id,role) VALUES(NEW.user_id,NEW.role::text)
   ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_signup_alert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enqueue_signup_alert ON public.user_roles;
CREATE TRIGGER enqueue_signup_alert AFTER INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION private.enqueue_signup_alert();

CREATE OR REPLACE FUNCTION public.claim_signup_alert(_user_id uuid,_role text,_enqueue boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claimed uuid;
BEGIN
 IF _enqueue THEN
  INSERT INTO public.signup_alert_outbox(user_id,role) VALUES(_user_id,_role)
   ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 UPDATE public.signup_alert_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
 WHERE user_id=_user_id AND role=_role AND completed_at IS NULL AND next_attempt_at <= now()
 RETURNING user_id INTO claimed;
 RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_signup_alert(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_alert(uuid,text,boolean) TO service_role;

-- ---------- 1.6 supabase/migrations/20261011180000_atomic_attorney_billing.sql (verbatim) ----------
-- One entitlement decision across all subscriptions, preserving paid-through
-- periods and founding trials. Live billing takes precedence over sandbox data.
CREATE OR REPLACE FUNCTION public.attorney_billing_state(_attorney_id uuid, _environment text DEFAULT NULL)
RETURNS TABLE(entitled boolean, firm_seats integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH chosen AS (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=_attorney_id AND environment='live')
   THEN 'live' ELSE coalesce(_environment,'sandbox') END AS environment
 ), eligible AS (
  SELECT s.price_id FROM public.subscriptions s,chosen c
  WHERE s.user_id=_attorney_id AND s.environment=c.environment
   AND s.price_id IN ('attorney_solo_monthly','attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly','attorney_portal_monthly_297')
   AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
    OR (s.status='canceled' AND s.current_period_end > now()))
 )
 SELECT EXISTS (SELECT 1 FROM eligible) OR EXISTS (
  SELECT 1 FROM public.attorney_profiles WHERE user_id=_attorney_id AND trial_ends_at > now()),
  CASE WHEN EXISTS (SELECT 1 FROM eligible WHERE price_id IN ('attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly')) THEN 5 ELSE 1 END;
$$;
REVOKE ALL ON FUNCTION public.attorney_billing_state(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attorney_billing_state(uuid,text) TO service_role;

-- Mutation, audit triggers, firm seats and survivor notices commit together.
-- A failed notification rolls back the access write so the provider can retry.
CREATE OR REPLACE FUNCTION public.sync_attorney_billing_access(_attorney_id uuid,_environment text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE billing record; target_status text; affected integer;
BEGIN
 IF _environment NOT IN ('live','sandbox') OR _environment IS NULL THEN
  RAISE EXCEPTION 'Invalid billing environment' USING ERRCODE='22023';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing:'||_attorney_id::text,0));
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_attorney_id AND role='attorney') THEN RETURN 0; END IF;
 SELECT * INTO billing FROM public.attorney_billing_state(_attorney_id,_environment);
 target_status := CASE WHEN billing.entitled THEN 'active' ELSE 'paused' END;
 UPDATE public.firms SET seats_included=billing.firm_seats,updated_at=now() WHERE created_by=_attorney_id;
 WITH changed AS (
  UPDATE public.attorney_client_links SET status=target_status
  WHERE attorney_user_id=_attorney_id AND status IN ('active','paused') AND status<>target_status
   AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  RETURNING id,client_user_id
 )
 INSERT INTO public.notifications(user_id,kind,title,body,metadata)
 SELECT client_user_id,
  CASE WHEN target_status='active' THEN 'attorney_access_resumed' ELSE 'attorney_access_paused' END,
  CASE WHEN target_status='active' THEN 'Your attorney''s access is back on' ELSE 'Your attorney''s access is paused' END,
  CASE WHEN target_status='active' THEN 'Your attorney''s subscription or trial is active again, so their shared view of what you chose to share is back on. You can end their access at any time.'
   ELSE 'Your records are safe and unchanged. Your attorney''s shared view is paused until their subscription or trial is active again.' END,
  jsonb_build_object('link_id',id,'attorney_user_id',_attorney_id)
 FROM changed;
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_attorney_billing_access(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_attorney_billing_access(uuid,text) TO service_role;

-- ---------- 1.7 supabase/migrations/20261011190000_lock_client_link_updates.sql (verbatim) ----------
-- Lovable sync 2026-10-11: renumbered from Lovable drizzle 0027. Kept: the single
-- client UPDATE policy, the column-level UPDATE grant and the consent_grants lockdown.
-- Replaced: Lovable's guard body (no server revoked_at, revoke + consent edit allowed)
-- with the reviewed #197 guard from 0010_acl_client_update_guard_allowlist, verbatim.
DROP POLICY IF EXISTS "Clients manage clio share consent" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;

REVOKE UPDATE ON public.attorney_client_links FROM authenticated, anon, PUBLIC;
GRANT UPDATE (clio_share_consent, clio_share_consent_at, status, revoked_at) ON public.attorney_client_links TO authenticated;

DROP POLICY IF EXISTS "Clients update consent or revoke own links" ON public.attorney_client_links;
CREATE POLICY "Clients update consent or revoke own links" ON public.attorney_client_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);

CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  -- Columns a survivor may change for a Clio consent toggle.
  c_consent_keys constant text[] := ARRAY['clio_share_consent', 'clio_share_consent_at', 'updated_at'];
  -- Columns a survivor may change for a one-way revoke.
  c_revoke_keys constant text[] := ARRAY['status', 'revoked_at', 'updated_at'];
BEGIN
  -- service_role / server-side (no JWT subject), or not the survivor on this
  -- row: unchanged behaviour (RLS decides; attorneys have no UPDATE policy).
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- No-op update.
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- (ii) One-way revoke, nothing else.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status = 'revoked'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND (v_new - c_revoke_keys) = (v_old - c_revoke_keys)
    THEN
      -- Server time wins: never trust a client-supplied revoke timestamp.
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only a one-way revoke (status revoked + revoked_at set, nothing else) is allowed here'
      USING ERRCODE = '42501';
  END IF;

  -- (i) Clio consent fields only.
  IF (v_new - c_consent_keys) = (v_old - c_consent_keys) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS attorney_client_links_client_update_guard ON public.attorney_client_links;
CREATE TRIGGER attorney_client_links_client_update_guard
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();

DROP POLICY IF EXISTS "Survivor updates own grants" ON public.consent_grants;
REVOKE UPDATE, INSERT, DELETE, TRUNCATE ON public.consent_grants FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.consent_grants TO service_role;

-- ---------- 1.8 supabase/migrations/20261011191000_attorney_applications.sql (verbatim) ----------
-- Lovable sync 2026-10-11: renumbered from Lovable drizzle 0028 (already present on the
-- published database). Made re-runnable with IF NOT EXISTS; otherwise unchanged.
CREATE TABLE IF NOT EXISTS public.attorney_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  firm_name text,
  bar_number text,
  jurisdiction text,
  note text,
  source text NOT NULL DEFAULT 'apply' CHECK (source IN ('apply','founder_invite')),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  invited_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $do$
BEGIN
  -- An older copy of this table may lack these columns; never fail the bring-up on it.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'attorney_applications' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS attorney_applications_status_idx ON public.attorney_applications (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS attorney_applications_email_idx ON public.attorney_applications (lower(email), created_at DESC);
  ELSE
    RAISE NOTICE 'public.attorney_applications has no created_at column: indexes skipped';
  END IF;
END
$do$;
REVOKE ALL ON public.attorney_applications FROM anon, authenticated;
GRANT ALL ON public.attorney_applications TO service_role;
ALTER TABLE public.attorney_applications ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.attorney_applications IS 'Attorney access requests. Server-only; founder approves before any attorney role is granted.';

-- ---------- 1.9 supabase/migrations/20261011200000_lovable_sync_reconcile.sql (verbatim) ----------
-- Lovable sync reconcile (2026-10-11). Last migration in the merged history.
--
-- Sets one end state no matter which of main's (#207) and Lovable's migrations
-- already ran on the database, and in what order. Every statement is idempotent.
-- Needs Guardian CLEAR before anyone applies it. Not applied by this PR.
--
-- 1. attorney_client_links survivor guard = the reviewed #197 body, verbatim
--    (search_path '', server-side NEW.revoked_at := now(), revoke combined with
--    any other edit rejected).
-- 2. attorney_client_links: survivors keep only the column-level UPDATE grant
--    (clio_share_consent, clio_share_consent_at, status, revoked_at) behind one
--    UPDATE policy and the guard. No INSERT/DELETE/TRUNCATE for browser roles.
-- 3. consent_grants: writes are service_role only.
-- 4. private.has_attorney_access keeps #207's founder-approval check (Lovable's
--    re-run of honour_share_expiry would drop it). Skipped with a NOTICE when
--    #207 (private.attorney_is_approved) is not applied yet.
-- 5. anon: no table or sequence rights in public except INSERT on
--    feedback_submissions (public /org-feedback form). Default privileges for
--    postgres (and, best effort, supabase_admin) no longer hand anon anything.
-- 6. SECURITY DEFINER functions in public: EXECUTE revoked from anon and PUBLIC.
--    Roles that already had EXECUTE (directly or through PUBLIC) among
--    authenticated, service_role, supabase_auth_admin, supabase_storage_admin and
--    authenticator get it explicitly first, so sign-in hooks and signed-in
--    behaviour are unchanged. The pre-revoke ACLs are kept in
--    public._reconcile_secdef_acl_snapshot for the documented undo. Keep-list for anon:
--    empty (no anon-reachable RPC; the only anon RLS policy uses auth.uid()).
--    New functions no longer default to EXECUTE for anon or PUBLIC.
-- 7. The 30-day entry draft purge cron job is removed outright.
-- 8. Lovable's new server-only tables have RLS on and no browser-role grants;
--    study tables keep owner-only policies.
-- 9. Storage policies for the private app buckets: TO authenticated instead of
--    PUBLIC (same expressions); message-exports UPDATE gets a WITH CHECK.

/* 1. Guard (#197, verbatim) ------------------------------------------------ */
CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  -- Columns a survivor may change for a Clio consent toggle.
  c_consent_keys constant text[] := ARRAY['clio_share_consent', 'clio_share_consent_at', 'updated_at'];
  -- Columns a survivor may change for a one-way revoke.
  c_revoke_keys constant text[] := ARRAY['status', 'revoked_at', 'updated_at'];
BEGIN
  -- service_role / server-side (no JWT subject), or not the survivor on this
  -- row: unchanged behaviour (RLS decides; attorneys have no UPDATE policy).
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- No-op update.
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- (ii) One-way revoke, nothing else.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status = 'revoked'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND (v_new - c_revoke_keys) = (v_old - c_revoke_keys)
    THEN
      -- Server time wins: never trust a client-supplied revoke timestamp.
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only a one-way revoke (status revoked + revoked_at set, nothing else) is allowed here'
      USING ERRCODE = '42501';
  END IF;

  -- (i) Clio consent fields only.
  IF (v_new - c_consent_keys) = (v_old - c_consent_keys) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS attorney_client_links_client_update_guard ON public.attorney_client_links;
CREATE TRIGGER attorney_client_links_client_update_guard
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();

/* 2. attorney_client_links browser writes ---------------------------------- */
DROP POLICY IF EXISTS "Clients manage clio share consent" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;
-- Safe to drop: no browser (user-JWT) INSERT into attorney_client_links exists. Live
-- 025d554 / 8a0333cb insert with supabaseAdmin in acceptInvitation and acceptSurvivorInvite;
-- this branch accepts only through accept_attorney_share (service role).
DROP POLICY IF EXISTS "Attorney accepts matching invitation" ON public.attorney_client_links;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.attorney_client_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.attorney_client_links FROM anon;
GRANT UPDATE (clio_share_consent, clio_share_consent_at, status, revoked_at) ON public.attorney_client_links TO authenticated;
GRANT ALL ON public.attorney_client_links TO service_role;
DROP POLICY IF EXISTS "Clients update consent or revoke own links" ON public.attorney_client_links;
CREATE POLICY "Clients update consent or revoke own links" ON public.attorney_client_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);

/* 3. consent_grants: service_role writes only ------------------------------- */
DROP POLICY IF EXISTS "Survivor updates own grants" ON public.consent_grants;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.consent_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.consent_grants FROM anon;
GRANT ALL ON public.consent_grants TO service_role;

/* 4. has_attorney_access keeps the approval check --------------------------- */
DO $do$
BEGIN
  IF to_regprocedure('private.attorney_is_approved(uuid)') IS NULL THEN
    RAISE NOTICE 'private.attorney_is_approved is missing: apply #207 (20261010150854_launch_consent_and_attorney_gate) first; has_attorney_access left unchanged';
    RETURN;
  END IF;
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
 SELECT private.attorney_is_approved(_attorney_id) AND EXISTS (
 SELECT 1 FROM public.attorney_client_links WHERE attorney_user_id = _attorney_id
 AND client_user_id = _client_id AND status = 'active' AND revoked_at IS NULL
 AND (expires_at IS NULL OR expires_at > now()));
$body$;
$fn$;
  REVOKE ALL ON FUNCTION private.has_attorney_access(uuid,uuid) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION private.has_attorney_access(uuid,uuid) TO authenticated, service_role;
END
$do$;

/* 5. anon: only the public feedback INSERT ---------------------------------- */
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
DO $do$
BEGIN
  IF to_regclass('public.feedback_submissions') IS NOT NULL THEN
    GRANT INSERT ON public.feedback_submissions TO anon;
  END IF;
END
$do$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
DO $do$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE 'supabase_admin default privileges not changed (%): run as supabase_admin or leave as Supabase default', SQLERRM;
END
$do$;

/* 6. SECURITY DEFINER functions in public: no anon / PUBLIC EXECUTE --------- */
-- Undo record for SECTION 3 of the muy paste: the ACL of every public SECURITY
-- DEFINER function as it was the first time this ran (re-runs never overwrite it).
-- Server-only: RLS on, no policies, no anon/authenticated/PUBLIC access.
CREATE TABLE IF NOT EXISTS public._reconcile_secdef_acl_snapshot (
  fn text PRIMARY KEY,
  proacl text,
  had_public boolean NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._reconcile_secdef_acl_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._reconcile_secdef_acl_snapshot FROM PUBLIC, anon, authenticated;
GRANT ALL ON public._reconcile_secdef_acl_snapshot TO service_role;
COMMENT ON TABLE public._reconcile_secdef_acl_snapshot IS
  'Lovable sync reconcile: pre-revoke EXECUTE ACLs of public SECURITY DEFINER functions, used only by the documented undo.';

DO $do$
DECLARE
  r record;
  g text;
  -- SECURITY DEFINER functions anon must still call. Empty: the app makes no
  -- RPC before sign-in and the only anon policy (feedback_submissions INSERT)
  -- uses auth.uid() alone. Add a name here only with evidence.
  keep constant text[] := ARRAY[]::text[];
  -- Roles that keep EXECUTE they already had (directly or through PUBLIC), so
  -- auth hooks (supabase_auth_admin), storage and PostgREST keep working.
  keep_roles constant text[] := ARRAY['authenticated', 'service_role', 'supabase_auth_admin',
    'supabase_storage_admin', 'authenticator'];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.proacl, p.proowner,
           format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND NOT (p.proname = ANY (keep))
  LOOP
    INSERT INTO public._reconcile_secdef_acl_snapshot (fn, proacl, had_public)
    VALUES (r.sig, r.proacl::text,
      EXISTS (SELECT 1 FROM aclexplode(coalesce(r.proacl, acldefault('f', r.proowner))) a
              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
    ON CONFLICT (fn) DO NOTHING;
    FOREACH g IN ARRAY keep_roles LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = g)
         AND (g = 'service_role' OR has_function_privilege(g, r.oid, 'EXECUTE')) THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', r.sig, g);
      END IF;
    END LOOP;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END
$do$;
-- New functions created by postgres: no EXECUTE for PUBLIC anywhere, none for anon
-- in public; authenticated and service_role keep the access they get today.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
DO $do$
BEGIN
  IF to_regnamespace('private') IS NOT NULL THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
  END IF;
END
$do$;

/* 7. Entry draft purge job removed ----------------------------------------- */
DO $do$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-entry-drafts';
  END IF;
EXCEPTION WHEN undefined_function OR insufficient_privilege THEN
  RAISE NOTICE 'purge-old-entry-drafts not removed (%): remove it by hand', SQLERRM;
END
$do$;

/* 8. Lovable's new tables --------------------------------------------------- */
DO $do$
DECLARE
  t text;
  server_only constant text[] := ARRAY['user_webauthn_credentials', 'user_webauthn_challenges',
    'attorney_entry_reviews', 'attorney_applications'];
  owner_rw constant text[] := ARRAY['study_profiles', 'user_lesson_progress'];
BEGIN
  FOREACH t IN ARRAY server_only || owner_rw LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip missing table public.%', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    IF t = ANY (server_only) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    ELSE
      EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_delete', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t || '_owner_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t || '_owner_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_owner_update', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t || '_owner_delete', t);
    END IF;
  END LOOP;
END
$do$;

/* 9. Storage: app bucket policies apply to signed-in users only ------------- */
-- Same USING / WITH CHECK, role list changed from PUBLIC to authenticated
-- (ALTER POLICY keeps the expressions). message-exports UPDATE gains a WITH
-- CHECK equal to its USING, so a row cannot be moved out of the owner folder.
DO $do$
DECLARE
  p text;
  to_auth constant text[] := ARRAY['evidence read own', 'evidence insert own', 'evidence delete own',
    'voice read own', 'voice insert own', 'voice delete own',
    'own conv recordings read', 'own conv recordings write', 'own conv recordings delete'];
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage.objects missing: storage policies unchanged';
    RETURN;
  END IF;
  FOREACH p IN ARRAY to_auth LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p) THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', p);
    ELSE
      RAISE NOTICE 'storage policy "%" not found: unchanged', p;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname = 'users update own message-exports') THEN
    ALTER POLICY "users update own message-exports" ON storage.objects TO authenticated
      USING (bucket_id = 'message-exports' AND (auth.uid())::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'message-exports' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'storage policies not changed (%): owned by the storage admin role; change them in the dashboard', SQLERRM;
END
$do$;
