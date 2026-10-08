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
