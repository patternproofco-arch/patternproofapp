-- PR-B: advocate → survivor email invites.
-- Opening the email link alone grants nothing; access requires an explicit
-- Accept that creates an advocate_client_links row. Decline / expire / revoke
-- leave no active grant.

CREATE TABLE IF NOT EXISTS public.advocate_survivor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advocate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survivor_email text NOT NULL,
  survivor_name text,
  personal_note text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'declined')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocate_survivor_invites_advocate_idx
  ON public.advocate_survivor_invites (advocate_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advocate_survivor_invites_token_idx
  ON public.advocate_survivor_invites (invite_token);

CREATE INDEX IF NOT EXISTS advocate_survivor_invites_email_idx
  ON public.advocate_survivor_invites (lower(survivor_email));

-- Optional provenance from the reverse invite (advocate → survivor).
ALTER TABLE public.advocate_client_links
  ADD COLUMN IF NOT EXISTS survivor_invite_id uuid
    REFERENCES public.advocate_survivor_invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS advocate_links_survivor_invite_idx
  ON public.advocate_client_links (survivor_invite_id)
  WHERE survivor_invite_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocate_survivor_invites TO authenticated;
GRANT ALL ON public.advocate_survivor_invites TO service_role;

ALTER TABLE public.advocate_survivor_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advocates manage their own survivor invites"
  ON public.advocate_survivor_invites;
CREATE POLICY "Advocates manage their own survivor invites"
  ON public.advocate_survivor_invites
  FOR ALL
  TO authenticated
  USING (auth.uid() = advocate_user_id)
  WITH CHECK (auth.uid() = advocate_user_id);

-- Invited survivor can read their own pending invite (email match via JWT).
DROP POLICY IF EXISTS "Invited survivors can read advocate survivor invites"
  ON public.advocate_survivor_invites;
CREATE POLICY "Invited survivors can read advocate survivor invites"
  ON public.advocate_survivor_invites
  FOR SELECT
  TO authenticated
  USING (
    accepted_by = auth.uid()
    OR lower(survivor_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

CREATE TRIGGER advocate_survivor_invites_touch
  BEFORE UPDATE ON public.advocate_survivor_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
