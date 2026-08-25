-- 1. Hashed invitation tokens
ALTER TABLE public.firm_member_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.firm_member_invitations ALTER COLUMN invite_token DROP NOT NULL;
ALTER TABLE public.org_member_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.org_member_invitations ALTER COLUMN invite_token DROP NOT NULL;
CREATE INDEX IF NOT EXISTS firm_member_invitations_token_hash_idx ON public.firm_member_invitations(token_hash);
CREATE INDEX IF NOT EXISTS org_member_invitations_token_hash_idx ON public.org_member_invitations(token_hash);

-- 2. referral_links.org_id
ALTER TABLE public.referral_links ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.dv_organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS referral_links_org_id_idx ON public.referral_links(org_id);

-- 3. Acceptance routines
CREATE OR REPLACE FUNCTION public.accept_firm_member_invitation(p_token_hash text, p_user_id uuid, p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inv public.firm_member_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.firm_member_invitations
   WHERE token_hash = p_token_hash AND status = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or already used.'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'This invitation has expired.'; END IF;
  IF lower(btrim(p_email)) <> lower(btrim(inv.email)) THEN
    RAISE EXCEPTION 'This invitation was issued to a different email address.';
  END IF;

  INSERT INTO public.firm_members(firm_id, user_id, role)
  VALUES (inv.firm_id, p_user_id, inv.role)
  ON CONFLICT (firm_id, user_id) DO NOTHING;

  UPDATE public.firm_member_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id
   WHERE id = inv.id;

  RETURN inv.firm_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_firm_member_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_firm_member_invitation(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_org_member_invitation(p_token_hash text, p_user_id uuid, p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inv public.org_member_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.org_member_invitations
   WHERE token_hash = p_token_hash AND status = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or already used.'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'This invitation has expired.'; END IF;
  IF lower(btrim(p_email)) <> lower(btrim(inv.email)) THEN
    RAISE EXCEPTION 'This invitation was issued to a different email address.';
  END IF;

  INSERT INTO public.org_members(org_id, user_id, role)
  VALUES (inv.org_id, p_user_id, inv.role)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_member_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id
   WHERE id = inv.id;

  RETURN inv.org_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_org_member_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_org_member_invitation(text, uuid, text) TO service_role;

-- 4. AI-proposed timeline drafts
CREATE TABLE IF NOT EXISTS public.proposed_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  sort_key text,
  date_certainty text NOT NULL DEFAULT 'unknown',
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  source_summary text,
  confidence_notes text[] NOT NULL DEFAULT '{}',
  model text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.proposed_incidents TO authenticated;
GRANT ALL ON public.proposed_incidents TO service_role;

ALTER TABLE public.proposed_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own proposed entries"
  ON public.proposed_incidents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can review their own proposed entries"
  ON public.proposed_incidents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS proposed_incidents_user_status_idx
  ON public.proposed_incidents(user_id, status);

CREATE TRIGGER proposed_incidents_touch
  BEFORE UPDATE ON public.proposed_incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();