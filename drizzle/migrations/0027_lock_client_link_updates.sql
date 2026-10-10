DROP POLICY IF EXISTS "Clients manage clio share consent" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;

REVOKE UPDATE ON public.attorney_client_links FROM authenticated, anon, PUBLIC;
GRANT UPDATE (clio_share_consent, clio_share_consent_at, status, revoked_at) ON public.attorney_client_links TO authenticated;

CREATE POLICY "Clients update consent or revoke own links" ON public.attorney_client_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);

CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.client_user_id THEN
    RETURN NEW;
  END IF;
  -- A revoked link can never be reopened by the client.
  IF OLD.status = 'revoked' OR OLD.revoked_at IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
      RAISE EXCEPTION 'A withdrawn share cannot be reopened' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Status may only move to revoked, and only together with revoked_at.
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status <> 'revoked' OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Sharing can only be withdrawn here' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Everything other than consent + revoke fields is frozen.
  IF (to_jsonb(NEW) - ARRAY['clio_share_consent','clio_share_consent_at','status','revoked_at','updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['clio_share_consent','clio_share_consent_at','status','revoked_at','updated_at'])
  THEN
    RAISE EXCEPTION 'Only consent and withdrawal can be changed here' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Survivor updates own grants" ON public.consent_grants;
REVOKE UPDATE, INSERT, DELETE, TRUNCATE ON public.consent_grants FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.consent_grants TO service_role;