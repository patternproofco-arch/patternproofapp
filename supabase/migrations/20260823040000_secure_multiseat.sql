-- Secure multi-seat memberships. A name is never evidence of membership.
-- Existing attorney_profiles.firm_id is legacy display metadata only; access is
-- exclusively controlled by the explicit membership rows below.

ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS seats_included integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seats_purchased integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.firms
    ADD CONSTRAINT firms_seats_included_nonnegative CHECK (seats_included >= 1),
    ADD CONSTRAINT firms_seats_purchased_nonnegative CHECK (seats_purchased >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Firm and Enterprise subscriptions include up to 15 verified logins. Existing
-- firms without a current firm subscription remain at the one-owner default.
UPDATE public.firms f
SET seats_included = 15
WHERE EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.user_id = f.created_by
    AND s.price_id IN (
      'attorney_firm_monthly',
      'attorney_firm_charter_monthly',
      'attorney_enterprise_monthly'
    )
    AND (
      (s.status IN ('active', 'trialing', 'past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > now()))
      OR (s.status = 'canceled' AND s.current_period_end > now())
    )
);

CREATE TABLE IF NOT EXISTS public.firm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS firm_members_one_firm_per_user ON public.firm_members(user_id);
CREATE INDEX IF NOT EXISTS firm_members_firm_user_idx ON public.firm_members(firm_id, user_id);

-- Only a recorded firm creator is migrated as an owner. Earlier profile rows
-- that merely shared a typed firm name are intentionally not trusted as seats.
INSERT INTO public.firm_members (firm_id, user_id, role)
SELECT f.id, f.created_by, 'owner'
FROM public.firms f
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.firm_member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  email text NOT NULL,
  -- Kept only long enough for the ALTER below to support older deployments;
  -- it is cleared before this migration completes.
  invite_token text,
  token_hash text,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Historical raw-token invitations are revoked rather than carried forward.
-- Managers can issue fresh hashed-token invitations after this migration.
ALTER TABLE public.firm_member_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.firm_member_invitations ALTER COLUMN invite_token DROP NOT NULL;
UPDATE public.firm_member_invitations
SET invite_token = NULL, status = 'revoked'
WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS firm_member_invitations_token_hash_key
  ON public.firm_member_invitations(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS firm_member_invitations_firm_pending_idx
  ON public.firm_member_invitations(firm_id) WHERE status = 'pending';

-- The limit is enforced in the database so service-role code and concurrent
-- acceptances cannot overbook seats.
CREATE OR REPLACE FUNCTION public.enforce_firm_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT greatest(1, coalesce(seats_included, 1) + coalesce(seats_purchased, 0))
  INTO v_limit
  FROM public.firms
  WHERE id = NEW.firm_id
  FOR UPDATE;
  IF v_limit IS NULL THEN RAISE EXCEPTION 'Firm not found'; END IF;
  SELECT count(*) INTO v_count FROM public.firm_members WHERE firm_id = NEW.firm_id;
  IF v_count >= v_limit THEN RAISE EXCEPTION 'This firm has reached its seat limit'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS firm_members_enforce_seat_limit ON public.firm_members;
CREATE TRIGGER firm_members_enforce_seat_limit
  BEFORE INSERT ON public.firm_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_firm_seat_limit();

-- All invitation verification and consumption occurs in one transaction. This
-- function is service-role-only; the server function separately verifies the
-- authenticated caller's claim before passing it here.
CREATE OR REPLACE FUNCTION public.accept_firm_member_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_inv public.firm_member_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.firm_member_invitations
  WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF v_inv.expires_at <= now() THEN
    UPDATE public.firm_member_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN NULL;
  END IF;
  IF lower(v_inv.email) <> lower(p_email) THEN RAISE EXCEPTION 'This invitation was sent to a different email address'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role <> 'attorney'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Use a separate verified attorney login for firm access';
  END IF;
  INSERT INTO public.firm_members (firm_id, user_id, role) VALUES (v_inv.firm_id, p_user_id, v_inv.role);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'attorney'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.attorney_profiles
  SET firm_id = v_inv.firm_id, updated_at = now()
  WHERE user_id = p_user_id;
  UPDATE public.firm_member_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id
  WHERE id = v_inv.id;
  RETURN v_inv.firm_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.dv_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Organization names are not identities: two independent organizations may
-- legitimately use the same name. Membership always requires an invitation.
DROP INDEX IF EXISTS public.dv_organizations_name_ci_key;
CREATE INDEX IF NOT EXISTS dv_organizations_name_ci_idx ON public.dv_organizations(lower(name));

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS org_members_one_org_per_user ON public.org_members(user_id);

CREATE TABLE IF NOT EXISTS public.org_member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  -- Kept only long enough for the ALTER below to support older deployments;
  -- it is cleared before this migration completes.
  invite_token text,
  token_hash text,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_member_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.org_member_invitations ALTER COLUMN invite_token DROP NOT NULL;
UPDATE public.org_member_invitations
SET invite_token = NULL, status = 'revoked'
WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS org_member_invitations_token_hash_key
  ON public.org_member_invitations(token_hash) WHERE token_hash IS NOT NULL;

ALTER TABLE public.advocate_profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.dv_organizations(id) ON DELETE SET NULL;
ALTER TABLE public.referral_links ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.dv_organizations(id) ON DELETE SET NULL;

-- Administrative approval created the historical referral accounts. Map those
-- approved accounts to a durable org and make them owners; do not derive an
-- organization membership from a free-form profile name alone.
INSERT INTO public.dv_organizations (name, created_by)
SELECT DISTINCT ON (rl.org_user_id) trim(rl.org_name), rl.org_user_id
FROM public.referral_links rl
WHERE rl.org_user_id IS NOT NULL
  AND nullif(trim(rl.org_name), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.dv_organizations existing
    WHERE existing.created_by = rl.org_user_id
  )
ORDER BY rl.org_user_id, rl.created_at ASC;

UPDATE public.referral_links rl
SET org_id = o.id
FROM public.dv_organizations o
WHERE rl.org_id IS NULL AND rl.org_user_id = o.created_by;

UPDATE public.advocate_profiles ap
SET org_id = rl.org_id
FROM public.referral_links rl
WHERE ap.org_id IS NULL AND rl.org_user_id = ap.user_id AND rl.org_id IS NOT NULL;

INSERT INTO public.org_members (org_id, user_id, role)
SELECT DISTINCT rl.org_id, rl.org_user_id, 'owner'
FROM public.referral_links rl
WHERE rl.org_id IS NOT NULL AND rl.org_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.accept_org_member_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_inv public.org_member_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.org_member_invitations WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF v_inv.expires_at <= now() THEN
    UPDATE public.org_member_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN NULL;
  END IF;
  IF lower(v_inv.email) <> lower(p_email) THEN RAISE EXCEPTION 'This invitation was sent to a different email address'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role <> 'advocate'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Use a separate verified advocate login for organization access';
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (v_inv.org_id, p_user_id, v_inv.role);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'advocate'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.advocate_profiles
  SET org_id = v_inv.org_id
  WHERE user_id = p_user_id;
  UPDATE public.org_member_invitations SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id WHERE id = v_inv.id;
  RETURN v_inv.org_id;
END;
$$;

-- Direct browser writes cannot fabricate membership, invitations, or seats.
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_member_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_members, public.firm_member_invitations, public.org_members, public.org_member_invitations FROM anon, authenticated;
GRANT ALL ON public.firm_members, public.firm_member_invitations, public.org_members, public.org_member_invitations TO service_role;
REVOKE EXECUTE ON FUNCTION public.accept_firm_member_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_org_member_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_firm_member_invitation(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_org_member_invitation(text, uuid, text) TO service_role;
