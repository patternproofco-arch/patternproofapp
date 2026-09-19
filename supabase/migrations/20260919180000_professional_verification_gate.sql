-- Professional verification gate (DV orgs + attorneys) — fail-closed spine.
-- Status vocabulary aligns with product language. Only 'verified' may proceed
-- on share targets, invite mint, grant create/read, staff invite, search,
-- dashboards, exports, and Clio. Payment never implies verified.

-- ---------------------------------------------------------------------------
-- 1. Shared status check helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.professional_status_is_live_verified(
  p_status text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status = 'verified'
    AND (p_expires_at IS NULL OR p_expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.professional_status_is_live_verified(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.professional_status_is_live_verified(text, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 2. DV organizations
-- ---------------------------------------------------------------------------
ALTER TABLE public.dv_organizations
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_email_domain text,
  ADD COLUMN IF NOT EXISTS primary_callback_phone text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

DO $$ BEGIN
  ALTER TABLE public.dv_organizations
    ADD CONSTRAINT dv_organizations_verification_status_chk
    CHECK (verification_status IN (
      'pending', 'needs_more_info', 'declined', 'verified', 'suspended'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Historical partners were already human-approved via access requests.
UPDATE public.dv_organizations
SET
  verification_status = 'verified',
  verified_at = coalesce(verified_at, created_at, now()),
  verification_expires_at = coalesce(
    verification_expires_at,
    coalesce(verified_at, created_at, now()) + interval '12 months'
  )
WHERE verification_status = 'pending'
  AND verified_at IS NULL;

CREATE OR REPLACE FUNCTION public.org_is_verified(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT public.professional_status_is_live_verified(
        o.verification_status, o.verification_expires_at
      )
      FROM public.dv_organizations o
      WHERE o.id = p_org_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.org_is_verified(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_is_verified(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Attorney profiles + multi-state bar rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.attorney_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS bar_callback_phone text,
  ADD COLUMN IF NOT EXISTS office_address text,
  ADD COLUMN IF NOT EXISTS address_visible_to_survivors boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_aid_dual_role boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

DO $$ BEGIN
  ALTER TABLE public.attorney_profiles
    ADD CONSTRAINT attorney_profiles_verification_status_chk
    CHECK (verification_status IN (
      'pending', 'needs_more_info', 'declined', 'verified', 'suspended'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing onboarded attorneys stay usable only after human CLEAR; do NOT
-- auto-verify from payment or onboarding. Leave them pending.

CREATE TABLE IF NOT EXISTS public.attorney_bar_jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  bar_number text,
  -- Callback phone recorded against the bar CLEAR — never the signup phone.
  bar_callback_phone text,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending', 'needs_more_info', 'declined', 'verified', 'suspended'
    )),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attorney_user_id, jurisdiction)
);

ALTER TABLE public.attorney_bar_jurisdictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_bar_jurisdictions FROM anon, authenticated;
GRANT ALL ON public.attorney_bar_jurisdictions TO service_role;

CREATE OR REPLACE FUNCTION public.attorney_is_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT public.professional_status_is_live_verified(
        p.verification_status, p.verification_expires_at
      )
      AND EXISTS (
        SELECT 1
        FROM public.attorney_bar_jurisdictions j
        WHERE j.attorney_user_id = p.user_id
          AND public.professional_status_is_live_verified(
            j.verification_status, j.verification_expires_at
          )
      )
      FROM public.attorney_profiles p
      WHERE p.user_id = p_user_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.attorney_is_verified(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attorney_is_verified(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Reviewer-only proof uploads (untrusted; never sent to AI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_verification_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('organization', 'attorney')),
  subject_id uuid NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  content_type text,
  original_filename text,
  byte_size integer,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS professional_verification_proofs_subject_idx
  ON public.professional_verification_proofs (subject_kind, subject_id);

ALTER TABLE public.professional_verification_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_verification_proofs FROM anon, authenticated;
GRANT ALL ON public.professional_verification_proofs TO service_role;
-- No SELECT policy for authenticated/anon: reviewer tooling uses service_role only.
-- Application code must never forward these rows to any AI gateway.

COMMENT ON TABLE public.professional_verification_proofs IS
  'Reviewer-only verification proofs. Untrusted data. Never send to AI.';

-- ---------------------------------------------------------------------------
-- 5. In-app suspension notices (NO email / SMS wiring)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_suspension_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('organization', 'attorney')),
  subject_id uuid NOT NULL,
  survivor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS professional_suspension_notices_survivor_idx
  ON public.professional_suspension_notices (survivor_user_id, created_at DESC);

ALTER TABLE public.professional_suspension_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_suspension_notices FROM anon, authenticated;
GRANT ALL ON public.professional_suspension_notices TO service_role;

COMMENT ON TABLE public.professional_suspension_notices IS
  'In-app only. Do not wire email or SMS delivery to this table.';

-- ---------------------------------------------------------------------------
-- 6. Survivor "Is this your attorney?" before grant + 6-month engagement
-- ---------------------------------------------------------------------------
ALTER TABLE public.attorney_invitations
  ADD COLUMN IF NOT EXISTS survivor_confirmed_attorney_at timestamptz,
  ADD COLUMN IF NOT EXISTS survivor_confirmed_attorney_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS case_engagement_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS case_engagement_confirmed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fail closed when a live grant is older than 6 months without a fresh confirm.
CREATE OR REPLACE FUNCTION public.attorney_case_engagement_current(
  p_linked_at timestamptz,
  p_confirmed_at timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_linked_at IS NULL THEN false
    WHEN p_linked_at > (now() - interval '6 months') THEN true
    WHEN p_confirmed_at IS NOT NULL
      AND p_confirmed_at > (now() - interval '6 months') THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.attorney_case_engagement_current(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attorney_case_engagement_current(timestamptz, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Atomic Suspended cutoff — organizations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_org_verification_status(
  p_org_id uuid,
  p_status text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_survivor uuid;
BEGIN
  IF p_status NOT IN ('pending', 'needs_more_info', 'declined', 'verified', 'suspended') THEN
    RAISE EXCEPTION 'Invalid organization verification status';
  END IF;

  SELECT verification_status INTO v_prev
  FROM public.dv_organizations
  WHERE id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;

  UPDATE public.dv_organizations
  SET
    verification_status = p_status,
    updated_at = now(),
    verified_at = CASE WHEN p_status = 'verified' THEN coalesce(verified_at, now()) ELSE verified_at END,
    verified_by = CASE WHEN p_status = 'verified' THEN p_actor_id ELSE verified_by END,
    verification_expires_at = CASE
      WHEN p_status = 'verified' THEN coalesce(p_expires_at, now() + interval '12 months')
      ELSE verification_expires_at
    END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE suspended_at END,
    suspended_by = CASE WHEN p_status = 'suspended' THEN p_actor_id ELSE suspended_by END,
    suspension_reason = CASE WHEN p_status = 'suspended' THEN p_reason ELSE suspension_reason END
  WHERE id = p_org_id;

  IF p_status = 'suspended' THEN
    -- Revoke live survivor grants held by any staff of this org.
    UPDATE public.advocate_client_links acl
    SET status = 'revoked', revoked_at = coalesce(revoked_at, now())
    WHERE acl.status = 'active'
      AND acl.advocate_user_id IN (
        SELECT om.user_id FROM public.org_members om WHERE om.org_id = p_org_id
      );

    -- Kill pending staff invites (no mid-session linger via fresh joins).
    UPDATE public.org_member_invitations
    SET status = 'revoked'
    WHERE org_id = p_org_id AND status = 'pending';

    -- Revoke pending advocate→survivor invites minted by org staff.
    UPDATE public.advocate_survivor_invites asi
    SET status = 'revoked'
    WHERE asi.status = 'pending'
      AND asi.advocate_user_id IN (
        SELECT om.user_id FROM public.org_members om WHERE om.org_id = p_org_id
      );

    -- Revoke pending survivor→advocate invitations aimed at org staff emails
    -- is best-effort via advocate_profiles; grants already revoked above.
    UPDATE public.advocate_invitations ai
    SET status = 'revoked'
    WHERE ai.status = 'pending'
      AND lower(ai.advocate_email) IN (
        SELECT lower(ap.email)
        FROM public.advocate_profiles ap
        JOIN public.org_members om ON om.user_id = ap.user_id
        WHERE om.org_id = p_org_id
      );

    -- In-app notices only for survivors who had a live grant (no email/SMS).
    FOR v_survivor IN
      SELECT DISTINCT acl.client_user_id
      FROM public.advocate_client_links acl
      WHERE acl.advocate_user_id IN (
        SELECT om.user_id FROM public.org_members om WHERE om.org_id = p_org_id
      )
        AND acl.revoked_at IS NOT NULL
        AND acl.revoked_at >= now() - interval '1 minute'
    LOOP
      INSERT INTO public.professional_suspension_notices (
        subject_kind, subject_id, survivor_user_id
      ) VALUES ('organization', p_org_id, v_survivor);
    END LOOP;
  END IF;

  -- Domain / admin change re-verify path: caller may pass needs_more_info or pending.
  INSERT INTO public.audit_events(
    user_id, event_type, subject_kind, subject_id, actor_kind, actor_id, meta
  ) VALUES (
    p_actor_id,
    'org.verification_status_changed',
    'organization',
    p_org_id,
    'admin',
    p_actor_id,
    jsonb_build_object('from', v_prev, 'to', p_status, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_verification_status(uuid, text, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_verification_status(uuid, text, uuid, text, timestamptz)
  TO service_role;

-- Re-verify on admin domain change (fails closed until review).
CREATE OR REPLACE FUNCTION public.dv_organizations_domain_reverify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.admin_email_domain IS DISTINCT FROM OLD.admin_email_domain
     AND OLD.verification_status = 'verified' THEN
    NEW.verification_status := 'pending';
    NEW.verification_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dv_organizations_domain_reverify ON public.dv_organizations;
CREATE TRIGGER dv_organizations_domain_reverify
  BEFORE UPDATE OF admin_email_domain ON public.dv_organizations
  FOR EACH ROW EXECUTE FUNCTION public.dv_organizations_domain_reverify();

-- ---------------------------------------------------------------------------
-- 8. Atomic Suspended cutoff — attorneys (+ firm staff cascade)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_attorney_verification_status(
  p_user_id uuid,
  p_status text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_firm uuid;
  v_survivor uuid;
  v_member uuid;
BEGIN
  IF p_status NOT IN ('pending', 'needs_more_info', 'declined', 'verified', 'suspended') THEN
    RAISE EXCEPTION 'Invalid attorney verification status';
  END IF;
  -- Payment must never be consulted here — status is human CLEAR only.

  SELECT verification_status INTO v_prev
  FROM public.attorney_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attorney profile not found'; END IF;

  UPDATE public.attorney_profiles
  SET
    verification_status = p_status,
    updated_at = now(),
    verified_at = CASE WHEN p_status = 'verified' THEN coalesce(verified_at, now()) ELSE verified_at END,
    verified_by = CASE WHEN p_status = 'verified' THEN p_actor_id ELSE verified_by END,
    verification_expires_at = CASE
      WHEN p_status = 'verified' THEN coalesce(p_expires_at, now() + interval '12 months')
      ELSE verification_expires_at
    END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE suspended_at END,
    suspended_by = CASE WHEN p_status = 'suspended' THEN p_actor_id ELSE suspended_by END,
    suspension_reason = CASE WHEN p_status = 'suspended' THEN p_reason ELSE suspension_reason END
  WHERE user_id = p_user_id;

  IF p_status = 'suspended' THEN
    -- Immediate grant cutoff for this attorney.
    UPDATE public.attorney_client_links
    SET status = 'revoked', revoked_at = coalesce(revoked_at, now())
    WHERE attorney_user_id = p_user_id AND status = 'active';

    UPDATE public.case_grants
    SET revoked_at = coalesce(revoked_at, now())
    WHERE revoked_at IS NULL
      AND (
        attorney_user_id = p_user_id
        OR client_link_id IN (
          SELECT id FROM public.attorney_client_links WHERE attorney_user_id = p_user_id
        )
      );

    UPDATE public.attorney_survivor_invites
    SET status = 'revoked'
    WHERE attorney_user_id = p_user_id AND status = 'pending';

    UPDATE public.attorney_invitations
    SET status = 'revoked'
    WHERE status = 'pending'
      AND lower(attorney_email) = (
        SELECT lower(email) FROM public.attorney_profiles WHERE user_id = p_user_id
      );

    -- Staff cascade: if this attorney owns/admins a firm, revoke pending
    -- firm invites and sever case_grants for firm members (grants already
    -- revalidated against membership; revoke live grants they hold).
    SELECT fm.firm_id INTO v_firm
    FROM public.firm_members fm
    WHERE fm.user_id = p_user_id AND fm.role IN ('owner', 'admin')
    LIMIT 1;

    IF v_firm IS NOT NULL THEN
      UPDATE public.firm_member_invitations
      SET status = 'revoked'
      WHERE firm_id = v_firm AND status = 'pending';

      FOR v_member IN
        SELECT user_id FROM public.firm_members WHERE firm_id = v_firm AND user_id <> p_user_id
      LOOP
        UPDATE public.case_grants
        SET revoked_at = coalesce(revoked_at, now())
        WHERE revoked_at IS NULL AND attorney_user_id = v_member;
      END LOOP;
    END IF;

    FOR v_survivor IN
      SELECT DISTINCT client_user_id
      FROM public.attorney_client_links
      WHERE attorney_user_id = p_user_id
        AND revoked_at IS NOT NULL
        AND revoked_at >= now() - interval '1 minute'
    LOOP
      INSERT INTO public.professional_suspension_notices (
        subject_kind, subject_id, survivor_user_id
      ) VALUES ('attorney', p_user_id, v_survivor);
    END LOOP;
  END IF;

  INSERT INTO public.audit_events(
    user_id, event_type, subject_kind, subject_id, actor_kind, actor_id, meta
  ) VALUES (
    p_actor_id,
    'attorney.verification_status_changed',
    'attorney',
    p_user_id,
    'admin',
    p_actor_id,
    jsonb_build_object('from', v_prev, 'to', p_status, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_attorney_verification_status(uuid, text, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_attorney_verification_status(uuid, text, uuid, text, timestamptz)
  TO service_role;

-- Leaving a firm already revokes grants in remove_firm_member; reinforce
-- engagement fail-closed is handled in application assert paths.
