CREATE TABLE IF NOT EXISTS public.user_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key_jwk jsonb NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_webauthn_credentials_user_idx ON public.user_webauthn_credentials (user_id);
CREATE TABLE IF NOT EXISTS public.user_webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_webauthn_challenges_user_idx ON public.user_webauthn_challenges (user_id, purpose, created_at DESC);
REVOKE ALL ON public.user_webauthn_credentials FROM anon, authenticated;
REVOKE ALL ON public.user_webauthn_challenges FROM anon, authenticated;
GRANT ALL ON public.user_webauthn_credentials TO service_role;
GRANT ALL ON public.user_webauthn_challenges TO service_role;
ALTER TABLE public.user_webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_webauthn_challenges ENABLE ROW LEVEL SECURITY;