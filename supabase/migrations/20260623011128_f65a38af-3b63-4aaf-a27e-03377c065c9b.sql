CREATE TABLE public.attorney_survivor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survivor_email text NOT NULL,
  survivor_name text,
  personal_note text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_survivor_invites TO authenticated;
GRANT ALL ON public.attorney_survivor_invites TO service_role;

ALTER TABLE public.attorney_survivor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage their own survivor invites"
  ON public.attorney_survivor_invites
  FOR ALL
  TO authenticated
  USING (auth.uid() = attorney_user_id)
  WITH CHECK (auth.uid() = attorney_user_id);

CREATE INDEX attorney_survivor_invites_attorney_idx
  ON public.attorney_survivor_invites (attorney_user_id, created_at DESC);

CREATE TRIGGER attorney_survivor_invites_touch
  BEFORE UPDATE ON public.attorney_survivor_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();