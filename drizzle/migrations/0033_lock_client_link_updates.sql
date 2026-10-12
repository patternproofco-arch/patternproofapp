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
