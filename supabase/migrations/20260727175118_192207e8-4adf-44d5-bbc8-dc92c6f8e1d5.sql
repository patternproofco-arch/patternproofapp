CREATE TABLE public.clio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  clio_user_id text,
  clio_user_email text,
  firm_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.clio_connections TO service_role;
ALTER TABLE public.clio_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own clio connection"
  ON public.clio_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their own clio connection"
  ON public.clio_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER clio_connections_touch
  BEFORE UPDATE ON public.clio_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.clio_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

GRANT ALL ON public.clio_oauth_states TO service_role;
ALTER TABLE public.clio_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE INDEX clio_oauth_states_user_idx ON public.clio_oauth_states (user_id);