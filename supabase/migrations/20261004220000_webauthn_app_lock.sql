-- Server-verified biometric app lock.
--
-- Until now "biometric unlock" was a browser prompt plus a database flag: the server
-- minted an unlock token for anyone with a signed-in session, with no proof. These tables
-- hold the enrolled public keys and the one-time challenges the server checks a real
-- WebAuthn signature against.
--
-- Public keys only. Nothing biometric ever reaches the server.
-- Access: server functions only (service role). RLS on with no policies.
-- Existing users whose biometric_enabled flag is set but who have no key here must set
-- biometrics up again; their PIN (if any) keeps working.
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.user_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key_jwk jsonb NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_webauthn_credentials_user_idx
  ON public.user_webauthn_credentials (user_id);

CREATE TABLE IF NOT EXISTS public.user_webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_webauthn_challenges_user_idx
  ON public.user_webauthn_challenges (user_id, purpose, created_at DESC);

ALTER TABLE public.user_webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_webauthn_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_webauthn_credentials FROM anon, authenticated;
REVOKE ALL ON public.user_webauthn_challenges FROM anon, authenticated;
